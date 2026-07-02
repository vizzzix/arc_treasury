import type { VercelRequest, VercelResponse } from '@vercel/node';
import { circlePost, getClient, CIRCLE_API_BASE } from './_lib/circle';
import { trackTx, updateCircleTxStatus } from './_lib/supabase';
import { handleCors } from './_lib/cors';
import { checkRateLimit, getRateLimitHeaders } from './_lib/rateLimit';
import { isValidUUID, isValidAmount, isValidAddress, isValidUintString } from './_lib/validate';
import { authenticateUser, verifyWalletOwnership } from './_lib/auth';
import { captureApiError } from './_lib/sentry';

// Contract addresses on Arc Testnet
const TREASURY_VAULT = '0x17ca5232415430bC57F646A72fD15634807bF729';
const STABLECOIN_SWAP = '0x3a5964ce5cd8b09e55af9323a894e78bdd7f04bf';
const EURC_ADDRESS = '0x742b2d045d430fe718b57046645ba33295914b69';
const EARLY_BADGE = '0xb26a5b1d783646a7236ca956f2e954e002bf8d13';

const ARC_RPC = 'https://rpc.testnet.arc.network';

async function getEurcBalance(walletAddress: string): Promise<bigint> {
  const balanceOfSelector = '0x70a08231';
  const paddedAddr = walletAddress.toLowerCase().replace('0x', '').padStart(64, '0');
  const res = await fetch(ARC_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0', method: 'eth_call', id: 1,
      params: [{ to: EURC_ADDRESS, data: `${balanceOfSelector}${paddedAddr}` }, 'latest'],
    }),
  });
  const data = await res.json();
  if (data.error || !data.result) return 0n;
  return BigInt(data.result);
}

// Safe amount→wei conversion without floating-point overflow
function toWei(amount: string, decimals: number): string {
  const [whole = '0', frac = ''] = amount.replace(/,/g, '').split('.');
  const paddedFrac = frac.padEnd(decimals, '0').slice(0, decimals);
  return BigInt(whole + paddedFrac).toString();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;

  const { action } = req.query;

  const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || 'unknown';
  // tx-status is polled every few seconds by useServerVault during an operation,
  // so it gets its own higher-capacity bucket; mutating actions stay strict.
  const isStatusPoll = action === 'tx-status';
  const rlKey = isStatusPoll ? `vault-status:${clientIp}` : `vault:${clientIp}`;
  const rlLimit = isStatusPoll ? 60 : 30;
  if (!await checkRateLimit(rlKey, rlLimit, 60_000)) {
    const headers = getRateLimitHeaders(rlKey, rlLimit);
    Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
    return res.status(429).json({ error: 'Too many requests' });
  }

  // Validate walletId format on all POST requests (all financial operations)
  if (req.method === 'POST' && req.body?.walletId && !isValidUUID(req.body.walletId)) {
    return res.status(400).json({ error: 'Invalid walletId format' });
  }
  if (req.method === 'POST' && req.body?.walletAddress && !isValidAddress(req.body.walletAddress)) {
    return res.status(400).json({ error: 'Invalid walletAddress format' });
  }

  // JWT auth + wallet ownership verification for financial operations
  if (req.method === 'POST' && req.body?.walletId) {
    const authUser = await authenticateUser(req);
    if (!authUser) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const ownsWallet = await verifyWalletOwnership(authUser.userId, req.body.walletId);
    if (!ownsWallet) {
      return res.status(403).json({ error: 'Wallet does not belong to authenticated user' });
    }
  }

  try {
    switch (action) {
      case 'deposit-usdc':
        return await handleDepositUsdc(req, res);
      case 'deposit-eurc':
        return await handleDepositEurc(req, res);
      case 'withdraw-usdc':
        return await handleWithdrawUsdc(req, res);
      case 'withdraw-eurc':
        return await handleWithdrawEurc(req, res);
      case 'swap-usdc-eurc':
        return await handleSwapUsdcForEurc(req, res);
      case 'swap-eurc-usdc':
        return await handleSwapEurcForUsdc(req, res);
      case 'deposit-locked-usdc':
        return await handleDepositLockedUsdc(req, res);
      case 'deposit-locked-eurc':
        return await handleDepositLockedEurc(req, res);
      case 'add-liquidity':
        return await handleAddLiquidity(req, res);
      case 'remove-liquidity':
        return await handleRemoveLiquidity(req, res);
      case 'withdraw-locked':
        return await handleWithdrawLocked(req, res);
      case 'early-withdraw-locked':
        return await handleEarlyWithdrawLocked(req, res);
      case 'claim-locked-yield':
        return await handleClaimLockedYield(req, res);
      case 'mint-badge':
        return await handleMintBadge(req, res);
      case 'tx-status':
        return await handleTxStatus(req, res);
      default:
        return res.status(400).json({
          error: 'Invalid action',
        });
    }
  } catch (error: any) {
    console.error('[Vault API] Error:', error.message || error);
    captureApiError(error, { endpoint: 'vault', action: String(action) });
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// --- Deposit USDC (native, payable) ---
// deposit(uint256) — payable, USDC 18 decimals, msg.value = amount

async function handleDepositUsdc(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });

  const { walletId, amount, walletAddress } = req.body;
  if (!walletId || !amount) return res.status(400).json({ error: 'walletId and amount required' });

  if (!isValidAmount(amount)) {
    return res.status(400).json({ error: 'Invalid amount' });
  }

  // USDC is native on Arc (18 decimals) — convert to wei string
  const amountWei = toWei(amount, 18);

  console.log(`[Vault] Deposit USDC: amount=${amount}`);

  const result = await circlePost('/developer/transactions/contractExecution', {
    walletId,
    contractAddress: TREASURY_VAULT,
    abiFunctionSignature: 'deposit(uint256)',
    abiParameters: [amountWei],
    amount: amount, // Native USDC amount for msg.value
    feeLevel: 'HIGH',
  });

  console.log('[Vault] Deposit USDC: tx submitted');

  await trackTx(result, 'deposit-usdc', walletId, walletAddress, amount, 'USDC');

  return res.status(200).json({
    transactionId: result?.id || result?.transactionId,
    state: result?.state,
  });
}

