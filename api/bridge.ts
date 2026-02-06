import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';

const CIRCLE_API_BASE = 'https://api.circle.com/v1/w3s';

// CCTP / Bridge constants
const ARC_BRIDGE_CONTRACT = '0xC5567a5E3370d4DBfB0540025078e283e36A363d';
const USDC_SEPOLIA = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';
const ARC_MESSAGE_TRANSMITTER = '0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275';
const ARC_DESTINATION_DOMAIN = 26;
const BRIDGE_SELECTOR = '0xd0d4229a';
const ATTESTATION_API = 'https://iris-api-sandbox.circle.com/v2/messages';

// Arc Testnet chain config for viem
const arcTestnet = {
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'Ethereum', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.testnet.arc.network'] } },
} as const;

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
          hasRelayerKey: !!process.env.BRIDGE_RELAYER_KEY,
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

// --- Circle API helpers (same as wallet.ts) ---

async function getCirclePublicKey(apiKey: string): Promise<string> {
  const r = await fetch(`${CIRCLE_API_BASE}/config/entity/publicKey`, {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  });
  if (!r.ok) throw new Error(`Failed to get public key: ${r.status}`);
  const data = await r.json();
  return data.data.publicKey;
}

function encryptEntitySecret(entitySecret: string, publicKeyPem: string): string {
  const buf = Buffer.from(entitySecret, 'hex');
  const encrypted = crypto.publicEncrypt(
    { key: publicKeyPem, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
    buf
  );
  return encrypted.toString('base64');
}

async function circlePost(path: string, body: any) {
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
  if (!r.ok) throw new Error(data?.message || JSON.stringify(data) || `Circle API error: ${r.status}`);
  return data.data;
}

async function circleGet(path: string) {
  const apiKey = process.env.CircleAPI;
  if (!apiKey) throw new Error('Missing CircleAPI');

  const r = await fetch(`${CIRCLE_API_BASE}${path}`, {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.message || `Circle API error: ${r.status}`);
  return data.data;
}

// --- Step 1: Approve USDC to ARC_BRIDGE_CONTRACT ---

async function handleApprove(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });

  const { walletId, amount } = req.body;
  if (!walletId || !amount) return res.status(400).json({ error: 'walletId and amount required' });

  // USDC has 6 decimals on Sepolia
  const amountMicro = BigInt(Math.round(parseFloat(amount) * 1_000_000));
  // Approve 10x for future bridges
  const approveAmount = (amountMicro * 10n).toString();

  console.log(`[Bridge] Approve: wallet=${walletId}, amount=${amount} USDC, approveAmount=${approveAmount}`);

  const result = await circlePost('/developer/transactions/contractExecution', {
    walletId,
    contractAddress: USDC_SEPOLIA,
    abiFunctionSignature: 'approve(address,uint256)',
    abiParameters: [ARC_BRIDGE_CONTRACT, approveAmount],
    fee: { type: 'level', config: { feeLevel: 'HIGH' } },
  });

  console.log('[Bridge] Approve result:', JSON.stringify(result));

  return res.status(200).json({
    transactionId: result?.id || result?.transactionId,
    state: result?.state,
  });
}

// --- Step 2: Execute bridge (burn via bridgeWithPreapproval) ---

