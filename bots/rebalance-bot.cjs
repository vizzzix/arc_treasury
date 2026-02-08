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
const EURC_ADDRESS = '0x742b2D045D430FE718B57046645Ba33295914b69'; // SwapEURC token

// Exchange rate API (free alternatives)

// Rebalance config
const DEVIATION_THRESHOLD = 0.05; // 5% deviation triggers rebalance
const MAX_SWAP_PERCENT = 0.10; // Max 10% of pool per swap
const MIN_SWAP_AMOUNT = 100; // Minimum $100 swap
const CHECK_INTERVAL = 5 * 60 * 1000; // Check every 5 minutes

// ABIs
const SWAP_ABI = [
  { inputs: [], name: 'getReserves', outputs: [{ name: '_usdcReserve', type: 'uint256' }, { name: 'eurcReserve', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'exchangeRate', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'newRate', type: 'uint256' }], name: 'setExchangeRate', outputs: [], stateMutability: 'nonpayable', type: 'function' },
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

  // Try multiple free APIs in order
  const apis = [
    {
      name: 'exchangerate-api',
      url: 'https://api.exchangerate-api.com/v4/latest/EUR',
      parse: (data) => data.rates?.USD,
    },
    {
      name: 'frankfurter',
      url: 'https://api.frankfurter.app/latest?from=EUR&to=USD',
      parse: (data) => data.rates?.USD,
    },
    {
      name: 'floatrates',
      url: 'https://www.floatrates.com/daily/eur.json',
      parse: (data) => data.usd?.rate,
    },
  ];

  for (const api of apis) {
    try {
      const response = await fetch(api.url, { timeout: 5000 });
      const data = await response.json();
      const rate = api.parse(data);

      if (rate && rate > 0.5 && rate < 2) {
        cachedRate = { rate, timestamp: Date.now() };
        console.log(`[Rate] EUR/USD = ${rate.toFixed(4)} (from ${api.name})`);
        return rate;
      }
    } catch (error) {
      console.warn(`[Rate] ${api.name} failed:`, error.message);
    }
  }

  console.warn('[Rate] All APIs failed, using cached:', cachedRate.rate);
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

  // IMPORTANT: To reduce USDC in pool, we must BUY USDC with EURC (swapEurcForUsdc)
  // To reduce EURC in pool, we must BUY EURC with USDC (swapUsdcForEurc)

  if (direction === 'USDC_TO_EURC') {
    // Too much USDC in pool -> buy USDC with our EURC to drain USDC from pool
    const excessUsd = usdcValueUsd - targetUsdcUsd;
    let swapAmountUsd = Math.min(excessUsd, totalValueUsd * MAX_SWAP_PERCENT);

    if (swapAmountUsd < MIN_SWAP_AMOUNT) {
      console.log(`[Rebalance] Swap amount $${swapAmountUsd.toFixed(2)} below minimum, skipping`);
      return false;
    }

    // Check operator EURC balance
    const eurcBalance = await publicClient.readContract({
      address: EURC_ADDRESS,
      abi: EURC_ABI,
      functionName: 'balanceOf',
      args: [account.address],
    });
    const operatorEurc = Number(formatUnits(eurcBalance, 6));
    const swapAmountEurc = swapAmountUsd / liveRate;
    const maxEurcFromBalance = operatorEurc * 0.9; // Keep 10% reserve

    if (maxEurcFromBalance < swapAmountEurc) {
      swapAmountUsd = maxEurcFromBalance * liveRate;
    }

    if (swapAmountUsd < MIN_SWAP_AMOUNT) {
      console.log(`[Rebalance] Operator EURC balance too low (${operatorEurc.toFixed(2)} EURC), need more`);
      return false;
    }

    const finalSwapEurc = swapAmountUsd / liveRate;
    console.log(`[Rebalance] Swapping ${finalSwapEurc.toFixed(2)} EURC -> USDC to drain USDC from pool (balance: ${operatorEurc.toFixed(2)} EURC)`);

    const amountWei = parseUnits(finalSwapEurc.toFixed(6), 6);

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
        args: [STABLECOIN_SWAP, amountWei * 10n], // Approve 10x for future swaps
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

  } else {
    // Too much EURC in pool -> buy EURC with our USDC to drain EURC from pool
    const excessUsd = eurcValueUsd - targetUsdcUsd;
    let swapAmountUsd = Math.min(excessUsd, totalValueUsd * MAX_SWAP_PERCENT);

    // Check operator USDC balance
    const operatorBalance = await publicClient.getBalance({ address: account.address });
    const operatorUsdc = Number(formatEther(operatorBalance));
    const maxSwapFromBalance = operatorUsdc - 100; // Keep 100 USDC for gas

    if (maxSwapFromBalance < MIN_SWAP_AMOUNT) {
      console.log(`[Rebalance] Operator USDC balance too low (${operatorUsdc.toFixed(2)} USDC), need at least ${MIN_SWAP_AMOUNT + 100} USDC`);
      return false;
    }

    swapAmountUsd = Math.min(swapAmountUsd, maxSwapFromBalance);

    if (swapAmountUsd < MIN_SWAP_AMOUNT) {
      console.log(`[Rebalance] Swap amount $${swapAmountUsd.toFixed(2)} below minimum, skipping`);
      return false;
    }

    const swapAmountUsdc = swapAmountUsd; // 1 USDC = $1
    console.log(`[Rebalance] Swapping ${swapAmountUsdc.toFixed(2)} USDC -> EURC to drain EURC from pool (balance: ${operatorUsdc.toFixed(2)} USDC)`);

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
  }
}

// Update exchange rate in contract if it differs from live rate
async function updateExchangeRateIfNeeded(publicClient, walletClient, account, liveRate, contractRate) {
  const rateDiff = Math.abs(liveRate - contractRate) / contractRate;
  const RATE_THRESHOLD = 0.005; // 0.5% difference triggers update

  if (rateDiff > RATE_THRESHOLD) {
    console.log(`[Rate] Contract rate ${contractRate.toFixed(4)} differs from live ${liveRate.toFixed(4)} by ${(rateDiff * 100).toFixed(2)}%`);

    // Convert to contract format (6 decimals)
    const newRateWei = BigInt(Math.round(liveRate * 1e6));

    try {
      const hash = await walletClient.writeContract({
        address: STABLECOIN_SWAP,
        abi: SWAP_ABI,
        functionName: 'setExchangeRate',
        args: [newRateWei],
        account,
      });

      console.log(`[Rate] Updating exchange rate TX: ${hash}`);
      await publicClient.waitForTransactionReceipt({ hash });
      console.log(`[Rate] Exchange rate updated to ${liveRate.toFixed(4)}`);
      return true;
    } catch (error) {
      console.error('[Rate] Failed to update exchange rate:', error.message);
      return false;
    }
  }

  return false;
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

    // Update exchange rate if needed
    await updateExchangeRateIfNeeded(publicClient, walletClient, account, poolState.liveRate, poolState.contractRate);

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
