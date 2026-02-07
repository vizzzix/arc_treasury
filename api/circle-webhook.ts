import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import { updateCircleTxStatus } from './lib/supabase';

// Circle webhook IP allowlist
const CIRCLE_IPS = new Set([
  '54.243.112.156',
  '100.24.191.35',
  '54.165.52.248',
  '54.87.106.46',
]);

interface CircleNotification {
  subscriptionId: string;
  notificationId: string;
  notificationType: string;
  notification: {
    id: string;
    state?: string;
    status?: string;
    txHash?: string;
    errorReason?: string;
    errorMessage?: string;
    walletId?: string;
    blockchain?: string;
    [key: string]: unknown;
  };
  timestamp: string;
  version: number;
}

async function verifySignature(
  body: string,
  signature: string,
  keyId: string
): Promise<boolean> {
  const apiKey = process.env.CircleAPI;
  if (!apiKey) return false;

  try {
    const res = await fetch(
      `https://api.circle.com/v2/notifications/publicKey/${keyId}`,
      { headers: { 'Authorization': `Bearer ${apiKey}` } }
    );
    if (!res.ok) return false;

    const data = await res.json();
    const publicKeyPem = Buffer.from(data.data.publicKey, 'base64').toString();

    const verifier = crypto.createVerify('SHA256');
    verifier.update(body);
    return verifier.verify(publicKeyPem, signature, 'base64');
  } catch (e) {
    console.error('[Webhook] Signature verification error:', e);
    return false;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Circle sends HEAD to verify endpoint is alive
  if (req.method === 'HEAD') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST or HEAD required' });
  }

  // IP allowlist check (Vercel provides x-forwarded-for)
  const forwarded = req.headers['x-forwarded-for'];
  const clientIp = typeof forwarded === 'string'
    ? forwarded.split(',')[0].trim()
    : req.socket?.remoteAddress || '';

  if (clientIp && !CIRCLE_IPS.has(clientIp)) {
    console.warn(`[Webhook] Request from non-Circle IP: ${clientIp}`);
    // Don't reject — Vercel proxy may alter IPs. Log and continue.
  }

  // Signature verification
  const signature = req.headers['x-circle-signature'] as string | undefined;
  const keyId = req.headers['x-circle-key-id'] as string | undefined;

  if (signature && keyId) {
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    const valid = await verifySignature(rawBody, signature, keyId);
    if (!valid) {
      console.warn('[Webhook] Invalid signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }
  }

  try {
    const payload = req.body as CircleNotification;
    const { notificationType, notification, notificationId } = payload;

    console.log(`[Webhook] Received: type=${notificationType}, id=${notificationId}`);

    // Handle test notification
    if (notificationType === 'webhooks.test') {
      console.log('[Webhook] Test notification received');
      return res.status(200).json({ status: 'ok' });
    }

    // Handle transaction notifications
    if (
      notificationType === 'transactions.outbound' ||
      notificationType === 'transactions.inbound'
    ) {
      const txId = notification.id;
      const state = notification.state || notification.status || 'PENDING';
      const txHash = notification.txHash;
      const errorReason = notification.errorReason || notification.errorMessage;

      console.log(`[Webhook] Transaction update: id=${txId}, state=${state}, hash=${txHash || 'none'}`);

      await updateCircleTxStatus(txId, state, txHash, errorReason);

      return res.status(200).json({ status: 'ok' });
    }

    // Unknown notification type — ack it
    console.log(`[Webhook] Unknown type: ${notificationType}`);
    return res.status(200).json({ status: 'ok' });
  } catch (error: any) {
    console.error('[Webhook] Error processing:', error);
    // Always return 200 to prevent Circle from retrying
    return res.status(200).json({ status: 'error', message: error.message });
  }
}
