/**
 * Pool Rebalance Bot
 * Automatically rebalances the USDC/EURC pool when it deviates from target ratio
 * Uses arbitrage swaps to bring pool back to equilibrium
 */

const { createPublicClient, createWalletClient, http, formatEther, formatUnits, parseEther, parseUnits } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
require('dotenv').config();

// Arc Testnet config
const ARC_TESTNET = {
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.testnet.arc.network'] } },
};

// Retry helper
async function withRetry(fn, retries = 3, delay = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === retries - 1) throw error;
      console.log(`[Retry] Attempt ${i + 1} failed, retrying in ${delay/1000}s...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

// Contract addresses
const STABLECOIN_SWAP = '0x3a5964ce5cd8b09e55af9323a894e78bdd7f04bf';
const EURC_ADDRESS = '0xf88AC22c2c276FB6F345D5F3A63F7b50CD1Cf991';

// Fixer.io API for live EUR/USD rate
const FIXER_API_KEY = process.env.FIXER_API_KEY || '80f6690ad5c8e6aafe4373f4a0ce6e96';

// Rebalance config
const DEVIATION_THRESHOLD = 0.05; // 5% deviation triggers rebalance
const MAX_SWAP_PERCENT = 0.10; // Max 10% of pool per swap
const MIN_SWAP_AMOUNT = 100; // Minimum $100 swap
const CHECK_INTERVAL = 5 * 60 * 1000; // Check every 5 minutes

// ABIs
const SWAP_ABI = [
  { inputs: [], name: 'getReserves', outputs: [{ name: '_usdcReserve', type: 'uint256' }, { name: 'eurcReserve', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'exchangeRate', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'usdcIn', type: 'uint256' }], name: 'getEurcOut', outputs: [{ name: 'eurcOut', type: 'uint256' }, { name: 'fee', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'eurcIn', type: 'uint256' }], name: 'getUsdcOut', outputs: [{ name: 'usdcOut', type: 'uint256' }, { name: 'fee', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'minEurcOut', type: 'uint256' }], name: 'swapUsdcForEurc', outputs: [{ name: 'eurcOut', type: 'uint256' }], stateMutability: 'payable', type: 'function' },
  { inputs: [{ name: 'eurcIn', type: 'uint256' }, { name: 'minUsdcOut', type: 'uint256' }], name: 'swapEurcForUsdc', outputs: [{ name: 'usdcOut', type: 'uint256' }], stateMutability: 'nonpayable', type: 'function' },
];

const EURC_ABI = [
  { inputs: [{ name: 'account', type: 'address' }], name: 'balanceOf', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], name: 'approve', outputs: [{ name: '', type: 'bool' }], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], name: 'allowance', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
];

// Cache for EUR/USD rate
let cachedRate = { rate: 1.08, timestamp: 0 };
const RATE_CACHE_TTL = 60 * 60 * 1000; // 1 hour

async function fetchEurUsdRate() {
  // Check cache
  if (Date.now() - cachedRate.timestamp < RATE_CACHE_TTL) {
    return cachedRate.rate;
  }

  try {
    const response = await fetch(`https://data.fixer.io/api/latest?access_key=${FIXER_API_KEY}&symbols=USD`);
    const data = await response.json();

    if (data.success && data.rates?.USD) {
      cachedRate = { rate: data.rates.USD, timestamp: Date.now() };
      console.log(`[Rate] EUR/USD = ${cachedRate.rate}`);
      return cachedRate.rate;
    }
  } catch (error) {
    console.warn('[Rate] Failed to fetch, using cached:', error.message);
  }

  return cachedRate.rate;
}