// --- Deposit EURC (approve + deposit, 6 decimals) ---

async function handleDepositEurc(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });

  const { walletId, amount, walletAddress } = req.body;
  if (!walletId || !amount) return res.status(400).json({ error: 'walletId and amount required' });

  if (!isValidAmount(amount)) {
    return res.status(400).json({ error: 'Invalid amount' });
  }

  // EURC uses 6 decimals
  const amountMicro = toWei(amount, 6);
  // Approve 10x for future deposits
  const approveAmount = (BigInt(amountMicro) * 10n).toString();

  console.log(`[Vault] Deposit EURC: amount=${amount}`);

  // Pre-check: verify EURC balance
  if (walletAddress) {
    const balance = await getEurcBalance(walletAddress);
    if (balance < BigInt(amountMicro)) {
      const balanceFormatted = (Number(balance) / 1e6).toFixed(2);
      return res.status(400).json({
        error: `Insufficient EURC balance: ${balanceFormatted} EURC. Swap USDC → EURC first.`,
      });
    }
  }


  const approveResult = await circlePost('/developer/transactions/contractExecution', {
    walletId,
    contractAddress: EURC_ADDRESS,
    abiFunctionSignature: 'approve(address,uint256)',
    abiParameters: [TREASURY_VAULT, approveAmount],
    feeLevel: 'HIGH',
  });

  const approveTxId = approveResult?.id || approveResult?.transactionId;
  console.log('[Vault] EURC approve submitted');

  // Wait for approve to complete
  await waitForCircleTx(approveTxId);


  const depositResult = await circlePost('/developer/transactions/contractExecution', {
    walletId,
    contractAddress: TREASURY_VAULT,
    abiFunctionSignature: 'depositEURC(uint256)',
    abiParameters: [amountMicro],
    feeLevel: 'HIGH',
  });

  console.log('[Vault] Deposit EURC: tx submitted');

  await trackTx(depositResult, 'deposit-eurc', walletId, walletAddress, amount, 'EURC');

  return res.status(200).json({
    transactionId: depositResult?.id || depositResult?.transactionId,
    state: depositResult?.state,
  });
}