async function handleBurn(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });

  const { walletId, amount, recipientAddress } = req.body;
  if (!walletId || !amount || !recipientAddress) {
    return res.status(400).json({ error: 'walletId, amount, and recipientAddress required' });
  }

  // USDC has 6 decimals on Sepolia
  const amountMicro = BigInt(Math.round(parseFloat(amount) * 1_000_000));

  // Calculate fee: 1 bps (0.01%)
  const calculatedFee = amountMicro / 10000n;
  const maxFee = calculatedFee > 1000n ? calculatedFee : 1000n;
  const minFinalityThreshold = 1000;
  const zeroBytes32 = '0x0000000000000000000000000000000000000000000000000000000000000000';

  console.log(`[Bridge] Burn: wallet=${walletId}, amount=${amount}, recipient=${recipientAddress}`);

  // Use Circle's contractExecution API with the full ABI signature
  const result = await circlePost('/developer/transactions/contractExecution', {
    walletId,
    contractAddress: ARC_BRIDGE_CONTRACT,
    abiFunctionSignature: 'bridgeWithPreapproval(uint256,uint256,uint256,address,bytes32,address,address,uint256,uint256)',
    abiParameters: [
      amountMicro.toString(),
      maxFee.toString(),
      '0',
      recipientAddress,
      zeroBytes32,
      USDC_SEPOLIA,
      ARC_BRIDGE_CONTRACT,
      ARC_DESTINATION_DOMAIN.toString(),
      minFinalityThreshold.toString(),
    ],
    fee: { type: 'level', config: { feeLevel: 'HIGH' } },
  });

  console.log('[Bridge] Burn result:', JSON.stringify(result));

  return res.status(200).json({
    transactionId: result?.id || result?.transactionId,
    state: result?.state,
  });
}

// --- Check Circle transaction status ---

async function handleTxStatus(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET required' });

  const { txId } = req.query;
  if (!txId || typeof txId !== 'string') return res.status(400).json({ error: 'txId required' });

  const result = await circleGet(`/transactions/${txId}`);
  const tx = result?.transaction;

  return res.status(200).json({
    id: tx?.id,
    state: tx?.state,
    txHash: tx?.txHash,
    errorReason: tx?.errorReason,
    createDate: tx?.createDate,
    updateDate: tx?.updateDate,
  });
}

// --- Step 4: Claim on Arc Testnet (backend relayer) ---

async function handleClaim(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });

  const { burnTxHash } = req.body;
  if (!burnTxHash) return res.status(400).json({ error: 'burnTxHash required' });

  const relayerKey = process.env.BRIDGE_RELAYER_KEY;
  if (!relayerKey) {
    return res.status(500).json({ error: 'Bridge relayer not configured' });
  }

  // 1. Get attestation from Circle
  console.log(`[Bridge] Claim: fetching attestation for ${burnTxHash}`);

  const attestationUrl = `${ATTESTATION_API}/0?transactionHash=${burnTxHash}`;
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

  const messageBytes = msg.message as `0x${string}`;
  const attestationBytes = msg.attestation as `0x${string}`;

  console.log('[Bridge] Attestation received, calling receiveMessage on Arc...');

  // 2. Call receiveMessage on Arc Testnet using relayer
  const { privateKeyToAccount } = await import('viem/accounts');
  const { createPublicClient, createWalletClient, http } = await import('viem');
  const account = privateKeyToAccount(relayerKey as `0x${string}`);

  const publicClient = createPublicClient({
    chain: arcTestnet as any,
    transport: http('https://rpc.testnet.arc.network'),
  });

  const walletClient = createWalletClient({
    account,
    chain: arcTestnet as any,
    transport: http('https://rpc.testnet.arc.network'),
  });

  const MESSAGE_TRANSMITTER_ABI = [
    {
      name: 'receiveMessage',
      type: 'function' as const,
      stateMutability: 'nonpayable' as const,
      inputs: [
        { name: 'message', type: 'bytes' },
        { name: 'attestation', type: 'bytes' },
      ],
      outputs: [{ name: 'success', type: 'bool' }],
    },
  ];

  const claimHash = await walletClient.writeContract({
    address: ARC_MESSAGE_TRANSMITTER as `0x${string}`,
    abi: MESSAGE_TRANSMITTER_ABI,
    functionName: 'receiveMessage',
    args: [messageBytes, attestationBytes],
  });

  console.log('[Bridge] Claim tx sent:', claimHash);

  // Wait for confirmation
  const receipt = await publicClient.waitForTransactionReceipt({ hash: claimHash });

  if (receipt.status !== 'success') {
    return res.status(500).json({ error: 'Claim transaction failed on-chain' });
  }

  console.log('[Bridge] Claim confirmed!');

  return res.status(200).json({
    status: 'complete',
    claimTxHash: claimHash,
    message: 'Bridge complete! USDC minted on Arc Testnet',
  });
}