async function getPoolState(publicClient) {
  const [reserves, contractRate] = await withRetry(async () => {
    return Promise.all([
      publicClient.readContract({ address: STABLECOIN_SWAP, abi: SWAP_ABI, functionName: 'getReserves' }),
      publicClient.readContract({ address: STABLECOIN_SWAP, abi: SWAP_ABI, functionName: 'exchangeRate' }),
    ]);
  });

  const [usdcReserve, eurcReserve] = reserves;
  const usdcAmount = Number(formatEther(usdcReserve));
  const eurcAmount = Number(formatUnits(eurcReserve, 6));
  const contractRateNum = Number(contractRate) / 1e6;

  // Get live rate
  const liveRate = await fetchEurUsdRate();

  // Calculate values in USD
  const usdcValueUsd = usdcAmount;
  const eurcValueUsd = eurcAmount * liveRate;
  const totalValueUsd = usdcValueUsd + eurcValueUsd;

  // Target: 50/50 split by USD value
  const targetUsdcUsd = totalValueUsd / 2;
  const targetEurcUsd = totalValueUsd / 2;

  // Current ratio
  const currentUsdcRatio = usdcValueUsd / totalValueUsd;
  const deviation = Math.abs(currentUsdcRatio - 0.5);

  return {
    usdcAmount,
    eurcAmount,
    usdcValueUsd,
    eurcValueUsd,
    totalValueUsd,
    targetUsdcUsd,
    targetEurcUsd,
    currentUsdcRatio,
    deviation,
    liveRate,
    contractRate: contractRateNum,
    needsRebalance: deviation > DEVIATION_THRESHOLD,
    direction: currentUsdcRatio > 0.5 ? 'USDC_TO_EURC' : 'EURC_TO_USDC',
  };
}

async function executeRebalance(publicClient, walletClient, account, poolState) {
  const { direction, usdcValueUsd, eurcValueUsd, targetUsdcUsd, liveRate, totalValueUsd } = poolState;

  if (direction === 'USDC_TO_EURC') {
    // Too much USDC, swap USDC -> EURC
    const excessUsd = usdcValueUsd - targetUsdcUsd;
    let swapAmountUsd = Math.min(excessUsd, totalValueUsd * MAX_SWAP_PERCENT);

    if (swapAmountUsd < MIN_SWAP_AMOUNT) {
      console.log(`[Rebalance] Swap amount $${swapAmountUsd.toFixed(2)} below minimum, skipping`);
      return false;
    }

    const swapAmountUsdc = swapAmountUsd; // 1 USDC = $1
    console.log(`[Rebalance] Swapping ${swapAmountUsdc.toFixed(2)} USDC -> EURC`);

    // Get quote
    const amountWei = parseEther(swapAmountUsdc.toFixed(6));
    const [eurcOut] = await publicClient.readContract({
      address: STABLECOIN_SWAP,
      abi: SWAP_ABI,
      functionName: 'getEurcOut',
      args: [amountWei],
    });

    // Allow 1% slippage
    const minEurcOut = eurcOut * 99n / 100n;

    // Execute swap
    const hash = await walletClient.writeContract({
      address: STABLECOIN_SWAP,
      abi: SWAP_ABI,
      functionName: 'swapUsdcForEurc',
      args: [minEurcOut],
      value: amountWei,
      account,
    });

    console.log(`[Rebalance] TX: ${hash}`);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log(`[Rebalance] Confirmed in block ${receipt.blockNumber}`);
    return true;

  } else {
    // Too much EURC, swap EURC -> USDC
    const excessUsd = eurcValueUsd - targetUsdcUsd;
    let swapAmountUsd = Math.min(excessUsd, totalValueUsd * MAX_SWAP_PERCENT);

    if (swapAmountUsd < MIN_SWAP_AMOUNT) {
      console.log(`[Rebalance] Swap amount $${swapAmountUsd.toFixed(2)} below minimum, skipping`);
      return false;
    }

    const swapAmountEurc = swapAmountUsd / liveRate;
    console.log(`[Rebalance] Swapping ${swapAmountEurc.toFixed(2)} EURC -> USDC`);

    const amountWei = parseUnits(swapAmountEurc.toFixed(6), 6);

    // Check and approve EURC if needed
    const allowance = await publicClient.readContract({
      address: EURC_ADDRESS,
      abi: EURC_ABI,
      functionName: 'allowance',
      args: [account.address, STABLECOIN_SWAP],
    });

    if (allowance < amountWei) {
      console.log('[Rebalance] Approving EURC...');
      const approveHash = await walletClient.writeContract({
        address: EURC_ADDRESS,
        abi: EURC_ABI,
        functionName: 'approve',
        args: [STABLECOIN_SWAP, amountWei * 2n],
        account,
      });
      await publicClient.waitForTransactionReceipt({ hash: approveHash });
    }

    // Get quote
    const [usdcOut] = await publicClient.readContract({
      address: STABLECOIN_SWAP,
      abi: SWAP_ABI,
      functionName: 'getUsdcOut',
      args: [amountWei],
    });

    // Allow 1% slippage
    const minUsdcOut = usdcOut * 99n / 100n;

    // Execute swap
    const hash = await walletClient.writeContract({
      address: STABLECOIN_SWAP,
      abi: SWAP_ABI,
      functionName: 'swapEurcForUsdc',
      args: [amountWei, minUsdcOut],
      account,
    });

    console.log(`[Rebalance] TX: ${hash}`);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log(`[Rebalance] Confirmed in block ${receipt.blockNumber}`);
    return true;
  }
}