// --- Withdraw USDC ---
// withdraw(uint256) — shares in 18 decimals

async function handleWithdrawUsdc(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });

  const { walletId, shares, walletAddress } = req.body;
  if (!walletId || !shares) return res.status(400).json({ error: 'walletId and shares required' });
  if (!isValidUintString(shares)) return res.status(400).json({ error: 'Invalid shares' });

  console.log(`[Vault] Withdraw USDC: shares=${shares}`);

  const result = await circlePost('/developer/transactions/contractExecution', {
    walletId,
    contractAddress: TREASURY_VAULT,
    abiFunctionSignature: 'withdraw(uint256)',
    abiParameters: [shares], // Raw shares string in 18 decimals
    feeLevel: 'HIGH',
  });

  console.log('[Vault] Withdraw USDC: tx submitted');

  await trackTx(result, 'withdraw-usdc', walletId, walletAddress, shares, 'USDC');

  return res.status(200).json({
    transactionId: result?.id || result?.transactionId,
    state: result?.state,
  });
}

// --- Withdraw EURC ---
// withdrawEURC(uint256) — shares in 18 decimals

async function handleWithdrawEurc(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });

  const { walletId, shares, walletAddress } = req.body;
  if (!walletId || !shares) return res.status(400).json({ error: 'walletId and shares required' });
  if (!isValidUintString(shares)) return res.status(400).json({ error: 'Invalid shares' });

  console.log(`[Vault] Withdraw EURC: shares=${shares}`);

  const result = await circlePost('/developer/transactions/contractExecution', {
    walletId,
    contractAddress: TREASURY_VAULT,
    abiFunctionSignature: 'withdrawEURC(uint256)',
    abiParameters: [shares], // Raw shares string in 18 decimals
    feeLevel: 'HIGH',
  });

  console.log('[Vault] Withdraw EURC: tx submitted');

  await trackTx(result, 'withdraw-eurc', walletId, walletAddress, shares, 'EURC');

  return res.status(200).json({
    transactionId: result?.id || result?.transactionId,
    state: result?.state,
  });
}

// --- Swap USDC → EURC (payable) ---
// swapUsdcForEurc(uint256 minEurcOut) — payable, value = USDC 18 dec, minOut 6 dec

async function handleSwapUsdcForEurc(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });

  const { walletId, amount, minOutput, walletAddress } = req.body;
  if (!walletId || !amount) return res.status(400).json({ error: 'walletId and amount required' });

  if (!isValidAmount(amount)) {
    return res.status(400).json({ error: 'Invalid amount' });
  }

  // minOutput in EURC 6 decimals
  const minOutputMicro = minOutput
    ? toWei(minOutput, 6)
    : '0';

  console.log(`[Vault] Swap USDC→EURC: amount=${amount}`);

  const result = await circlePost('/developer/transactions/contractExecution', {
    walletId,
    contractAddress: STABLECOIN_SWAP,
    abiFunctionSignature: 'swapUsdcForEurc(uint256)',
    abiParameters: [minOutputMicro],
    amount: amount, // Native USDC for msg.value
    feeLevel: 'HIGH',
  });

  console.log('[Vault] Swap USDC→EURC: tx submitted');

  await trackTx(result, 'swap-usdc-eurc', walletId, walletAddress, amount, 'USDC');

  return res.status(200).json({
    transactionId: result?.id || result?.transactionId,
    state: result?.state,
  });
}

// --- Swap EURC → USDC (needs approve) ---
// approve EURC, then swapEurcForUsdc(uint256 eurcIn, uint256 minUsdcOut)
// eurcIn 6 dec, minUsdcOut 18 dec

