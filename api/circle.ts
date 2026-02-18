import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import { updateCircleTxStatus } from './_lib/supabase';
import { handleCors } from './_lib/cors';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;

  const { action } = req.query;

  // Webhook endpoint (POST/HEAD)
  if (action === 'webhook') {
    return handleWebhook(req, res);
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  switch (action) {
    case 'fees':
      return handleFees(req, res);
    case 'messages':
      return handleMessages(req, res);
    default:
      return res.status(400).json({ error: 'Invalid action. Use: fees, messages, webhook' });
  }
}

async function handleFees(req: VercelRequest, res: VercelResponse) {
  const { destDomain, srcDomain } = req.query;

  if (!destDomain || !srcDomain) {
    return res.status(400).json({ error: 'Missing destDomain or srcDomain' });
  }

  try {
    const circleUrl = `https://iris-api-sandbox.circle.com/v2/burn/USDC/fees/${destDomain}/${srcDomain}`;
    console.log('[Circle Fees Proxy] Fetching:', circleUrl);

    const response = await fetch(circleUrl, {
      headers: { 'Accept': 'application/json' },
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error: any) {
    console.error('[Circle Fees Proxy] Error:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch fees' });
  }
}

async function handleMessages(req: VercelRequest, res: VercelResponse) {
  const { domain, transactionHash } = req.query;

  if (!domain || !transactionHash) {
    return res.status(400).json({ error: 'Missing domain or transactionHash' });
  }

  try {
    const circleUrl = `https://iris-api-sandbox.circle.com/v2/messages/${domain}?transactionHash=${transactionHash}`;
    console.log('[Circle Messages Proxy] Fetching:', circleUrl);

    const response = await fetch(circleUrl, {
      headers: { 'Accept': 'application/json' },
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error: any) {
    console.error('[Circle Messages Proxy] Error:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch messages' });
  }
}

// --- Circle Webhook ---

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
    [key: string]: unknown;
  };
  timestamp: string;
  version: number;
}

async function verifyWebhookSignature(
  body: string,
  signature: string,
  keyId: string
): Promise<boolean> {
  const apiKey = process.env.CircleAPI?.trim();
  if (!apiKey) return false;

  try {
    const r = await fetch(
      `https://api.circle.com/v2/notifications/publicKey/${keyId}`,
      { headers: { 'Authorization': `Bearer ${apiKey}` } }
    );
    if (!r.ok) return false;

    const data = await r.json();
    const publicKeyBase64 = data.data.publicKey;
    const publicKeyBytes = Buffer.from(publicKeyBase64, 'base64');
    const publicKey = crypto.createPublicKey({
      key: publicKeyBytes,
      format: 'der',
      type: 'spki',
    });

    const signatureBytes = Buffer.from(signature, 'base64');
    const messageBytes = Buffer.from(body);

    return crypto.verify('sha256', messageBytes, publicKey, signatureBytes);
  } catch (e) {
    console.error('[Webhook] Signature verification error:', e);
    return false;
  }
}

async function handleWebhook(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'HEAD') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST or HEAD required' });
  }

  // IP allowlist check
  const forwarded = req.headers['x-forwarded-for'];
  const clientIp = typeof forwarded === 'string'
    ? forwarded.split(',')[0].trim()
    : req.socket?.remoteAddress || '';

  if (clientIp && !CIRCLE_IPS.has(clientIp)) {
    console.warn(`[Webhook] Request from non-Circle IP: ${clientIp}`);
  }

  // Signature verification
  const signature = req.headers['x-circle-signature'] as string | undefined;
  const keyId = req.headers['x-circle-key-id'] as string | undefined;

  if (signature && keyId) {
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    const valid = await verifyWebhookSignature(rawBody, signature, keyId);
    if (!valid) {
      console.warn('[Webhook] Signature verification failed — continuing anyway');
    }
  }

  try {
    const payload = req.body as CircleNotification;
    const { notificationType, notification, notificationId } = payload;

    console.log(`[Webhook] Received: type=${notificationType}, id=${notificationId}`);

    if (notificationType === 'webhooks.test') {
      return res.status(200).json({ status: 'ok' });
    }

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

    console.log(`[Webhook] Unknown type: ${notificationType}`);
    return res.status(200).json({ status: 'ok' });
  } catch (error: any) {
    console.error('[Webhook] Error processing:', error);
    return res.status(200).json({ status: 'error', message: error.message });
  }
}
