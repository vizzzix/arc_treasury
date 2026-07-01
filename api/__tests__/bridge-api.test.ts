import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockReq, createMockRes } from '../../src/test/mock-vercel';

// Mock all external deps before importing handler
vi.mock('../_lib/circle', () => ({
  circlePost: vi.fn().mockResolvedValue({ id: 'tx-123', state: 'PENDING' }),
  getClient: vi.fn().mockReturnValue({
    getTransaction: vi.fn().mockResolvedValue({
      data: { transaction: { id: 'tx-123', state: 'COMPLETE', txHash: '0xabc' } },
    }),
  }),
}));

vi.mock('../_lib/supabase', () => ({
  trackTx: vi.fn().mockResolvedValue(undefined),
  updateCircleTxStatus: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../_lib/cors', () => ({
  handleCors: vi.fn().mockReturnValue(false),
}));

vi.mock('../_lib/rateLimit', () => ({
  checkRateLimit: vi.fn().mockReturnValue(true),
  getRateLimitHeaders: vi.fn().mockReturnValue({}),
}));

vi.mock('../_lib/auth', () => ({
  authenticateUser: vi.fn().mockResolvedValue({ userId: 'test-user-id' }),
  verifyWalletOwnership: vi.fn().mockResolvedValue(true),
}));

// Must set env vars before import
process.env.CircleAPI = 'test-api-key';
process.env.CIRCLE_ENTITY_SECRET = 'test-secret';

import handler from '../bridge';
import { circlePost, getClient } from '../_lib/circle';
import { trackTx, updateCircleTxStatus } from '../_lib/supabase';
import { authenticateUser, verifyWalletOwnership } from '../_lib/auth';
import { checkRateLimit } from '../_lib/rateLimit';

const VALID_WALLET = '00000000-0000-0000-0000-000000000001';
const VALID_WALLET2 = '00000000-0000-0000-0000-000000000002';
const VALID_ADDRESS = '0xed0037e27139a7792c7982640d045a9d9f2aae8b';
const VALID_TX_HASH = '0x' + 'ab'.repeat(32);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('api/bridge - routing', () => {
  it('returns 400 for invalid action', async () => {
    const req = createMockReq({ query: { action: 'invalid' } });
    const res = createMockRes();
    await handler(req as any, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body.error).toContain('Invalid action');
  });

  it('returns 200 for health check', async () => {
    const req = createMockReq({ query: { action: 'health' } });
    const res = createMockRes();
    await handler(req as any, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body).toEqual({ ok: true });
  });
});