async function handleSwapEurcForUsdc(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });

  const { walletId, amount, minOutput, walletAddress } = req.body;
  if (!walletId || !amount) return res.status(400).json({ error: 'walletId and amount required' });

  if (!isValidAmount(amount)) {
    return res.status(400).json({ error: 'Invalid amount' });
  }

  // EURC in 6 decimals
  const amountMicro = toWei(amount, 6);
  const approveAmount = (BigInt(amountMicro) * 10n).toString();

  // minOutput in USDC 18 decimals
  const minOutputWei = minOutput
    ? toWei(minOutput, 18)
    : '0';

  console.log(`[Vault] Swap EURC→USDC: amount=${amount}`);

  // Pre-check: verify EURC balance
  if (walletAddress) {
    const balance = await getEurcBalance(walletAddress);
    if (balance < BigInt(amountMicro)) {
      const balanceFormatted = (Number(balance) / 1e6).toFixed(2);
      return res.status(400).json({
        error: `Insufficient EURC balance: ${balanceFormatted} EURC`,
      });
    }
  }


  const approveResult = await circlePost('/developer/transactions/contractExecution', {
    walletId,
    contractAddress: EURC_ADDRESS,
    abiFunctionSignature: 'approve(address,uint256)',
    abiParameters: [STABLECOIN_SWAP, approveAmount],
    feeLevel: 'HIGH',
  });

  const approveTxId = approveResult?.id || approveResult?.transactionId;
  console.log('[Vault] EURC approve for swap submitted');

  await waitForCircleTx(approveTxId);


  const result = await circlePost('/developer/transactions/contractExecution', {
    walletId,
    contractAddress: STABLECOIN_SWAP,
    abiFunctionSignature: 'swapEurcForUsdc(uint256,uint256)',
    abiParameters: [amountMicro, minOutputWei],
    feeLevel: 'HIGH',
  });

  console.log('[Vault] Swap EURC→USDC: tx submitted');

  await trackTx(result, 'swap-eurc-usdc', walletId, walletAddress, amount, 'EURC');

  return res.status(200).json({
    transactionId: result?.id || result?.transactionId,
    state: result?.state,
  });
}

// --- Deposit Locked USDC (payable) ---
// depositLockedUSDC(uint256 amount, uint256 lockPeriodMonths) — payable, 18 decimals

async function handleDepositLockedUsdc(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });

  const { walletId, amount, lockPeriodMonths, walletAddress } = req.body;
  if (!walletId || !amount || !lockPeriodMonths) {
    return res.status(400).json({ error: 'walletId, amount and lockPeriodMonths required' });
  }

  if (!isValidAmount(amount)) {
    return res.status(400).json({ error: 'Invalid amount' });
  }

  const months = parseInt(lockPeriodMonths);
  if (![1, 3, 12].includes(months)) {
    return res.status(400).json({ error: 'lockPeriodMonths must be 1, 3, or 12' });
  }

  const amountWei = toWei(amount, 18);

  console.log(`[Vault] Deposit Locked USDC: amount=${amount}, months=${months}`);

  const result = await circlePost('/developer/transactions/contractExecution', {
    walletId,
    contractAddress: TREASURY_VAULT,
    abiFunctionSignature: 'depositLockedUSDC(uint256,uint8)',
    abiParameters: [amountWei, months.toString()],
    amount: amount,
    feeLevel: 'HIGH',
  });

  console.log('[Vault] Deposit Locked USDC: tx submitted');

  await trackTx(result, 'deposit-locked-usdc', walletId, walletAddress, amount, 'USDC', { lockPeriodMonths: months });

  return res.status(200).json({
    transactionId: result?.id || result?.transactionId,
    state: result?.state,
  });
}

// --- Deposit Locked EURC (ERC20, needs approve) ---
// approve EURC + depositLockedEURC(uint256 amount, uint256 lockPeriodMonths) — 6 decimals

