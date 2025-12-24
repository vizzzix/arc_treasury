import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Proxy for Circle fees API
 * GET /api/circle/fees?destDomain=26&srcDomain=0
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
