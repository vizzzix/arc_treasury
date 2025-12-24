import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Proxy for Circle messages API (attestation status)
 * GET /api/circle/messages?domain=0&transactionHash=0x...
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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