async function handleDepositLockedEurc(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });

  const { walletId, amount, lockPeriodMonths, walletAddress } = req.body;
  if (!walletId || !amount || !lockPeriodMonths) {
    return res.status(400).json({ error: 'walletId, amount and lockPeriodMonths required' });
  }

  if (!isValidAmount(amount)) {
    return res.status(400).json({ error: 'Invalid amount' });
  }

  const months = parseInt(lockPeriodMonths);
  if (![1, 3, 12].includes(months)) {
    return res.status(400).json({ error: 'lockPeriodMonths must be 1, 3, or 12' });
  }

  const amountMicro = toWei(amount, 6);
  const approveAmount = (BigInt(amountMicro) * 10n).toString();

  console.log(`[Vault] Deposit Locked EURC: amount=${amount}, months=${months}`);

  // Pre-check: verify EURC balance
  if (walletAddress) {
    const balance = await getEurcBalance(walletAddress);
    if (balance < BigInt(amountMicro)) {
      const balanceFormatted = (Number(balance) / 1e6).toFixed(2);
      return res.status(400).json({
        error: `Insufficient EURC balance: ${balanceFormatted} EURC. Swap USDC → EURC first.`,
      });
    }
  }


  const approveResult = await circlePost('/developer/transactions/contractExecution', {
    walletId,
    contractAddress: EURC_ADDRESS,
    abiFunctionSignature: 'approve(address,uint256)',
    abiParameters: [TREASURY_VAULT, approveAmount],
    feeLevel: 'HIGH',
  });

  const approveTxId = approveResult?.id || approveResult?.transactionId;
  console.log('[Vault] EURC approve for locked deposit submitted');

  await waitForCircleTx(approveTxId);


  const depositResult = await circlePost('/developer/transactions/contractExecution', {
    walletId,
    contractAddress: TREASURY_VAULT,
    abiFunctionSignature: 'depositLockedEURC(uint256,uint8)',
    abiParameters: [amountMicro, months.toString()],
    feeLevel: 'HIGH',
  });

  console.log('[Vault] Deposit Locked EURC: tx submitted');

  await trackTx(depositResult, 'deposit-locked-eurc', walletId, walletAddress, amount, 'EURC', { lockPeriodMonths: months });

  return res.status(200).json({
    transactionId: depositResult?.id || depositResult?.transactionId,
    state: depositResult?.state,
  });
}

// --- Add Liquidity (USDC payable + EURC approve) ---
// approve EURC for StablecoinSwap, then addLiquidity(uint256 eurcAmount, uint256 minLpTokens) payable

async function handleAddLiquidity(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });

  const { walletId, usdcAmount, eurcAmount, walletAddress } = req.body;
  if (!walletId || !usdcAmount || !eurcAmount) {
    return res.status(400).json({ error: 'walletId, usdcAmount and eurcAmount required' });
  }

  if (!isValidAmount(usdcAmount) || !isValidAmount(eurcAmount)) {
    return res.status(400).json({ error: 'Invalid amounts' });
  }

  const eurcMicro = toWei(eurcAmount, 6);
  const approveAmount = (BigInt(eurcMicro) * 10n).toString();

  console.log(`[Vault] Add Liquidity: usdc=${usdcAmount}, eurc=${eurcAmount}`);

  // Pre-check: verify EURC balance
  if (walletAddress) {
    const balance = await getEurcBalance(walletAddress);
    if (balance < BigInt(eurcMicro)) {
      const balanceFormatted = (Number(balance) / 1e6).toFixed(2);
      return res.status(400).json({
        error: `Insufficient EURC balance: ${balanceFormatted} EURC`,
      });
    }
  }


  const approveResult = await circlePost('/developer/transactions/contractExecution', {
    walletId,
    contractAddress: EURC_ADDRESS,
    abiFunctionSignature: 'approve(address,uint256)',
    abiParameters: [STABLECOIN_SWAP, approveAmount],
    feeLevel: 'HIGH',
  });

  const approveTxId = approveResult?.id || approveResult?.transactionId;
  console.log('[Vault] EURC approve for addLiquidity submitted');

  await waitForCircleTx(approveTxId);


  const result = await circlePost('/developer/transactions/contractExecution', {
    walletId,
    contractAddress: STABLECOIN_SWAP,
    abiFunctionSignature: 'addLiquidity(uint256,uint256)',
    abiParameters: [eurcMicro, '0'],
    amount: usdcAmount, // Native USDC for msg.value
    feeLevel: 'HIGH',
  });

  console.log('[Vault] Add Liquidity: tx submitted');

  await trackTx(result, 'add-liquidity', walletId, walletAddress, usdcAmount, 'USDC', { eurcAmount });

  return res.status(200).json({
    transactionId: result?.id || result?.transactionId,
    state: result?.state,
  });
}

