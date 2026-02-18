/**
 * Points Bot - Monitors Arc Testnet for vault/swap events and updates Supabase
 * Run: node scripts/points-bot.cjs
 *
 * Monitors:
 * - TreasuryVault: Deposit, DepositEURC, DepositLocked events
 * - StablecoinSwap: Swap events
 */

const { createClient } = require('@supabase/supabase-js');

// Supabase config
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Missing SUPABASE_URL or SUPABASE_KEY');

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Contract addresses
const TREASURY_VAULT = '0x17ca5232415430bC57F646A72fD15634807bF729';
const STABLECOIN_SWAP = '0x3a5964ce5cd8b09e55af9323a894e78bdd7f04bf';

// Arcscan API
const ARCSCAN_API = 'https://testnet.arcscan.app/api/v2';

// State file to track last processed block
const STATE_FILE = './points-bot-state.json';
const fs = require('fs');

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    }
  } catch (e) {}
  return { lastVaultBlock: 0, lastSwapBlock: 0, processedTxHashes: [] };
}

function saveState(state) {
  // Keep only last 1000 tx hashes to prevent memory bloat
  state.processedTxHashes = state.processedTxHashes.slice(-1000);
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

async function fetchLogs(address, fromBlock = null) {
  const allLogs = [];
  let nextPage = null;

  try {
    for (let i = 0; i < 10; i++) { // Max 10 pages
      let url = `${ARCSCAN_API}/addresses/${address}/logs`;
      if (nextPage) {
        url += `?block_number=${nextPage.block_number}&index=${nextPage.index}&items_count=${nextPage.items_count}`;
      }

      const response = await fetch(url);
      if (!response.ok) break;

      const data = await response.json();
      if (!data.items || data.items.length === 0) break;

      // Filter by block number if specified
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

    // Parse deposit events
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

    // Determine token and decimals
    const isEurc = method.includes('EURC');
    const isUsdc = !isEurc;

    // USDC on Arc uses 18 decimals (native), EURC uses 6
    const decimals = isUsdc ? 18 : 6;
    const amountUsd = Number(rawAmount) / Math.pow(10, decimals);

    const lockPeriod = lockPeriodParam ? Number(lockPeriodParam.value) : 0;
    const token = isEurc ? 'EURC' : 'USDC';

    // Insert to vault_deposits
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

    // Parse Swap events: Swap(address indexed trader, bool indexed yesIn, uint256 amountIn, uint256 amountOut, uint256 feePaid)
    if (method.startsWith('Swap(')) {
      const traderParam = params.find(p => p.name === 'trader');
      const amountInParam = params.find(p => p.name === 'amountIn');
      const yesInParam = params.find(p => p.name === 'yesIn');

      if (!traderParam || !amountInParam) continue;

      const wallet = traderParam.value.toLowerCase();
      const rawAmountIn = BigInt(amountInParam.value);
      const yesIn = yesInParam?.value === 'true' || yesInParam?.value === true;

      // yesIn=true means USDC->EURC (USDC has 18 decimals on Arc)
      // yesIn=false means EURC->USDC (EURC has 6 decimals)
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

    // Parse LiquidityAdded events
    if (method.startsWith('LiquidityAdded(')) {
      const userParam = params.find(p => p.name === 'user');
      const usdcAmountParam = params.find(p => p.name === 'usdcAmount');
      const eurcAmountParam = params.find(p => p.name === 'eurcAmount');

      if (!userParam) continue;

      const wallet = userParam.value.toLowerCase();
      const usdcRaw = BigInt(usdcAmountParam?.value || '0');
      const eurcRaw = BigInt(eurcAmountParam?.value || '0');

      // USDC is 18 decimals, EURC is 6 decimals on Arc
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

    // Parse LiquidityRemoved events
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

async function runOnce() {
  console.log('=== Points Bot - Single Run ===');
  console.log(`Time: ${new Date().toISOString()}\n`);

  const state = loadState();
  console.log(`Last vault block: ${state.lastVaultBlock}`);
  console.log(`Last swap block: ${state.lastSwapBlock}`);
  console.log(`Tracked tx hashes: ${state.processedTxHashes.length}\n`);

  // Fetch and process vault logs
  console.log('1. Fetching TreasuryVault logs...');
  const vaultLogs = await fetchLogs(TREASURY_VAULT, state.lastVaultBlock);
  console.log(`   Found ${vaultLogs.length} new logs`);
  const newDeposits = await processVaultLogs(vaultLogs, state);

  // Fetch and process swap logs
  console.log('\n2. Fetching StablecoinSwap logs...');
  const swapLogs = await fetchLogs(STABLECOIN_SWAP, state.lastSwapBlock);
  console.log(`   Found ${swapLogs.length} new logs`);
  const { newSwaps, newLiquidity } = await processSwapLogs(swapLogs, state);

  // Save state
  saveState(state);

  console.log('\n=== Summary ===');
  console.log(`New deposits: ${newDeposits}`);
  console.log(`New swaps: ${newSwaps}`);
  console.log(`New liquidity events: ${newLiquidity}`);
  console.log(`State saved to ${STATE_FILE}`);
}

async function runDaemon(intervalMs = 60000) {
  console.log('=== Points Bot - Daemon Mode ===');
  console.log(`Polling interval: ${intervalMs / 1000}s\n`);

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
} else {
  runOnce().catch(console.error);
}
