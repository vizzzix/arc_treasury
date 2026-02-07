import type { VercelRequest, VercelResponse } from '@vercel/node';
import { circlePost, circleGet, CIRCLE_API_BASE } from './lib/circle';

// Contract addresses on Arc Testnet
const TREASURY_VAULT = '0x17ca5232415430bC57F646A72fD15634807bF729';
const STABLECOIN_SWAP = '0x3a5964ce5cd8b09e55af9323a894e78bdd7f04bf';
const EURC_ADDRESS = '0x742b2d045d430fe718b57046645ba33295914b69';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action } = req.query;

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
      case 'tx-status':
        return await handleTxStatus(req, res);
      default:
        return res.status(400).json({
          error: 'Invalid action. Use: deposit-usdc, deposit-eurc, withdraw-usdc, withdraw-eurc, swap-usdc-eurc, swap-eurc-usdc, tx-status',
        });
    }
  } catch (error: any) {
    console.error('[Vault API] Error:', error.message || error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

// --- Deposit USDC (native, payable) ---
// deposit(uint256) — payable, USDC 18 decimals, msg.value = amount

async function handleDepositUsdc(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });

  const { walletId, amount } = req.body;
  if (!walletId || !amount) return res.status(400).json({ error: 'walletId and amount required' });

  const parsedAmount = parseFloat(amount);
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({ error: 'Invalid amount' });
  }

  // USDC is native on Arc (18 decimals) — convert to wei string
  const amountWei = BigInt(Math.round(parsedAmount * 1e18)).toString();

  console.log(`[Vault] Deposit USDC: wallet=${walletId}, amount=${amount}, wei=${amountWei}`);

  const result = await circlePost('/developer/transactions/contractExecution', {
    walletId,
    contractAddress: TREASURY_VAULT,
    abiFunctionSignature: 'deposit(uint256)',
    abiParameters: [amountWei],
    amount: amount, // Native USDC amount for msg.value
    feeLevel: 'HIGH',
  });

  console.log('[Vault] Deposit USDC result:', JSON.stringify(result));

  return res.status(200).json({
    transactionId: result?.id || result?.transactionId,
    state: result?.state,
  });
}

// --- Deposit EURC (ERC20, needs approve first) ---
// Step 1: approve(address,uint256) on EURC
// Step 2: depositEURC(uint256) on vault — EURC 6 decimals

async function handleDepositEurc(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });

  const { walletId, amount } = req.body;
  if (!walletId || !amount) return res.status(400).json({ error: 'walletId and amount required' });

  const parsedAmount = parseFloat(amount);
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({ error: 'Invalid amount' });
  }

  // EURC uses 6 decimals
  const amountMicro = BigInt(Math.round(parsedAmount * 1e6)).toString();
  // Approve 10x for future deposits
  const approveAmount = (BigInt(amountMicro) * 10n).toString();

  console.log(`[Vault] Deposit EURC: wallet=${walletId}, amount=${amount}, micro=${amountMicro}`);

  // Step 1: Approve EURC
  const approveResult = await circlePost('/developer/transactions/contractExecution', {
    walletId,
    contractAddress: EURC_ADDRESS,
    abiFunctionSignature: 'approve(address,uint256)',
    abiParameters: [TREASURY_VAULT, approveAmount],
    feeLevel: 'HIGH',
  });

  const approveTxId = approveResult?.id || approveResult?.transactionId;
  console.log('[Vault] EURC approve submitted:', approveTxId);

  // Wait for approve to complete
  await waitForCircleTx(approveTxId);

  // Step 2: Deposit EURC
  const depositResult = await circlePost('/developer/transactions/contractExecution', {
    walletId,
    contractAddress: TREASURY_VAULT,
    abiFunctionSignature: 'depositEURC(uint256)',
    abiParameters: [amountMicro],
    feeLevel: 'HIGH',
  });

  console.log('[Vault] Deposit EURC result:', JSON.stringify(depositResult));

  return res.status(200).json({
    transactionId: depositResult?.id || depositResult?.transactionId,
    state: depositResult?.state,
  });
}

// --- Withdraw USDC ---
// withdraw(uint256) — shares in 18 decimals

async function handleWithdrawUsdc(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });

  const { walletId, shares } = req.body;
  if (!walletId || !shares) return res.status(400).json({ error: 'walletId and shares required' });

  console.log(`[Vault] Withdraw USDC: wallet=${walletId}, shares=${shares}`);

  const result = await circlePost('/developer/transactions/contractExecution', {
    walletId,
    contractAddress: TREASURY_VAULT,
    abiFunctionSignature: 'withdraw(uint256)',
    abiParameters: [shares], // Raw shares string in 18 decimals
    feeLevel: 'HIGH',
  });

  console.log('[Vault] Withdraw USDC result:', JSON.stringify(result));

  return res.status(200).json({
    transactionId: result?.id || result?.transactionId,
    state: result?.state,
  });
}

// --- Withdraw EURC ---
// withdrawEURC(uint256) — shares in 18 decimals

async function handleWithdrawEurc(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });

  const { walletId, shares } = req.body;
  if (!walletId || !shares) return res.status(400).json({ error: 'walletId and shares required' });

  console.log(`[Vault] Withdraw EURC: wallet=${walletId}, shares=${shares}`);

  const result = await circlePost('/developer/transactions/contractExecution', {
    walletId,
    contractAddress: TREASURY_VAULT,
    abiFunctionSignature: 'withdrawEURC(uint256)',
    abiParameters: [shares], // Raw shares string in 18 decimals
    feeLevel: 'HIGH',
  });

  console.log('[Vault] Withdraw EURC result:', JSON.stringify(result));

  return res.status(200).json({
    transactionId: result?.id || result?.transactionId,
    state: result?.state,
  });
}

