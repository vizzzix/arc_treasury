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

// Must set env vars before import
process.env.CircleAPI = 'test-api-key';
process.env.CIRCLE_ENTITY_SECRET = 'test-secret';

import handler from '../bridge';
import { circlePost, getClient } from '../_lib/circle';
import { trackTx, updateCircleTxStatus } from '../_lib/supabase';

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
      body: { walletId: 'w1', amount: '100', walletAddress: '0xabc' },
    });
    const res = createMockRes();
    await handler(req as any, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(circlePost).toHaveBeenCalledWith(
      '/developer/transactions/contractExecution',
      expect.objectContaining({
        walletId: 'w1',
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
      body: { walletId: 'w1', amount: '50', direction: 'arc-to-sepolia' },
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
      body: { walletId: 'w1', amount: '100' },
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
      body: { walletId: 'w1', amount: '100' },
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
        walletId: 'w1', amount: '100',
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
        walletId: 'w1', amount: '100',
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
      body: { walletId: 'w1', amount: '100', recipientAddress: addr },
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
      body: { destWalletId: 'w2' },
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
      body: { burnTxHash: '0xabc' },
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
      body: { burnTxHash: '0xabc', destWalletId: 'w2', direction: 'sepolia-to-arc' },
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
        burnTxHash: '0xabc',
        destWalletId: 'w2',
        direction: 'arc-to-sepolia',
        walletAddress: '0xed00',
      },
    });
    const res = createMockRes();
    await handler(req as any, res);

    expect(circlePost).toHaveBeenCalledWith(
      '/developer/transactions/contractExecution',
      expect.objectContaining({
        walletId: 'w2',
        contractAddress: '0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275', // SEPOLIA_MESSAGE_TRANSMITTER
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
      body: { burnTxHash: '0xabc', destWalletId: 'w2', direction: 'sepolia-to-arc' },
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
      body: { burnTxHash: '0xabc', destWalletId: 'w2' },
    });
    const res = createMockRes();
    await handler(req as any, res);

    expect(res.status).toHaveBeenCalledWith(502);

    vi.unstubAllGlobals();
  });
});
