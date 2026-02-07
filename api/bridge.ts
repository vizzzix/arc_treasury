import type { VercelRequest, VercelResponse } from '@vercel/node';
import { circlePost, CIRCLE_API_BASE } from './lib/circle';

// CCTP / Bridge constants — Sepolia
const SEPOLIA_TOKEN_MESSENGER = '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA';
const USDC_SEPOLIA = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';
const SEPOLIA_MESSAGE_TRANSMITTER = '0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275';
const SEPOLIA_DOMAIN = 0;

// CCTP / Bridge constants — Arc Testnet
const USDC_ARC = '0x3600000000000000000000000000000000000000';
const ARC_TOKEN_MESSENGER = '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA';
const ARC_MESSAGE_TRANSMITTER = '0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275';
const ARC_DESTINATION_DOMAIN = 26;

const ATTESTATION_API = 'https://iris-api-sandbox.circle.com/v2/messages';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action } = req.query;

  try {
    switch (action) {
      case 'approve':
        return await handleApprove(req, res);
      case 'burn':
        return await handleBurn(req, res);
      case 'tx-status':
        return await handleTxStatus(req, res);
      case 'claim':
        return await handleClaim(req, res);
      case 'health':
        return res.status(200).json({
          ok: true,
          hasCircleApi: !!process.env.CircleAPI,
        });
      default:
        return res.status(400).json({ error: 'Invalid action. Use: approve, burn, tx-status, claim' });
    }
  } catch (error: any) {
    console.error('[Bridge API] Error:', error.message || error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

// Pad address to bytes32 (for CCTP mintRecipient)
function padAddress(addr: string): string {
  const clean = addr.toLowerCase().replace('0x', '');
  return '0x' + clean.padStart(64, '0');
}

// --- Step 1: Approve USDC on source chain ---

async function handleApprove(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });

  const { walletId, amount, direction } = req.body;
  if (!walletId || !amount) return res.status(400).json({ error: 'walletId and amount required' });

  const isArcToSepolia = direction === 'arc-to-sepolia';
  const amountMicro = BigInt(Math.round(parseFloat(amount) * 1_000_000));
  const approveAmount = (amountMicro * 10n).toString();

  const contractAddress = isArcToSepolia ? USDC_ARC : USDC_SEPOLIA;
  const spender = isArcToSepolia ? ARC_TOKEN_MESSENGER : SEPOLIA_TOKEN_MESSENGER;

  console.log(`[Bridge] Approve: wallet=${walletId}, amount=${amount}, direction=${direction || 'sepolia-to-arc'}, spender=${spender}`);

  const result = await circlePost('/developer/transactions/contractExecution', {
    walletId,
    contractAddress,
    abiFunctionSignature: 'approve(address,uint256)',
    abiParameters: [spender, approveAmount],
    feeLevel: 'HIGH',
  });

  console.log('[Bridge] Approve result:', JSON.stringify(result));

  return res.status(200).json({
    transactionId: result?.id || result?.transactionId,
    state: result?.state,
  });
}

// --- Step 2: Burn/bridge on source chain ---

async function handleBurn(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });

  const { walletId, amount, recipientAddress, direction } = req.body;
  if (!walletId || !amount || !recipientAddress) {
    return res.status(400).json({ error: 'walletId, amount, and recipientAddress required' });
  }

  const isArcToSepolia = direction === 'arc-to-sepolia';
  const amountMicro = BigInt(Math.round(parseFloat(amount) * 1_000_000));
  const calculatedFee = amountMicro / 10000n;
  const maxFee = calculatedFee > 1000n ? calculatedFee : 1000n;
  const zeroBytes32 = '0x0000000000000000000000000000000000000000000000000000000000000000';

  console.log(`[Bridge] Burn: wallet=${walletId}, amount=${amount}, recipient=${recipientAddress}, direction=${direction || 'sepolia-to-arc'}`);

  if (isArcToSepolia) {
    // Arc → Sepolia: CCTP V2 depositForBurn on TokenMessenger
    const mintRecipient = padAddress(recipientAddress);

    const result = await circlePost('/developer/transactions/contractExecution', {
      walletId,
      contractAddress: ARC_TOKEN_MESSENGER,
      abiFunctionSignature: 'depositForBurn(uint256,uint32,bytes32,address,bytes32,uint256,uint32)',
      abiParameters: [
        amountMicro.toString(),
        SEPOLIA_DOMAIN.toString(),
        mintRecipient,
        USDC_ARC,
        zeroBytes32,
        maxFee.toString(),
        '2000',
      ],
      feeLevel: 'HIGH',
    });

    console.log('[Bridge] Burn (Arc→Sepolia) result:', JSON.stringify(result));

    return res.status(200).json({
      transactionId: result?.id || result?.transactionId,
      state: result?.state,
    });
  } else {
    // Sepolia → Arc: CCTP V2 depositForBurn on TokenMessenger
    const mintRecipient = padAddress(recipientAddress);

    const result = await circlePost('/developer/transactions/contractExecution', {
      walletId,
      contractAddress: SEPOLIA_TOKEN_MESSENGER,
      abiFunctionSignature: 'depositForBurn(uint256,uint32,bytes32,address,bytes32,uint256,uint32)',
      abiParameters: [
        amountMicro.toString(),
        ARC_DESTINATION_DOMAIN.toString(),
        mintRecipient,
        USDC_SEPOLIA,
        zeroBytes32,
        maxFee.toString(),
        '1000',
      ],
      feeLevel: 'HIGH',
    });

    console.log('[Bridge] Burn (Sepolia→Arc) result:', JSON.stringify(result));

    return res.status(200).json({
      transactionId: result?.id || result?.transactionId,
      state: result?.state,
    });
  }
}

