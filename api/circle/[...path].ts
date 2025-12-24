import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Universal proxy for Circle Iris API to avoid CORS issues
 * Forwards all requests to iris-api-sandbox.circle.com
 *
 * Examples:
 * - /api/circle/v2/messages/0?transactionHash=0x...
 * - /api/circle/v2/burn/USDC/fees/26/0
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Get the path after /api/circle/
    const { path } = req.query;
    const pathSegments = Array.isArray(path) ? path : [path];
    const apiPath = pathSegments.join('/');

    // Build the Circle API URL
    const queryString = Object.entries(req.query)
      .filter(([key]) => key !== 'path')
      .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
      .join('&');

    const circleUrl = `https://iris-api-sandbox.circle.com/${apiPath}${queryString ? '?' + queryString : ''}`;

    console.log('[Circle Proxy] Forwarding to:', circleUrl);

    const response = await fetch(circleUrl, {
      method: req.method,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      ...(req.method === 'POST' && req.body ? { body: JSON.stringify(req.body) } : {}),
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error: any) {
    console.error('[Circle Proxy] Error:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch from Circle API' });
  }
}
