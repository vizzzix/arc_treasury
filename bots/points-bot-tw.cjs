/**
 * Points Bot with Time-Weighted Anti-Farming Protection
 * Run: node points-bot-tw.cjs
 *
 * Features:
 * - Monitors TreasuryVault: Deposit, DepositEURC, DepositLocked events
 * - Monitors StablecoinSwap: Swap, LiquidityAdded/Removed events
 * - Takes hourly balance snapshots for time-weighted points (anti-farming)
 */

const { createClient } = require('@supabase/supabase-js');
const { createPublicClient, http, formatEther, formatUnits } = require('viem');

// Supabase config
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Missing SUPABASE_URL or SUPABASE_KEY');

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Arc RPC
const ARC_RPC = 'https://rpc.testnet.arc.network';
const publicClient = createPublicClient({
  transport: http(ARC_RPC, { timeout: 30000 }),
});

// Contract addresses
const TREASURY_VAULT = '0x17ca5232415430bC57F646A72fD15634807bF729';
const STABLECOIN_SWAP = '0x3a5964ce5cd8b09e55af9323a894e78bdd7f04bf';

// Arcscan API
const ARCSCAN_API = 'https://testnet.arcscan.app/api/v2';

// ABIs for balance queries
const VAULT_ABI = [
  { inputs: [{ name: 'user', type: 'address' }], name: 'getUserShareValue', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'user', type: 'address' }], name: 'getUserEURCShareValue', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'user', type: 'address' }], name: 'getLockedPositions', outputs: [{ components: [{ name: 'id', type: 'uint256' }, { name: 'amount', type: 'uint256' }, { name: 'token', type: 'address' }, { name: 'lockPeriodMonths', type: 'uint8' }, { name: 'depositTime', type: 'uint256' }, { name: 'unlockTime', type: 'uint256' }, { name: 'lastYieldClaim', type: 'uint256' }, { name: 'withdrawn', type: 'bool' }], name: '', type: 'tuple[]' }], stateMutability: 'view', type: 'function' },
];

// Snapshot interval (1 hour in ms)
const SNAPSHOT_INTERVAL_MS = 60 * 60 * 1000;

// State file to track last processed block and snapshot time
const STATE_FILE = './points-bot-state.json';
const fs = require('fs');

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    }
  } catch (e) {}
  return { lastVaultBlock: 0, lastSwapBlock: 0, processedTxHashes: [], lastSnapshotTime: 0 };
}

