import type { VercelRequest, VercelResponse } from '@vercel/node';
import { circlePost, circleGet } from './_lib/circle';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action } = req.query;

  try {
    switch (action) {
      case 'create':
        return await handleCreate(req, res);
      case 'balance':
        return await handleBalance(req, res);
      case 'get':
        return await handleGet(req, res);
      case 'health':
        return res.status(200).json({
          ok: true,
          hasApiKey: !!process.env.CircleAPI,
          hasEntitySecret: !!process.env.CIRCLE_ENTITY_SECRET,
        });
      default:
        return res.status(400).json({ error: 'Invalid action. Use: create, balance, get, health' });
    }
  } catch (error: any) {
    console.error('[Wallet API] Error:', error.message || error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

// --- Handlers ---

async function handleCreate(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });

  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId required' });

  const walletSetName = `user-${userId}`;

  // 1. Check for existing wallet set for this user
  const existingSets = await circleGet('/walletSets');
  const userSet = existingSets?.walletSets?.find(
    (s: any) => s.name === walletSetName
  );

  if (userSet) {
    // 2. Found existing set — get its wallets
    const existingWallets = await circleGet(`/wallets?walletSetId=${userSet.id}`);
    const wallets = existingWallets?.wallets || [];
    const sepoliaWallet = wallets.find((w: any) => w.blockchain === 'ETH-SEPOLIA');
    const arcWallet = wallets.find((w: any) => w.blockchain === 'ARC-TESTNET');

    // If missing ARC-TESTNET wallet, create it in the existing set
    if (sepoliaWallet && !arcWallet) {
      const arcData = await circlePost('/developer/wallets', {
        walletSetId: userSet.id,
        blockchains: ['ARC-TESTNET'],
        count: 1,
        accountType: 'EOA',
      });
      const newArcWallet = arcData?.wallets?.[0];
      return res.status(200).json({
        walletId: sepoliaWallet.id,
        arcWalletId: newArcWallet?.id || null,
        address: sepoliaWallet.address,
        blockchain: sepoliaWallet.blockchain,
        existing: true,
      });
    }

    if (sepoliaWallet) {
      return res.status(200).json({
        walletId: sepoliaWallet.id,
        arcWalletId: arcWallet?.id || null,
        address: sepoliaWallet.address,
        blockchain: sepoliaWallet.blockchain,
        existing: true,
      });
    }
  }

  // 3. No existing wallet — create new wallet set + wallets on both chains
  const wsData = await circlePost('/developer/walletSets', { name: walletSetName });
  const walletSetId = wsData?.walletSet?.id;
  if (!walletSetId) throw new Error('Failed to create wallet set');

  const wData = await circlePost('/developer/wallets', {
    walletSetId,
    blockchains: ['ETH-SEPOLIA', 'ARC-TESTNET'],
    count: 1,
    accountType: 'EOA',
  });
  const wallets = wData?.wallets || [];
  const sepoliaWallet = wallets.find((w: any) => w.blockchain === 'ETH-SEPOLIA');
  const arcWallet = wallets.find((w: any) => w.blockchain === 'ARC-TESTNET');
  if (!sepoliaWallet) throw new Error('Failed to create wallet');

  return res.status(200).json({
    walletId: sepoliaWallet.id,
    arcWalletId: arcWallet?.id || null,
    address: sepoliaWallet.address,
    blockchain: sepoliaWallet.blockchain,
    existing: false,
  });
}

async function handleBalance(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET required' });

  const { walletId } = req.query;
  if (!walletId || typeof walletId !== 'string') return res.status(400).json({ error: 'walletId required' });

  const data = await circleGet(`/wallets/${walletId}/balances`);
  return res.status(200).json({ balances: data?.tokenBalances || [] });
}

async function handleGet(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET required' });

  const { walletId } = req.query;
  if (!walletId || typeof walletId !== 'string') return res.status(400).json({ error: 'walletId required' });

  const data = await circleGet(`/wallets/${walletId}`);
  const wallet = data?.wallet;
  if (!wallet) throw new Error('Wallet not found');

  return res.status(200).json({
    walletId: wallet.id,
    address: wallet.address,
    blockchain: wallet.blockchain,
    state: wallet.state,
  });
}
