import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initiateCircleSdk, createWalletSet, createWallet, getWalletBalance, getWallet } from '../src/lib/circle-server';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action } = req.query;

  try {
    switch (action) {
      case 'create':
        return handleCreate(req, res);
      case 'balance':
        return handleBalance(req, res);
      case 'get':
        return handleGet(req, res);
      default:
        return res.status(400).json({ error: 'Invalid action. Use: create, balance, get' });
    }
  } catch (error: any) {
    console.error('[Wallet API] Error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

async function handleCreate(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });

  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId required' });

  const sdk = initiateCircleSdk();

  // Create wallet set for this user (or reuse existing)
  const walletSetId = await createWalletSet(sdk, `user-${userId}`);

  // Create wallet on Arc Testnet (blockchain: ARC-TESTNET)
  const wallet = await createWallet(sdk, walletSetId, ['ARC-TESTNET']);

  return res.status(200).json({
    walletId: wallet.id,
    address: wallet.address,
    blockchain: wallet.blockchain,
  });
}

async function handleBalance(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET required' });

  const { walletId } = req.query;
  if (!walletId || typeof walletId !== 'string') {
    return res.status(400).json({ error: 'walletId required' });
  }

  const sdk = initiateCircleSdk();
  const balances = await getWalletBalance(sdk, walletId);

  return res.status(200).json({ balances });
}

async function handleGet(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET required' });

  const { walletId } = req.query;
  if (!walletId || typeof walletId !== 'string') {
    return res.status(400).json({ error: 'walletId required' });
  }

  const sdk = initiateCircleSdk();
  const wallet = await getWallet(sdk, walletId);

  return res.status(200).json({
    walletId: wallet.id,
    address: wallet.address,
    blockchain: wallet.blockchain,
    state: wallet.state,
  });
}