// --- Swap USDC → EURC (payable) ---
// swapUsdcForEurc(uint256 minEurcOut) — payable, value = USDC 18 dec, minOut 6 dec

async function handleSwapUsdcForEurc(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });

  const { walletId, amount, minOutput } = req.body;
  if (!walletId || !amount) return res.status(400).json({ error: 'walletId and amount required' });

  const parsedAmount = parseFloat(amount);
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({ error: 'Invalid amount' });
  }

  // minOutput in EURC 6 decimals
  const minOutputMicro = minOutput
    ? BigInt(Math.round(parseFloat(minOutput) * 1e6)).toString()
    : '0';

  console.log(`[Vault] Swap USDC→EURC: wallet=${walletId}, amount=${amount}, minOutput=${minOutputMicro}`);

  const result = await circlePost('/developer/transactions/contractExecution', {
    walletId,
    contractAddress: STABLECOIN_SWAP,
    abiFunctionSignature: 'swapUsdcForEurc(uint256)',
    abiParameters: [minOutputMicro],
    amount: amount, // Native USDC for msg.value
    feeLevel: 'HIGH',
  });

  console.log('[Vault] Swap USDC→EURC result:', JSON.stringify(result));

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

  const { walletId, amount, minOutput } = req.body;
  if (!walletId || !amount) return res.status(400).json({ error: 'walletId and amount required' });

  const parsedAmount = parseFloat(amount);
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({ error: 'Invalid amount' });
  }

  // EURC in 6 decimals
  const amountMicro = BigInt(Math.round(parsedAmount * 1e6)).toString();
  const approveAmount = (BigInt(amountMicro) * 10n).toString();

  // minOutput in USDC 18 decimals
  const minOutputWei = minOutput
    ? BigInt(Math.round(parseFloat(minOutput) * 1e18)).toString()
    : '0';

  console.log(`[Vault] Swap EURC→USDC: wallet=${walletId}, amount=${amount}, minOutput=${minOutputWei}`);

  // Step 1: Approve EURC for StablecoinSwap
  const approveResult = await circlePost('/developer/transactions/contractExecution', {
    walletId,
    contractAddress: EURC_ADDRESS,
    abiFunctionSignature: 'approve(address,uint256)',
    abiParameters: [STABLECOIN_SWAP, approveAmount],
    feeLevel: 'HIGH',
  });

  const approveTxId = approveResult?.id || approveResult?.transactionId;
  console.log('[Vault] EURC approve for swap submitted:', approveTxId);

  await waitForCircleTx(approveTxId);

  // Step 2: Swap
  const result = await circlePost('/developer/transactions/contractExecution', {
    walletId,
    contractAddress: STABLECOIN_SWAP,
    abiFunctionSignature: 'swapEurcForUsdc(uint256,uint256)',
    abiParameters: [amountMicro, minOutputWei],
    feeLevel: 'HIGH',
  });

  console.log('[Vault] Swap EURC→USDC result:', JSON.stringify(result));

  return res.status(200).json({
    transactionId: result?.id || result?.transactionId,
    state: result?.state,
  });
}

// --- Transaction status ---

async function handleTxStatus(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET required' });

  const { txId } = req.query;
  if (!txId || typeof txId !== 'string') return res.status(400).json({ error: 'txId required' });

  const apiKey = process.env.CircleAPI;
  if (!apiKey) throw new Error('Missing CircleAPI');

  const paths = [
    `/transactions/${txId}`,
    `/developer/transactions/${txId}`,
  ];

  for (const path of paths) {
    const url = `${CIRCLE_API_BASE}${path}`;
    try {
      const r = await fetch(url, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });
      const data = await r.json();

      if (!r.ok) continue;

      const inner = data.data;
      const tx = inner?.transaction || inner;

      return res.status(200).json({
        id: tx?.id,
        state: tx?.state,
        txHash: tx?.txHash,
        errorReason: tx?.errorReason,
      });
    } catch (e: any) {
      console.warn(`[Vault] tx-status ${path} error:`, e.message);
    }
  }

  return res.status(502).json({ error: 'Could not fetch transaction status from Circle' });
}

// --- Internal helper: wait for Circle tx to complete ---

async function waitForCircleTx(txId: string, maxAttempts = 30): Promise<void> {
  const apiKey = process.env.CircleAPI;
  if (!apiKey) throw new Error('Missing CircleAPI');

  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 2000));

    const paths = [`/transactions/${txId}`, `/developer/transactions/${txId}`];
    for (const path of paths) {
      try {
        const r = await fetch(`${CIRCLE_API_BASE}${path}`, {
          headers: { 'Authorization': `Bearer ${apiKey}` },
        });
        if (!r.ok) continue;
        const data = await r.json();
        const tx = data.data?.transaction || data.data;

        if (tx?.state === 'COMPLETE' || tx?.state === 'CONFIRMED') return;
        if (tx?.state === 'FAILED' || tx?.state === 'CANCELLED') {
          throw new Error(`Transaction failed: ${tx.errorReason || tx.state}`);
        }
      } catch (e: any) {
        if (e.message?.includes('failed') || e.message?.includes('Transaction failed')) throw e;
      }
    }
  }
  throw new Error(`Transaction timeout after ${maxAttempts * 2}s`);
}