async function checkAndRebalance() {
  const privateKey = process.env.PRIVATE_KEY_OPERATOR;
  if (!privateKey) {
    console.log('[Rebalance] PRIVATE_KEY_OPERATOR not set, skipping');
    return;
  }

  const account = privateKeyToAccount(privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`);

  const publicClient = createPublicClient({
    chain: ARC_TESTNET,
    transport: http(ARC_TESTNET.rpcUrls.default.http[0], { timeout: 30000 }),
  });

  const walletClient = createWalletClient({
    chain: ARC_TESTNET,
    transport: http(ARC_TESTNET.rpcUrls.default.http[0], { timeout: 30000 }),
  });

  try {
    const poolState = await getPoolState(publicClient);

    console.log('\n=== Pool State ===');
    console.log(`USDC: ${poolState.usdcAmount.toFixed(2)} ($${poolState.usdcValueUsd.toFixed(2)})`);
    console.log(`EURC: ${poolState.eurcAmount.toFixed(2)} ($${poolState.eurcValueUsd.toFixed(2)})`);
    console.log(`Total: $${poolState.totalValueUsd.toFixed(2)}`);
    console.log(`USDC Ratio: ${(poolState.currentUsdcRatio * 100).toFixed(1)}% (target: 50%)`);
    console.log(`Deviation: ${(poolState.deviation * 100).toFixed(2)}%`);
    console.log(`Live Rate: 1 EUR = $${poolState.liveRate.toFixed(4)}`);
    console.log(`Contract Rate: 1 EUR = $${poolState.contractRate.toFixed(4)}`);
    console.log('==================\n');

    if (poolState.needsRebalance) {
      console.log(`[Rebalance] Deviation ${(poolState.deviation * 100).toFixed(2)}% > threshold ${DEVIATION_THRESHOLD * 100}%`);
      console.log(`[Rebalance] Direction: ${poolState.direction}`);

      // Check operator balance
      const balance = await publicClient.getBalance({ address: account.address });
      const balanceUsdc = Number(formatEther(balance));
      console.log(`[Rebalance] Operator balance: ${balanceUsdc.toFixed(2)} USDC`);

      if (balanceUsdc < 10) {
        console.log('[Rebalance] Insufficient operator balance, skipping');
        return;
      }

      await executeRebalance(publicClient, walletClient, account, poolState);

      // Check new state
      const newState = await getPoolState(publicClient);
      console.log(`\n[Rebalance] New USDC ratio: ${(newState.currentUsdcRatio * 100).toFixed(1)}%`);
      console.log(`[Rebalance] New deviation: ${(newState.deviation * 100).toFixed(2)}%\n`);
    } else {
      console.log(`[Rebalance] Pool balanced (deviation ${(poolState.deviation * 100).toFixed(2)}% < threshold ${DEVIATION_THRESHOLD * 100}%)`);
    }
  } catch (error) {
    console.error('[Rebalance] Error:', error.message);
  }
}

async function runDaemon(interval = CHECK_INTERVAL) {
  console.log('=== Pool Rebalance Bot Started ===');
  console.log(`Check interval: ${interval / 1000}s`);
  console.log(`Deviation threshold: ${DEVIATION_THRESHOLD * 100}%`);
  console.log(`Max swap per rebalance: ${MAX_SWAP_PERCENT * 100}%`);
  console.log('==================================\n');

  // Initial check
  await checkAndRebalance();

  // Periodic checks
  setInterval(checkAndRebalance, interval);
}

async function runOnce() {
  await checkAndRebalance();
}

// CLI
const args = process.argv.slice(2);
if (args.includes('--daemon') || args.includes('-d')) {
  const interval = parseInt(args.find(a => a.startsWith('--interval='))?.split('=')[1] || '300') * 1000;
  runDaemon(interval).catch(console.error);
} else {
  runOnce().catch(console.error);
}