describe('api/bridge - approve', () => {
  it('rejects non-POST', async () => {
    const req = createMockReq({ method: 'GET', query: { action: 'approve' } });
    const res = createMockRes();
    await handler(req as any, res);
    expect(res.status).toHaveBeenCalledWith(405);
  });

  it('requires walletId and amount', async () => {
    const req = createMockReq({ method: 'POST', query: { action: 'approve' }, body: {} });
    const res = createMockRes();
    await handler(req as any, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('calls circlePost for sepolia-to-arc (default)', async () => {
    const req = createMockReq({
      method: 'POST',
      query: { action: 'approve' },
      body: { walletId: VALID_WALLET, amount: '100', walletAddress: VALID_ADDRESS },
    });
    const res = createMockRes();
    await handler(req as any, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(circlePost).toHaveBeenCalledWith(
      '/developer/transactions/contractExecution',
      expect.objectContaining({
        walletId: VALID_WALLET,
        contractAddress: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', // USDC_SEPOLIA
        abiFunctionSignature: 'approve(address,uint256)',
      }),
    );
    expect(trackTx).toHaveBeenCalled();
  });

  it('uses Arc contracts for arc-to-sepolia direction', async () => {
    const req = createMockReq({
      method: 'POST',
      query: { action: 'approve' },
      body: { walletId: VALID_WALLET, amount: '50', direction: 'arc-to-sepolia' },
    });
    const res = createMockRes();
    await handler(req as any, res);

    expect(circlePost).toHaveBeenCalledWith(
      '/developer/transactions/contractExecution',
      expect.objectContaining({
        contractAddress: '0x3600000000000000000000000000000000000000', // USDC_ARC
      }),
    );
  });

  it('approve amount is 10x the bridge amount', async () => {
    const req = createMockReq({
      method: 'POST',
      query: { action: 'approve' },
      body: { walletId: VALID_WALLET, amount: '100' },
    });
    const res = createMockRes();
    await handler(req as any, res);

    const call = vi.mocked(circlePost).mock.calls[0];
    const abiParams = call[1].abiParameters;
    // 100 USDC = 100_000_000 micro, * 10 = 1_000_000_000
    expect(abiParams[1]).toBe('1000000000');
  });
});

describe('api/bridge - burn', () => {
  it('rejects non-POST', async () => {
    const req = createMockReq({ method: 'GET', query: { action: 'burn' } });
    const res = createMockRes();
    await handler(req as any, res);
    expect(res.status).toHaveBeenCalledWith(405);
  });

  it('requires walletId, amount, recipientAddress', async () => {
    const req = createMockReq({
      method: 'POST',
      query: { action: 'burn' },
      body: { walletId: VALID_WALLET, amount: '100' },
    });
    const res = createMockRes();
    await handler(req as any, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('sepolia-to-arc uses domain 26 and minFinalityThreshold 1000', async () => {
    const req = createMockReq({
      method: 'POST',
      query: { action: 'burn' },
      body: {
        walletId: VALID_WALLET, amount: '100',
        recipientAddress: '0xed0037e27139a7792c7982640d045a9d9f2aae8b',
      },
    });
    const res = createMockRes();
    await handler(req as any, res);

    const call = vi.mocked(circlePost).mock.calls[0];
    const params = call[1].abiParameters;
    expect(params[1]).toBe('26'); // ARC_DESTINATION_DOMAIN
    expect(params[6]).toBe('1000'); // minFinalityThreshold
  });

  it('arc-to-sepolia uses domain 0 and minFinalityThreshold 2000', async () => {
    const req = createMockReq({
      method: 'POST',
      query: { action: 'burn' },
      body: {
        walletId: VALID_WALLET, amount: '100',
        recipientAddress: '0xed0037e27139a7792c7982640d045a9d9f2aae8b',
        direction: 'arc-to-sepolia',
      },
    });
    const res = createMockRes();
    await handler(req as any, res);

    const call = vi.mocked(circlePost).mock.calls[0];
    const params = call[1].abiParameters;
    expect(params[1]).toBe('0'); // SEPOLIA_DOMAIN
    expect(params[6]).toBe('2000'); // minFinalityThreshold
  });

  it('pads recipient address to bytes32', async () => {
    const addr = '0xed0037e27139a7792c7982640d045a9d9f2aae8b';
    const req = createMockReq({
      method: 'POST',
      query: { action: 'burn' },
      body: { walletId: VALID_WALLET, amount: '100', recipientAddress: addr },
    });
    const res = createMockRes();
    await handler(req as any, res);

    const call = vi.mocked(circlePost).mock.calls[0];
    const mintRecipient = call[1].abiParameters[2];
    expect(mintRecipient).toBe('0x000000000000000000000000ed0037e27139a7792c7982640d045a9d9f2aae8b');
    expect(mintRecipient.length).toBe(66);
  });
});

describe('api/bridge - tx-status', () => {
  it('rejects non-GET', async () => {
    const req = createMockReq({ method: 'POST', query: { action: 'tx-status' } });
    const res = createMockRes();
    await handler(req as any, res);
    expect(res.status).toHaveBeenCalledWith(405);
  });

  it('requires txId', async () => {
    const req = createMockReq({ query: { action: 'tx-status' } });
    const res = createMockRes();
    await handler(req as any, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns transaction data on success', async () => {
    const req = createMockReq({ query: { action: 'tx-status', txId: 'tx-123' } });
    const res = createMockRes();
    await handler(req as any, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body.id).toBe('tx-123');
    expect(res.body.state).toBe('COMPLETE');
  });

  it('updates supabase for terminal states', async () => {
    const req = createMockReq({ query: { action: 'tx-status', txId: 'tx-123' } });
    const res = createMockRes();
    await handler(req as any, res);

    expect(updateCircleTxStatus).toHaveBeenCalledWith('tx-123', 'COMPLETE', '0xabc', undefined);
  });

  it('does not update supabase for non-terminal state', async () => {
    vi.mocked(getClient).mockReturnValue({
      getTransaction: vi.fn().mockResolvedValue({
        data: { transaction: { id: 'tx-456', state: 'PENDING' } },
      }),
    } as any);

    const req = createMockReq({ query: { action: 'tx-status', txId: 'tx-456' } });
    const res = createMockRes();
    await handler(req as any, res);

    expect(updateCircleTxStatus).not.toHaveBeenCalled();
  });

  it('returns 404 when transaction not found', async () => {
    vi.mocked(getClient).mockReturnValue({
      getTransaction: vi.fn().mockResolvedValue({ data: { transaction: null } }),
    } as any);

    const req = createMockReq({ query: { action: 'tx-status', txId: 'nonexistent' } });
    const res = createMockRes();
    await handler(req as any, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('api/bridge - claim', () => {
  it('rejects non-POST', async () => {
    const req = createMockReq({ method: 'GET', query: { action: 'claim' } });
    const res = createMockRes();
    await handler(req as any, res);
    expect(res.status).toHaveBeenCalledWith(405);
  });

  it('requires burnTxHash', async () => {
    const req = createMockReq({
      method: 'POST',
      query: { action: 'claim' },
      body: { destWalletId: VALID_WALLET2 },
    });
    const res = createMockRes();
    await handler(req as any, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body.error).toContain('burnTxHash');
  });

  it('requires destWalletId', async () => {
    const req = createMockReq({
      method: 'POST',
      query: { action: 'claim' },
      body: { burnTxHash: VALID_TX_HASH },
    });
    const res = createMockRes();
    await handler(req as any, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body.error).toContain('destWalletId');
  });

  it('returns pending when attestation not ready', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        messages: [{ attestation: 'PENDING' }],
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const req = createMockReq({
      method: 'POST',
      query: { action: 'claim' },
      body: { burnTxHash: VALID_TX_HASH, destWalletId: VALID_WALLET2, direction: 'sepolia-to-arc' },
    });
    const res = createMockRes();
    await handler(req as any, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body.status).toBe('pending');

    vi.unstubAllGlobals();
  });

  it('calls receiveMessage when attestation ready', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        messages: [{
          attestation: '0xATTEST',
          message: '0xMSG',
        }],
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const req = createMockReq({
      method: 'POST',
      query: { action: 'claim' },
      body: {
        burnTxHash: VALID_TX_HASH,
        destWalletId: VALID_WALLET2,
        direction: 'arc-to-sepolia',
        walletAddress: VALID_ADDRESS,
      },
    });
    const res = createMockRes();
    await handler(req as any, res);

    expect(circlePost).toHaveBeenCalledWith(
      '/developer/transactions/contractExecution',
      expect.objectContaining({
        walletId: VALID_WALLET2,
        contractAddress: '0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275',
        abiFunctionSignature: 'receiveMessage(bytes,bytes)',
        abiParameters: ['0xMSG', '0xATTEST'],
      }),
    );

    expect(res.body.status).toBe('submitted');

    vi.unstubAllGlobals();
  });

  it('uses correct destination transmitter per direction', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        messages: [{ attestation: '0xATTEST', message: '0xMSG' }],
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    // sepolia-to-arc: destination is Arc
    const req = createMockReq({
      method: 'POST',
      query: { action: 'claim' },
      body: { burnTxHash: VALID_TX_HASH, destWalletId: VALID_WALLET2, direction: 'sepolia-to-arc' },
    });
    const res = createMockRes();
    await handler(req as any, res);

    expect(circlePost).toHaveBeenCalledWith(
      '/developer/transactions/contractExecution',
      expect.objectContaining({
        contractAddress: '0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275', // ARC_MESSAGE_TRANSMITTER
      }),
    );

    vi.unstubAllGlobals();
  });

  it('returns 502 when attestation API fails', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false });
    vi.stubGlobal('fetch', mockFetch);

    const req = createMockReq({
      method: 'POST',
      query: { action: 'claim' },
      body: { burnTxHash: VALID_TX_HASH, destWalletId: VALID_WALLET2 },
    });
    const res = createMockRes();
    await handler(req as any, res);

    expect(res.status).toHaveBeenCalledWith(502);

    vi.unstubAllGlobals();
  });
});

describe('api/bridge - rate limit buckets', () => {
  it('uses a separate, higher-capacity bucket for tx-status polling', async () => {
    const req = createMockReq({
      method: 'GET',
      query: { action: 'tx-status', txId: 'tx-123' },
    });
    const res = createMockRes();
    await handler(req as any, res);

    // Polling runs every 2s (30/min) — the default 20/min bucket would 429 it
    expect(checkRateLimit).toHaveBeenCalledWith(
      expect.stringContaining('bridge-status:'),
      60,
      expect.any(Number),
    );
  });

  it('keeps the strict bucket for mutating actions', async () => {
    const req = createMockReq({
      method: 'POST',
      query: { action: 'approve' },
      body: { walletId: VALID_WALLET, amount: '100' },
    });
    const res = createMockRes();
    await handler(req as any, res);

    expect(checkRateLimit).toHaveBeenCalledWith(
      expect.stringMatching(/^bridge:/),
      20,
      expect.any(Number),
    );
  });
});

describe('api/bridge - claim authentication', () => {
  it('returns 401 when claim request is unauthenticated', async () => {
    vi.mocked(authenticateUser).mockResolvedValueOnce(null);

    const req = createMockReq({
      method: 'POST',
      query: { action: 'claim' },
      body: { burnTxHash: VALID_TX_HASH, destWalletId: VALID_WALLET2 },
    });
    const res = createMockRes();
    await handler(req as any, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(circlePost).not.toHaveBeenCalled();
  });

  it('returns 403 when destWalletId does not belong to authenticated user', async () => {
    vi.mocked(verifyWalletOwnership).mockResolvedValueOnce(false);

    const req = createMockReq({
      method: 'POST',
      query: { action: 'claim' },
      body: { burnTxHash: VALID_TX_HASH, destWalletId: VALID_WALLET2 },
    });
    const res = createMockRes();
    await handler(req as any, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(circlePost).not.toHaveBeenCalled();
  });

  it('verifies ownership of destWalletId specifically', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ messages: [{ attestation: 'PENDING' }] }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const req = createMockReq({
      method: 'POST',
      query: { action: 'claim' },
      body: { burnTxHash: VALID_TX_HASH, destWalletId: VALID_WALLET2 },
    });
    const res = createMockRes();
    await handler(req as any, res);

    expect(verifyWalletOwnership).toHaveBeenCalledWith('test-user-id', VALID_WALLET2);

    vi.unstubAllGlobals();
  });
});

describe('api/bridge - amount validation', () => {
  it.each(['abc', '-5', '5abc', '1e3', '0'])(
    'rejects approve with invalid amount %s',
    async (amount) => {
      const req = createMockReq({
        method: 'POST',
        query: { action: 'approve' },
        body: { walletId: VALID_WALLET, amount, walletAddress: VALID_ADDRESS },
      });
      const res = createMockRes();
      await handler(req as any, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(circlePost).not.toHaveBeenCalled();
    },
  );

  it('rejects burn with invalid amount', async () => {
    const req = createMockReq({
      method: 'POST',
      query: { action: 'burn' },
      body: { walletId: VALID_WALLET, amount: 'NaN', recipientAddress: VALID_ADDRESS },
    });
    const res = createMockRes();
    await handler(req as any, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(circlePost).not.toHaveBeenCalled();
  });

  it('accepts valid decimal amount', async () => {
    const req = createMockReq({
      method: 'POST',
      query: { action: 'approve' },
      body: { walletId: VALID_WALLET, amount: '15.5', walletAddress: VALID_ADDRESS },
    });
    const res = createMockRes();
    await handler(req as any, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });
});