// --- Remove Liquidity ---
// removeLiquidity(uint256 lpTokens, uint256 minUsdcOut, uint256 minEurcOut)

async function handleRemoveLiquidity(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });

  const { walletId, lpAmount, walletAddress } = req.body;
  if (!walletId || !lpAmount) {
    return res.status(400).json({ error: 'walletId and lpAmount required' });
  }

  if (!isValidAmount(lpAmount)) {
    return res.status(400).json({ error: 'Invalid lpAmount' });
  }

  // LP tokens use 18 decimals
  const lpWei = toWei(lpAmount, 18);

  console.log(`[Vault] Remove Liquidity: lp=${lpAmount}`);

  const result = await circlePost('/developer/transactions/contractExecution', {
    walletId,
    contractAddress: STABLECOIN_SWAP,
    abiFunctionSignature: 'removeLiquidity(uint256,uint256,uint256)',
    abiParameters: [lpWei, '0', '0'],
    feeLevel: 'HIGH',
  });

  console.log('[Vault] Remove Liquidity: tx submitted');

  await trackTx(result, 'remove-liquidity', walletId, walletAddress, lpAmount, 'LP');

  return res.status(200).json({
    transactionId: result?.id || result?.transactionId,
    state: result?.state,
  });
}

// --- Withdraw Locked Position ---
// withdrawLocked(uint256 positionIndex) — nonpayable

async function handleWithdrawLocked(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });

  const { walletId, positionIndex, walletAddress } = req.body;
  if (!walletId || positionIndex === undefined) {
    return res.status(400).json({ error: 'walletId and positionIndex required' });
  }

  const idx = parseInt(positionIndex);
  if (!Number.isFinite(idx) || idx < 0) {
    return res.status(400).json({ error: 'Invalid positionIndex' });
  }

  console.log(`[Vault] Withdraw Locked: index=${idx}`);

  const result = await circlePost('/developer/transactions/contractExecution', {
    walletId,
    contractAddress: TREASURY_VAULT,
    abiFunctionSignature: 'withdrawLocked(uint256)',
    abiParameters: [idx.toString()],
    feeLevel: 'HIGH',
  });

  console.log('[Vault] Withdraw Locked: tx submitted');

  await trackTx(result, 'withdraw-locked', walletId, walletAddress, undefined, undefined, { positionIndex: idx });

  return res.status(200).json({
    transactionId: result?.id || result?.transactionId,
    state: result?.state,
  });
}

// --- Early Withdraw Locked Position (with penalty) ---
// earlyWithdrawLocked(uint256 positionIndex) — nonpayable

async function handleEarlyWithdrawLocked(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });

  const { walletId, positionIndex, walletAddress } = req.body;
  if (!walletId || positionIndex === undefined) {
    return res.status(400).json({ error: 'walletId and positionIndex required' });
  }

  const idx = parseInt(positionIndex);
  if (!Number.isFinite(idx) || idx < 0) {
    return res.status(400).json({ error: 'Invalid positionIndex' });
  }

  console.log(`[Vault] Early Withdraw Locked: index=${idx}`);

  const result = await circlePost('/developer/transactions/contractExecution', {
    walletId,
    contractAddress: TREASURY_VAULT,
    abiFunctionSignature: 'earlyWithdrawLocked(uint256)',
    abiParameters: [idx.toString()],
    feeLevel: 'HIGH',
  });

  console.log('[Vault] Early Withdraw Locked: tx submitted');

  await trackTx(result, 'early-withdraw-locked', walletId, walletAddress, undefined, undefined, { positionIndex: idx });

  return res.status(200).json({
    transactionId: result?.id || result?.transactionId,
    state: result?.state,
  });
}

