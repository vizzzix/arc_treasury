import crypto from 'crypto';

export const CIRCLE_API_BASE = 'https://api.circle.com/v1/w3s';

export async function getCirclePublicKey(apiKey: string): Promise<string> {
  const r = await fetch(`${CIRCLE_API_BASE}/config/entity/publicKey`, {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  });
  if (!r.ok) throw new Error(`Failed to get public key: ${r.status}`);
  const data = await r.json();
  return data.data.publicKey;
}

export function encryptEntitySecret(entitySecret: string, publicKeyPem: string): string {
  const buf = Buffer.from(entitySecret, 'hex');
  const encrypted = crypto.publicEncrypt(
    { key: publicKeyPem, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
    buf
  );
  return encrypted.toString('base64');
}

export async function circlePost(path: string, body: any) {
  const apiKey = process.env.CircleAPI;
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET;
  if (!apiKey || !entitySecret) throw new Error('Missing CircleAPI or CIRCLE_ENTITY_SECRET');

  const publicKey = await getCirclePublicKey(apiKey);
  const ciphertext = encryptEntitySecret(entitySecret, publicKey);

  const r = await fetch(`${CIRCLE_API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...body,
      entitySecretCiphertext: ciphertext,
      idempotencyKey: crypto.randomUUID(),
    }),
  });

  const data = await r.json();
  if (!r.ok) {
    const errMsg = data?.message || 'Unknown error';
    const errDetails = data?.errors ? JSON.stringify(data.errors) : '';
    console.error('[Circle API] Error:', r.status, errMsg, errDetails, JSON.stringify(data));
    throw new Error(`${errMsg}${errDetails ? ` | ${errDetails}` : ''}`);
  }
  return data.data;
}

export async function circleGet(path: string) {
  const apiKey = process.env.CircleAPI;
  if (!apiKey) throw new Error('Missing CircleAPI');

  const r = await fetch(`${CIRCLE_API_BASE}${path}`, {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.message || `Circle API error: ${r.status}`);
  return data.data;
}
