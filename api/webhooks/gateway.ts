import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../_lib/supabase';
import { captureApiError } from '../_lib/sentry';

const PROCESSED_IDS = new Set<string>();

interface GatewayWebhookEvent {
  id: string;
  type: string;
  timestamp: string;
  data: {
    sourceChain?: string;
    sourceDomain?: number;
    destinationChain?: string;
    destinationDomain?: number;
    sender?: string;
    recipient?: string;
    amount?: string;
    token?: string;
    sourceTxHash?: string;
    destinationTxHash?: string;
    status?: string;
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const event = req.body as GatewayWebhookEvent;

    if (!event?.id || !event?.type) {
      return res.status(400).json({ error: 'Invalid webhook payload' });
    }

    if (PROCESSED_IDS.has(event.id)) {
      return res.status(200).json({ ok: true, deduplicated: true });
    }
    PROCESSED_IDS.add(event.id);

    // Keep set bounded
    if (PROCESSED_IDS.size > 10_000) {
      const first = PROCESSED_IDS.values().next().value;
      if (first) PROCESSED_IDS.delete(first);
    }

    console.log(`[Gateway Webhook] ${event.type} id=${event.id}`);

    switch (event.type) {
      case 'gateway.deposit.finalized':
        await handleDepositFinalized(event);
        break;
      case 'gateway.mint.finalized':
        await handleMintFinalized(event);
        break;
      case 'gateway.mint.forwarded':
        await handleMintForwarded(event);
        break;
      default:
        console.log(`[Gateway Webhook] Unknown event type: ${event.type}`);
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    captureApiError(error, 'gateway-webhook');
    console.error('[Gateway Webhook] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function handleDepositFinalized(event: GatewayWebhookEvent) {
  if (!supabaseAdmin) return;

  const { sender, amount, sourceTxHash, sourceDomain } = event.data;
  if (!sourceTxHash || !sender) return;

  const direction = sourceDomain === 0 ? 'to_arc' : 'to_sepolia';

  await supabaseAdmin.from('site_bridges').upsert({
    tx_hash: sourceTxHash,
    wallet_address: sender.toLowerCase(),
    amount_usd: amount ? parseFloat(amount) : 0,
    direction,
    status: 'deposit_finalized',
    updated_at: new Date().toISOString(),
  }, { onConflict: 'tx_hash' });

  console.log(`[Gateway Webhook] Deposit finalized: ${sourceTxHash} from ${sender}`);
}

async function handleMintFinalized(event: GatewayWebhookEvent) {
  if (!supabaseAdmin) return;

  const { recipient, amount, destinationTxHash, sourceTxHash, destinationDomain } = event.data;
  if (!recipient) return;

  const txHash = sourceTxHash || destinationTxHash;
  if (!txHash) return;

  // Update site_bridges with mint completion
  const { error: bridgeError } = await supabaseAdmin
    .from('site_bridges')
    .update({
      status: 'complete',
      mint_tx_hash: destinationTxHash,
      updated_at: new Date().toISOString(),
    })
    .eq('wallet_address', recipient.toLowerCase())
    .eq('status', 'deposit_finalized')
    .order('created_at', { ascending: false })
    .limit(1);

  if (bridgeError) {
    console.error('[Gateway Webhook] site_bridges update error:', bridgeError.message);
  }

  // Update circle_transactions if there's a matching pending bridge tx
  const { data: pendingTxs } = await supabaseAdmin
    .from('circle_transactions')
    .select('circle_tx_id')
    .eq('wallet_address', recipient.toLowerCase())
    .eq('tx_type', 'bridge-burn')
    .in('status', ['PENDING', 'SENT', 'CONFIRMED'])
    .order('created_at', { ascending: false })
    .limit(1);

  if (pendingTxs?.[0]) {
    await supabaseAdmin
      .from('circle_transactions')
      .update({
        status: 'COMPLETE',
        tx_hash: destinationTxHash || undefined,
        updated_at: new Date().toISOString(),
      })
      .eq('circle_tx_id', pendingTxs[0].circle_tx_id);
  }

  console.log(`[Gateway Webhook] Mint finalized: ${destinationTxHash} to ${recipient}`);
}

async function handleMintForwarded(event: GatewayWebhookEvent) {
  console.log(`[Gateway Webhook] Mint forwarded: ${event.data.destinationTxHash}`);
}
