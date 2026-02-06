import crypto from 'crypto';

const CIRCLE_API_BASE = 'https://api.circle.com/v1/w3s';

async function getCirclePublicKey(apiKey: string): Promise<string> {
  const res = await fetch(`${CIRCLE_API_BASE}/config/entity/publicKey`, {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new Error(`Failed to get public key: ${res.status}`);
  const data = await res.json();
  return data.data.publicKey;
}

function encryptEntitySecret(entitySecret: string, publicKeyPem: string): string {
  const entitySecretBuf = Buffer.from(entitySecret, 'hex');
  const encrypted = crypto.publicEncrypt(
    {
      key: publicKeyPem,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    },
    entitySecretBuf
  );
  return encrypted.toString('base64');
}

function generateIdempotencyKey(): string {
  return crypto.randomUUID();
}

async function circleRequest(path: string, method: string, body?: any) {
  const apiKey = process.env.CircleAPI;
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET;

  if (!apiKey || !entitySecret) {
    throw new Error('Missing CircleAPI or CIRCLE_ENTITY_SECRET env vars');
  }

  const publicKey = await getCirclePublicKey(apiKey);
  const ciphertext = encryptEntitySecret(entitySecret, publicKey);

  const url = `${CIRCLE_API_BASE}${path}`;
  const options: RequestInit = {
    method,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  };

  if (body) {
    options.body = JSON.stringify({
      ...body,
      entitySecretCiphertext: ciphertext,
      idempotencyKey: generateIdempotencyKey(),
    });
  }

  const res = await fetch(url, options);
  const data = await res.json();

  if (!res.ok) {
    const errMsg = data?.message || data?.error || `Circle API error: ${res.status}`;
    throw new Error(errMsg);
  }

  return data.data;
}

export async function createWalletSet(name: string) {
  const data = await circleRequest('/developer/walletSets', 'POST', { name });
  const walletSet = data?.walletSet;
  if (!walletSet?.id) throw new Error('Failed to create wallet set');
  return walletSet.id;
}

export async function createWallet(walletSetId: string, blockchains: string[]) {
  const data = await circleRequest('/developer/wallets', 'POST', {
    walletSetId,
    blockchains,
    count: 1,
    accountType: 'EOA',
  });
  const wallet = data?.wallets?.[0];
  if (!wallet) throw new Error('Failed to create wallet');
  return wallet;
}

export async function getWallet(walletId: string) {
  const apiKey = process.env.CircleAPI;
  if (!apiKey) throw new Error('Missing CircleAPI env var');

  const res = await fetch(`${CIRCLE_API_BASE}/wallets/${walletId}`, {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || 'Failed to get wallet');
  return data.data?.wallet;
}

export async function getWalletBalance(walletId: string) {
  const apiKey = process.env.CircleAPI;
  if (!apiKey) throw new Error('Missing CircleAPI env var');

  const res = await fetch(`${CIRCLE_API_BASE}/wallets/${walletId}/balances`, {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || 'Failed to get balance');
  return data.data?.tokenBalances || [];
}
