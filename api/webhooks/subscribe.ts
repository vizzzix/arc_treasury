import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from '../_lib/cors';

const GATEWAY_NOTIFICATIONS_API = 'https://api.circle.com/v2/notifications/subscriptions/permissionless';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;

  const apiKey = process.env.CircleAPI?.trim();
  if (!apiKey) {
    return res.status(500).json({ error: 'CircleAPI not configured' });
  }

  const { action } = req.query;

  try {
    if (req.method === 'GET' || action === 'list') {
      const response = await fetch(GATEWAY_NOTIFICATIONS_API, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });
      const data = await response.json();
      return res.status(200).json(data);
    }

    if (req.method === 'POST' && action === 'create') {
      const webhookUrl = req.body?.webhookUrl;
      if (!webhookUrl) {
        return res.status(400).json({ error: 'webhookUrl required' });
      }

      const response = await fetch(GATEWAY_NOTIFICATIONS_API, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          endpoint: webhookUrl,
          notificationTypes: ['gateway.*'],
        }),
      });
      const data = await response.json();
      return res.status(response.ok ? 201 : response.status).json(data);
    }

    return res.status(400).json({ error: 'Use GET to list or POST with action=create' });
  } catch (error) {
    console.error('[Webhook Subscribe] Error:', error);
    return res.status(500).json({ error: 'Failed to manage subscription' });
  }
}
