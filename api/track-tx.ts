import type { VercelRequest, VercelResponse } from '@vercel/node';
import { insertCircleTx, updateCircleTxStatus, insertSwapTx, insertLiquidityEvent } from './_lib/supabase';
import { handleCors } from './_lib/cors';

const VALID_TX_TYPES = new Set([
  'deposit-usdc', 'deposit-eurc',
  'withdraw-usdc', 'withdraw-eurc',
  'swap-usdc-eurc', 'swap-eurc-usdc',
  'deposit-locked-usdc', 'deposit-locked-eurc',
  'add-liquidity', 'remove-liquidity',
  'withdraw-locked', 'early-withdraw-locked',
  'claim-locked-yield', 'mint-badge',
  'bridge-approve', 'bridge-burn', 'bridge-claim',
  'approve',
]);

const TX_HASH_REGEX = /^0x[a-fA-F0-9]{64}$/;
const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;

  const { action } = req.query;

  try {
    switch (action) {
      case 'track':
        return await handleTrack(req, res);
      case 'update-status':
        return await handleUpdateStatus(req, res);
      case 'track-swap':
        return await handleTrackSwap(req, res);
      case 'track-liquidity':
        return await handleTrackLiquidity(req, res);
      default:
        return res.status(400).json({ error: 'Invalid action. Use: track, update-status, track-swap, track-liquidity' });
    }
  } catch (error: any) {
    console.error('[TrackTx API] Error:', error.message || error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function handleTrack(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });

  const { txHash, txType, walletAddress, amount, currency, status } = req.body;

  if (!txHash || !TX_HASH_REGEX.test(txHash)) {
    return res.status(400).json({ error: 'Valid txHash required' });
  }
  if (!txType || !VALID_TX_TYPES.has(txType)) {
    return res.status(400).json({ error: 'Valid txType required' });
  }
  if (!walletAddress || !ADDRESS_REGEX.test(walletAddress)) {
    return res.status(400).json({ error: 'Valid walletAddress required' });
  }

  await insertCircleTx({
    circle_tx_id: txHash.toLowerCase(),
    tx_type: txType,
    status: status || 'SENT',
    wallet_address: walletAddress.toLowerCase(),
    wallet_id: 'metamask',
    tx_hash: txHash.toLowerCase(),
    amount,
    currency,
  });

  return res.status(200).json({ ok: true });
}

async function handleTrackSwap(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });

  const { txHash, walletAddress, amountUsd, tokenIn, tokenOut } = req.body;

  if (!txHash || !TX_HASH_REGEX.test(txHash)) {
    return res.status(400).json({ error: 'Valid txHash required' });
  }
  if (!walletAddress || !ADDRESS_REGEX.test(walletAddress)) {
    return res.status(400).json({ error: 'Valid walletAddress required' });
  }

  await insertSwapTx({
    tx_hash: txHash.toLowerCase(),
    wallet_address: walletAddress.toLowerCase(),
    amount_usd: Number(amountUsd) || 0,
    token_in: tokenIn || 'USDC',
    token_out: tokenOut || 'EURC',
  });

  return res.status(200).json({ ok: true });
}

async function handleTrackLiquidity(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });

  const { txHash, walletAddress, amountUsd, action } = req.body;

  if (!txHash || !TX_HASH_REGEX.test(txHash)) {
    return res.status(400).json({ error: 'Valid txHash required' });
  }
  if (!walletAddress || !ADDRESS_REGEX.test(walletAddress)) {
    return res.status(400).json({ error: 'Valid walletAddress required' });
  }
  if (!action || !['add', 'remove'].includes(action)) {
    return res.status(400).json({ error: 'action must be add or remove' });
  }

  await insertLiquidityEvent({
    tx_hash: txHash.toLowerCase(),
    wallet_address: walletAddress.toLowerCase(),
    amount_usd: Number(amountUsd) || 0,
    action,
  });

  return res.status(200).json({ ok: true });
}

async function handleUpdateStatus(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });

  const { txHash, status, errorReason } = req.body;

  if (!txHash || !TX_HASH_REGEX.test(txHash)) {
    return res.status(400).json({ error: 'Valid txHash required' });
  }
  if (!status || !['COMPLETE', 'FAILED'].includes(status)) {
    return res.status(400).json({ error: 'status must be COMPLETE or FAILED' });
  }

  await updateCircleTxStatus(txHash.toLowerCase(), status, undefined, errorReason);

  return res.status(200).json({ ok: true });
}
