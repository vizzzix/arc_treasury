import {
  CircleDeveloperControlledWalletsClient,
  initiateDeveloperControlledWalletsClient,
} from '@circle-fin/developer-controlled-wallets';

export const CIRCLE_API_BASE = 'https://api.circle.com/v1/w3s';

let _client: CircleDeveloperControlledWalletsClient | null = null;

function getClient(): CircleDeveloperControlledWalletsClient {
  if (_client) return _client;

  const apiKey = process.env.CircleAPI?.trim();
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET?.trim();
  if (!apiKey || !entitySecret) throw new Error('Missing CircleAPI or CIRCLE_ENTITY_SECRET');

  _client = initiateDeveloperControlledWalletsClient({
    apiKey,
    entitySecret,
  });
  return _client;
}

export { getClient };

// Backward-compatible wrapper: translates old circlePost calls to SDK
export async function circlePost(path: string, body: any) {
  const client = getClient();

  // Contract execution — the primary use case
  if (path === '/developer/transactions/contractExecution') {
    const { walletId, contractAddress, abiFunctionSignature, abiParameters, callData, amount, feeLevel: _fl, ...rest } = body;

    const input: any = {
      walletId,
      contractAddress,
      fee: { type: 'level' as const, config: { feeLevel: 'HIGH' as const } },
    };

    // callData is mutually exclusive with abiFunctionSignature/abiParameters.
    // Used for Multicall3From batches (viem-encoded aggregate3 calldata).
    if (callData) {
      input.callData = callData;
    } else {
      input.abiFunctionSignature = abiFunctionSignature;
      input.abiParameters = abiParameters || [];
    }

    if (amount) input.amount = String(amount);

    const response = await client.createContractExecutionTransaction(input);
    return response.data;
  }

  // Fallback for any other paths — use raw fetch with SDK-generated ciphertext
  const apiKey = process.env.CircleAPI!.trim();
  const ciphertext = await client.generateEntitySecretCiphertext();

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
  const apiKey = process.env.CircleAPI?.trim();
  if (!apiKey) throw new Error('Missing CircleAPI');

  const r = await fetch(`${CIRCLE_API_BASE}${path}`, {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.message || `Circle API error: ${r.status}`);
  return data.data;
}