// --- Claim Locked Yield ---
// claimLockedYield(uint256 positionIndex) — nonpayable

async function handleClaimLockedYield(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });

  const { walletId, positionIndex, walletAddress } = req.body;
  if (!walletId || positionIndex === undefined) {
    return res.status(400).json({ error: 'walletId and positionIndex required' });
  }

  const idx = parseInt(positionIndex);
  if (!Number.isFinite(idx) || idx < 0) {
    return res.status(400).json({ error: 'Invalid positionIndex' });
  }

  console.log(`[Vault] Claim Locked Yield: index=${idx}`);

  const result = await circlePost('/developer/transactions/contractExecution', {
    walletId,
    contractAddress: TREASURY_VAULT,
    abiFunctionSignature: 'claimLockedYield(uint256)',
    abiParameters: [idx.toString()],
    feeLevel: 'HIGH',
  });

  console.log('[Vault] Claim Locked Yield: tx submitted');

  await trackTx(result, 'claim-locked-yield', walletId, walletAddress, undefined, undefined, { positionIndex: idx });

  return res.status(200).json({
    transactionId: result?.id || result?.transactionId,
    state: result?.state,
  });
}

// --- Mint Early Supporter Badge ---
// mint() — nonpayable, no parameters

async function handleMintBadge(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });

  const { walletId, walletAddress } = req.body;
  if (!walletId) return res.status(400).json({ error: 'walletId required' });

  console.log('[Vault] Mint Badge');

  const result = await circlePost('/developer/transactions/contractExecution', {
    walletId,
    contractAddress: EARLY_BADGE,
    abiFunctionSignature: 'mint()',
    abiParameters: [],
    feeLevel: 'HIGH',
  });

  console.log('[Vault] Mint Badge: tx submitted');

  await trackTx(result, 'mint-badge', walletId, walletAddress);

  return res.status(200).json({
    transactionId: result?.id || result?.transactionId,
    state: result?.state,
  });
}

// --- Transaction status (uses Circle SDK) ---

async function handleTxStatus(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET required' });

  const { txId } = req.query;
  if (!txId || typeof txId !== 'string') return res.status(400).json({ error: 'txId required' });
  if (!isValidUUID(txId)) return res.status(400).json({ error: 'Invalid txId format' });

  // Require authentication for transaction status queries
  const authUser = await authenticateUser(req);
  if (!authUser) return res.status(401).json({ error: 'Authentication required' });

  try {
    const client = getClient();
    const response = await client.getTransaction({ id: txId });
    const tx = response.data?.transaction;

    if (!tx) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    // Update Supabase on every poll (keeps Realtime fed even without webhooks)
    const state = tx.state || 'PENDING';
    if (state === 'COMPLETE' || state === 'CONFIRMED' || state === 'FAILED' || state === 'CANCELLED') {
      await updateCircleTxStatus(txId, state, tx.txHash, tx.errorReason);
    }

    return res.status(200).json({
      id: tx.id,
      state: tx.state,
      txHash: tx.txHash,
      errorReason: tx.errorReason,
    });
  } catch (e: any) {
    console.warn(`[Vault] tx-status error:`, e.message);
    return res.status(502).json({ error: 'Could not fetch transaction status from Circle' });
  }
}

// --- Internal helper: wait for Circle tx to complete (uses SDK) ---

async function waitForCircleTx(txId: string, maxAttempts = 30): Promise<void> {
  const client = getClient();

  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 2000));

    try {
      const response = await client.getTransaction({ id: txId });
      const tx = response.data?.transaction;

      if (tx?.state === 'COMPLETE' || tx?.state === 'CONFIRMED') return;
      if (tx?.state === 'FAILED' || tx?.state === 'CANCELLED') {
        throw new Error(`Transaction failed: ${tx.errorReason || tx.state}`);
      }
    } catch (e: any) {
      if (e.message?.includes('failed') || e.message?.includes('Transaction failed')) throw e;
    }
  }
  throw new Error(`Transaction timeout after ${maxAttempts * 2}s`);
}
