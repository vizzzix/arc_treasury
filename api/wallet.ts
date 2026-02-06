import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';

const CIRCLE_API_BASE = 'https://api.circle.com/v1/w3s';

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

// --- Circle API helpers (direct REST, no SDK) ---

async function getCirclePublicKey(apiKey: string): Promise<string> {
  const res = await fetch(`${CIRCLE_API_BASE}/config/entity/publicKey`, {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new Error(`Failed to get public key: ${res.status}`);
  const data = await res.json();
  return data.data.publicKey;
}

function encryptEntitySecret(entitySecret: string, publicKeyPem: string): string {
  const buf = Buffer.from(entitySecret, 'hex');
  const encrypted = crypto.publicEncrypt(
    { key: publicKeyPem, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
    buf
  );
  return encrypted.toString('base64');
}

async function circlePost(path: string, body: any) {
  const apiKey = process.env.CircleAPI;
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET;
  if (!apiKey || !entitySecret) throw new Error('Missing CircleAPI or CIRCLE_ENTITY_SECRET');

  const publicKey = await getCirclePublicKey(apiKey);
  const ciphertext = encryptEntitySecret(entitySecret, publicKey);

  const res = await fetch(`${CIRCLE_API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...body,
      entitySecretCiphertext: ciphertext,
      idempotencyKey: crypto.randomUUID(),
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || `Circle API error: ${res.status}`);
  return data.data;
}

async function circleGet(path: string) {
  const apiKey = process.env.CircleAPI;
  if (!apiKey) throw new Error('Missing CircleAPI');

  const res = await fetch(`${CIRCLE_API_BASE}${path}`, {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || `Circle API error: ${res.status}`);
  return data.data;
}

// --- Handlers ---

async function handleCreate(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });

  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId required' });

  const wsData = await circlePost('/developer/walletSets', { name: `user-${userId}` });
  const walletSetId = wsData?.walletSet?.id;
  if (!walletSetId) throw new Error('Failed to create wallet set');

  const wData = await circlePost('/developer/wallets', {
    walletSetId,
    blockchains: ['ETH-SEPOLIA'],
    count: 1,
    accountType: 'EOA',
  });
  const wallet = wData?.wallets?.[0];
  if (!wallet) throw new Error('Failed to create wallet');

  return res.status(200).json({
    walletId: wallet.id,
    address: wallet.address,
    blockchain: wallet.blockchain,
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