function saveState(state) {
  state.processedTxHashes = state.processedTxHashes.slice(-1000);
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

async function fetchLogs(address, fromBlock = null) {
  const allLogs = [];
  let nextPage = null;

  try {
    for (let i = 0; i < 10; i++) {
      let url = `${ARCSCAN_API}/addresses/${address}/logs`;
      if (nextPage) {
        url += `?block_number=${nextPage.block_number}&index=${nextPage.index}&items_count=${nextPage.items_count}`;
      }

      const response = await fetch(url);
      if (!response.ok) break;

      const data = await response.json();
      if (!data.items || data.items.length === 0) break;

      const filtered = fromBlock
        ? data.items.filter(log => (log.block_number || 0) > fromBlock)
        : data.items;

      allLogs.push(...filtered);
      nextPage = data.next_page_params;
      if (!nextPage) break;
    }
  } catch (err) {
    console.warn('Arcscan API error:', err.message);
  }

  return allLogs;
}

// ============= SNAPSHOT FUNCTIONS =============

async function getWalletBalances(wallet) {
  let vaultUsdc = 0, vaultEurc = 0, lockedUsdc = 0, lockedEurc = 0;

  try {
    const usdcValue = await publicClient.readContract({
      address: TREASURY_VAULT,
      abi: VAULT_ABI,
      functionName: 'getUserShareValue',
      args: [wallet],
    });
    // getUserShareValue returns 6 decimals (USDC format), not 18!
    vaultUsdc = Number(formatUnits(usdcValue, 6));
  } catch (e) {}

  try {
    const eurcValue = await publicClient.readContract({
      address: TREASURY_VAULT,
      abi: VAULT_ABI,
      functionName: 'getUserEURCShareValue',
      args: [wallet],
    });
    vaultEurc = Number(formatUnits(eurcValue, 6));
  } catch (e) {}

  try {
    const positions = await publicClient.readContract({
      address: TREASURY_VAULT,
      abi: VAULT_ABI,
      functionName: 'getLockedPositions',
      args: [wallet],
    });

    for (const pos of positions) {
      if (!pos.withdrawn) {
        // Native USDC (0x3600...) uses 18 decimals, EURC uses 6 decimals
        const isNativeUSDC = pos.token && pos.token.toLowerCase() === '0x3600000000000000000000000000000000000000';
        const isEURC = pos.token && pos.token.toLowerCase() === '0xf88ac22c2c276fb6f345d5f3a63f7b50cd1cf991';
        const decimals = isNativeUSDC ? 18 : 6;
        const amount = Number(formatUnits(pos.amount, decimals));
        if (isEURC) {
          lockedEurc += amount;
        } else {
          lockedUsdc += amount;
        }
      }
    }
  } catch (e) {}

  return { vaultUsdc, vaultEurc, lockedUsdc, lockedEurc };
}

async function getLpBalance(wallet) {
  // Calculate LP balance from liquidity_events (add - remove)
  const { data } = await supabase
    .from('liquidity_events')
    .select('action, amount_usd')
    .eq('wallet_address', wallet.toLowerCase());

  if (!data || data.length === 0) return 0;

  let balance = 0;
  for (const event of data) {
    if (event.action === 'add') balance += event.amount_usd;
    else if (event.action === 'remove') balance -= event.amount_usd;
  }
  return Math.max(0, balance); // Ensure non-negative
}

async function takeBalanceSnapshots() {
  console.log('\n3. Taking balance snapshots...');

  const [deposits, swaps, liquidity] = await Promise.all([
    supabase.from('vault_deposits').select('wallet_address'),
    supabase.from('swap_transactions').select('wallet_address'),
    supabase.from('liquidity_events').select('wallet_address'),
  ]);

  const allWallets = new Set();
  deposits.data?.forEach(d => allWallets.add(d.wallet_address));
  swaps.data?.forEach(s => allWallets.add(s.wallet_address));
  liquidity.data?.forEach(l => allWallets.add(l.wallet_address));

  const walletsToSnapshot = Array.from(allWallets);
  console.log(`   Found ${walletsToSnapshot.length} wallets to snapshot`);

  let snapshotCount = 0;
  const snapshotTime = new Date().toISOString();

  for (const wallet of walletsToSnapshot) {
    try {
      const balances = await getWalletBalances(wallet);
      const lpBalance = await getLpBalance(wallet);

      const totalUsd = balances.vaultUsdc + balances.vaultEurc + balances.lockedUsdc + balances.lockedEurc + lpBalance;

      if (totalUsd > 0) {
        const { error } = await supabase
          .from('balance_snapshots')
          .insert({
            wallet_address: wallet.toLowerCase(),
            snapshot_time: snapshotTime,
            vault_usdc: balances.vaultUsdc,
            vault_eurc: balances.vaultEurc,
            locked_usdc: balances.lockedUsdc,
            locked_eurc: balances.lockedEurc,
            lp_balance: lpBalance,
            total_usd: totalUsd,
          });

        if (!error) {
          snapshotCount++;
        }
      }
    } catch (e) {}

    await new Promise(r => setTimeout(r, 100));
  }

  console.log(`   Created ${snapshotCount} snapshots`);
  return snapshotCount;
}

async function recalculateTimeWeightedPoints() {
  console.log('\n4. Recalculating time-weighted points...');

  const { data, error } = await supabase.rpc('recalculate_all_points_tw');

  if (error) {
    console.log(`   ⚠️ TW recalc not available (run time_weighted_points.sql first)`);
    return 0;
  }

  console.log(`   Recalculated points for ${data} users`);
  return data;
}

// ============= EVENT PROCESSING =============

async function processVaultLogs(logs, state) {
  let newDeposits = 0;
  let maxBlock = state.lastVaultBlock;

  for (const log of logs) {
    const txHash = log.transaction_hash;
    const blockNum = log.block_number || 0;

    if (blockNum > maxBlock) maxBlock = blockNum;
    if (state.processedTxHashes.includes(txHash)) continue;

    const decoded = log.decoded;
    if (!decoded?.method_call) continue;

    const method = decoded.method_call;
    const params = decoded.parameters || [];

    const isDeposit = method.startsWith('Deposit(') ||
                      method.startsWith('DepositEURC(') ||
                      method.startsWith('DepositLocked(');

    if (!isDeposit) continue;

    const userParam = params.find(p => p.name === 'user');
    const amountParam = params.find(p => p.name === 'amount' || p.name === 'arcUSDCAmount');
    const lockPeriodParam = params.find(p => p.name === 'lockPeriod' || p.name === 'lockMonths');

    if (!userParam || !amountParam) continue;

    const wallet = userParam.value.toLowerCase();
    const rawAmount = BigInt(amountParam.value);

    const isEurc = method.includes('EURC');
    const isUsdc = !isEurc;

    const decimals = isUsdc ? 18 : 6;
    const amountUsd = Number(rawAmount) / Math.pow(10, decimals);

    const lockPeriod = lockPeriodParam ? Number(lockPeriodParam.value) : 0;
    const token = isEurc ? 'EURC' : 'USDC';

    const { error } = await supabase
      .from('vault_deposits')
      .upsert({
        wallet_address: wallet,
        amount_usd: amountUsd,
        token: token,
        lock_period: lockPeriod,
        tx_hash: txHash,
      }, { onConflict: 'tx_hash' });

    if (error) {
      console.error(`  ❌ vault_deposits error: ${error.message}`);
    } else {
      console.log(`  ✅ Deposit: ${wallet.slice(0,8)}... | $${amountUsd.toFixed(2)} ${token} | lock: ${lockPeriod}m`);
      state.processedTxHashes.push(txHash);
      newDeposits++;
    }
  }

  state.lastVaultBlock = maxBlock;
  return newDeposits;
}

async function processSwapLogs(logs, state) {
  let newSwaps = 0;
  let newLiquidity = 0;
  let maxBlock = state.lastSwapBlock;

  for (const log of logs) {
    const txHash = log.transaction_hash;
    const blockNum = log.block_number || 0;

    if (blockNum > maxBlock) maxBlock = blockNum;
    if (state.processedTxHashes.includes(txHash)) continue;

    const decoded = log.decoded;
    if (!decoded?.method_call) continue;

    const method = decoded.method_call;
    const params = decoded.parameters || [];

    if (method.startsWith('Swap(')) {
      const traderParam = params.find(p => p.name === 'trader');
      const amountInParam = params.find(p => p.name === 'amountIn');
      const yesInParam = params.find(p => p.name === 'yesIn');

      if (!traderParam || !amountInParam) continue;

      const wallet = traderParam.value.toLowerCase();
      const rawAmountIn = BigInt(amountInParam.value);
      const yesIn = yesInParam?.value === 'true' || yesInParam?.value === true;

      const decimals = yesIn ? 18 : 6;
      const amountUsd = Number(rawAmountIn) / Math.pow(10, decimals);

      const tokenIn = yesIn ? 'USDC' : 'EURC';
      const tokenOut = yesIn ? 'EURC' : 'USDC';

      const { error } = await supabase
        .from('swap_transactions')
        .upsert({
          wallet_address: wallet,
          amount_usd: amountUsd,
          token_in: tokenIn,
          token_out: tokenOut,
          tx_hash: txHash,
        }, { onConflict: 'tx_hash' });

      if (error) {
        console.error(`  ❌ swap error: ${error.message}`);
      } else {
        console.log(`  ✅ Swap: ${wallet.slice(0,8)}... | $${amountUsd.toFixed(2)} ${tokenIn}->${tokenOut}`);
        state.processedTxHashes.push(txHash);
        newSwaps++;
      }
    }

    if (method.startsWith('LiquidityAdded(')) {
      const userParam = params.find(p => p.name === 'user');
      const usdcAmountParam = params.find(p => p.name === 'usdcAmount');
      const eurcAmountParam = params.find(p => p.name === 'eurcAmount');

      if (!userParam) continue;

      const wallet = userParam.value.toLowerCase();
      const usdcRaw = BigInt(usdcAmountParam?.value || '0');
      const eurcRaw = BigInt(eurcAmountParam?.value || '0');

      const usdcUsd = Number(usdcRaw) / 1e18;
      const eurcUsd = Number(eurcRaw) / 1e6;
      const totalUsd = usdcUsd + eurcUsd;

      const { error } = await supabase
        .from('liquidity_events')
        .upsert({
          wallet_address: wallet,
          amount_usd: totalUsd,
          action: 'add',
          tx_hash: txHash,
        }, { onConflict: 'tx_hash' });

      if (error) {
        console.error(`  ❌ liquidity error: ${error.message}`);
      } else {
        console.log(`  ✅ LP Add: ${wallet.slice(0,8)}... | $${totalUsd.toFixed(2)}`);
        state.processedTxHashes.push(txHash);
        newLiquidity++;
      }
    }

    if (method.startsWith('LiquidityRemoved(')) {
      const userParam = params.find(p => p.name === 'user');
      const usdcAmountParam = params.find(p => p.name === 'usdcAmount');
      const eurcAmountParam = params.find(p => p.name === 'eurcAmount');

      if (!userParam) continue;

      const wallet = userParam.value.toLowerCase();
      const usdcRaw = BigInt(usdcAmountParam?.value || '0');
      const eurcRaw = BigInt(eurcAmountParam?.value || '0');

      const usdcUsd = Number(usdcRaw) / 1e18;
      const eurcUsd = Number(eurcRaw) / 1e6;
      const totalUsd = usdcUsd + eurcUsd;

      const { error } = await supabase
        .from('liquidity_events')
        .upsert({
          wallet_address: wallet,
          amount_usd: totalUsd,
          action: 'remove',
          tx_hash: txHash,
        }, { onConflict: 'tx_hash' });

      if (error) {
        console.error(`  ❌ liquidity error: ${error.message}`);
      } else {
        console.log(`  ✅ LP Remove: ${wallet.slice(0,8)}... | $${totalUsd.toFixed(2)}`);
        state.processedTxHashes.push(txHash);
        newLiquidity++;
      }
    }
  }

  state.lastSwapBlock = maxBlock;
  return { newSwaps, newLiquidity };
}

// ============= MAIN FUNCTIONS =============

async function runOnce() {
  console.log('=== Points Bot (Time-Weighted) ===');
  console.log(`Time: ${new Date().toISOString()}\n`);

  const state = loadState();
  console.log(`Last vault block: ${state.lastVaultBlock}`);
  console.log(`Last swap block: ${state.lastSwapBlock}`);
  console.log(`Tracked tx hashes: ${state.processedTxHashes.length}`);
  console.log(`Last snapshot: ${state.lastSnapshotTime ? new Date(state.lastSnapshotTime).toISOString() : 'never'}\n`);

  console.log('1. Fetching TreasuryVault logs...');
  const vaultLogs = await fetchLogs(TREASURY_VAULT, state.lastVaultBlock);
  console.log(`   Found ${vaultLogs.length} new logs`);
  const newDeposits = await processVaultLogs(vaultLogs, state);

  console.log('\n2. Fetching StablecoinSwap logs...');
  const swapLogs = await fetchLogs(STABLECOIN_SWAP, state.lastSwapBlock);
  console.log(`   Found ${swapLogs.length} new logs`);
  const { newSwaps, newLiquidity } = await processSwapLogs(swapLogs, state);

  const now = Date.now();
  const timeSinceLastSnapshot = now - (state.lastSnapshotTime || 0);
  let snapshotsTaken = 0;

  if (timeSinceLastSnapshot >= SNAPSHOT_INTERVAL_MS) {
    snapshotsTaken = await takeBalanceSnapshots();
    await recalculateTimeWeightedPoints();
    state.lastSnapshotTime = now;
  } else {
    const nextSnapshotIn = Math.round((SNAPSHOT_INTERVAL_MS - timeSinceLastSnapshot) / 60000);
    console.log(`\n3. Next snapshot in ${nextSnapshotIn} minutes`);
  }

  saveState(state);

  console.log('\n=== Summary ===');
  console.log(`New deposits: ${newDeposits}`);
  console.log(`New swaps: ${newSwaps}`);
  console.log(`New liquidity events: ${newLiquidity}`);
  console.log(`Snapshots taken: ${snapshotsTaken}`);
  console.log(`State saved to ${STATE_FILE}`);
}

async function runDaemon(intervalMs = 60000) {
  console.log('=== Points Bot (Time-Weighted) - Daemon Mode ===');
  console.log(`Polling interval: ${intervalMs / 1000}s`);
  console.log(`Snapshot interval: ${SNAPSHOT_INTERVAL_MS / 60000} minutes\n`);

  while (true) {
    try {
      await runOnce();
    } catch (err) {
      console.error('Error in bot cycle:', err.message);
    }

    console.log(`\nWaiting ${intervalMs / 1000}s...\n`);
    await new Promise(r => setTimeout(r, intervalMs));
  }
}

// CLI
const args = process.argv.slice(2);
if (args.includes('--daemon') || args.includes('-d')) {
  const interval = parseInt(args.find(a => a.startsWith('--interval='))?.split('=')[1] || '60') * 1000;
  runDaemon(interval).catch(console.error);
} else if (args.includes('--snapshot')) {
  takeBalanceSnapshots().then(() => recalculateTimeWeightedPoints()).catch(console.error);
} else {
  runOnce().catch(console.error);
}