// --- Check Circle transaction status ---

async function handleTxStatus(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET required' });

  const { txId } = req.query;
  if (!txId || typeof txId !== 'string') return res.status(400).json({ error: 'txId required' });

  const apiKey = process.env.CircleAPI;
  if (!apiKey) throw new Error('Missing CircleAPI');

  // Try the standard path first, then fallback to /developer/ path
  const paths = [
    `/transactions/${txId}`,
    `/developer/transactions/${txId}`,
  ];

  for (const path of paths) {
    const url = `${CIRCLE_API_BASE}${path}`;
    try {
      const r = await fetch(url, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });
      const data = await r.json();

      console.log(`[Bridge] tx-status GET ${path} → ${r.status}:`, JSON.stringify(data));

      if (!r.ok) continue; // Try next path

      // Handle both response structures:
      // { data: { transaction: { id, state, ... } } } or { data: { id, state, ... } }
      const inner = data.data;
      const tx = inner?.transaction || inner;

      return res.status(200).json({
        id: tx?.id,
        state: tx?.state,
        txHash: tx?.txHash,
        errorReason: tx?.errorReason,
        createDate: tx?.createDate,
        updateDate: tx?.updateDate,
      });
    } catch (e: any) {
      console.warn(`[Bridge] tx-status ${path} error:`, e.message);
    }
  }

  return res.status(502).json({ error: 'Could not fetch transaction status from Circle' });
}

// --- Step 4: Claim on destination chain (via Circle API — no relayer needed) ---

async function handleClaim(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });

  const { burnTxHash, direction, destWalletId } = req.body;
  if (!burnTxHash) return res.status(400).json({ error: 'burnTxHash required' });
  if (!destWalletId) return res.status(400).json({ error: 'destWalletId required' });

  const isArcToSepolia = direction === 'arc-to-sepolia';
  const sourceDomain = isArcToSepolia ? ARC_DESTINATION_DOMAIN : SEPOLIA_DOMAIN;
  const destTransmitter = isArcToSepolia ? SEPOLIA_MESSAGE_TRANSMITTER : ARC_MESSAGE_TRANSMITTER;

  console.log(`[Bridge] Claim: fetching attestation for ${burnTxHash}, direction=${direction || 'sepolia-to-arc'}`);

  const attestationUrl = `${ATTESTATION_API}/${sourceDomain}?transactionHash=${burnTxHash}`;
  const attestResponse = await fetch(attestationUrl, {
    headers: { 'Accept': 'application/json' },
  });

  if (!attestResponse.ok) {
    return res.status(502).json({ error: 'Failed to fetch attestation' });
  }

  const attestData = await attestResponse.json();
  const msg = attestData.messages?.[0];

  if (!msg?.attestation || msg.attestation === 'PENDING') {
    return res.status(200).json({
      status: 'pending',
      message: 'Attestation not ready yet',
    });
  }

  const messageBytes = msg.message;
  const attestationBytes = msg.attestation;

  console.log('[Bridge] Attestation received, calling receiveMessage via Circle API...');

  const result = await circlePost('/developer/transactions/contractExecution', {
    walletId: destWalletId,
    contractAddress: destTransmitter,
    abiFunctionSignature: 'receiveMessage(bytes,bytes)',
    abiParameters: [messageBytes, attestationBytes],
    feeLevel: 'HIGH',
  });

  console.log('[Bridge] Claim submitted via Circle:', JSON.stringify(result));

  return res.status(200).json({
    status: 'submitted',
    transactionId: result?.id || result?.transactionId,
    state: result?.state,
  });
}
