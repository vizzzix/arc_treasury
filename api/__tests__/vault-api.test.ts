import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockReq, createMockRes } from '../../src/test/mock-vercel';

vi.mock('../_lib/circle', () => ({
  circlePost: vi.fn().mockResolvedValue({ id: 'tx-abc', state: 'PENDING' }),
  getClient: vi.fn().mockReturnValue({
    getTransaction: vi.fn().mockResolvedValue({
      data: { transaction: { id: 'tx-abc', state: 'COMPLETE', txHash: '0xabc' } },
    }),
  }),
  CIRCLE_API_BASE: 'https://api.circle.com/v1/w3s',
}));

vi.mock('../_lib/supabase', () => ({
  trackTx: vi.fn().mockResolvedValue(undefined),
  updateCircleTxStatus: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../_lib/cors', () => ({ handleCors: vi.fn().mockReturnValue(false) }));

vi.mock('../_lib/rateLimit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue(true),
  getRateLimitHeaders: vi.fn().mockReturnValue({}),
}));

vi.mock('../_lib/auth', () => ({
  authenticateUser: vi.fn().mockResolvedValue({ userId: 'user-1' }),
  verifyWalletOwnership: vi.fn().mockResolvedValue(true),
}));

vi.mock('../_lib/sentry', () => ({ captureApiError: vi.fn() }));

process.env.CircleAPI = 'test';
process.env.CIRCLE_ENTITY_SECRET = 'test';

import handler from '../vault';
import { circlePost } from '../_lib/circle';
import { checkRateLimit } from '../_lib/rateLimit';

const WALLET = '00000000-0000-0000-0000-000000000001';
const ADDR = '0xed0037e27139a7792c7982640d045a9d9f2aae8b';

beforeEach(() => vi.clearAllMocks());

describe('api/vault - rate limit buckets', () => {
  it('uses a separate higher-capacity bucket for tx-status polling', async () => {
    const req = createMockReq({ method: 'GET', query: { action: 'tx-status', txId: WALLET } });
    const res = createMockRes();
    await handler(req as any, res);
    expect(checkRateLimit).toHaveBeenCalledWith(expect.stringContaining('vault-status:'), 60, expect.any(Number));
  });

  it('keeps the strict bucket for mutating actions', async () => {
    const req = createMockReq({
      method: 'POST', query: { action: 'deposit-usdc' },
      body: { walletId: WALLET, amount: '100', walletAddress: ADDR },
    });
    const res = createMockRes();
    await handler(req as any, res);
    expect(checkRateLimit).toHaveBeenCalledWith(expect.stringMatching(/^vault:/), 30, expect.any(Number));
  });
});

describe('api/vault - amount validation', () => {
  it.each(['abc', '1e5', '-5', '0', '5abc', ' 5 '])(
    'rejects deposit-usdc with invalid amount %s',
    async (amount) => {
      const req = createMockReq({
        method: 'POST', query: { action: 'deposit-usdc' },
        body: { walletId: WALLET, amount, walletAddress: ADDR },
      });
      const res = createMockRes();
      await handler(req as any, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(circlePost).not.toHaveBeenCalled();
    },
  );

  it('accepts a valid decimal deposit', async () => {
    const req = createMockReq({
      method: 'POST', query: { action: 'deposit-usdc' },
      body: { walletId: WALLET, amount: '12.5', walletAddress: ADDR },
    });
    const res = createMockRes();
    await handler(req as any, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(circlePost).toHaveBeenCalled();
  });

  it('rejects add-liquidity when one amount is invalid', async () => {
    const req = createMockReq({
      method: 'POST', query: { action: 'add-liquidity' },
      body: { walletId: WALLET, usdcAmount: '100', eurcAmount: 'abc', walletAddress: ADDR },
    });
    const res = createMockRes();
    await handler(req as any, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(circlePost).not.toHaveBeenCalled();
  });
});

describe('api/vault - shares validation (raw uint)', () => {
  it('accepts a wei-scale integer shares string', async () => {
    const req = createMockReq({
      method: 'POST', query: { action: 'withdraw-usdc' },
      body: { walletId: WALLET, shares: '5000000000000000000', walletAddress: ADDR },
    });
    const res = createMockRes();
    await handler(req as any, res);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it.each(['1.5', 'abc', '-1', '0', '5e18'])(
    'rejects invalid shares %s',
    async (shares) => {
      const req = createMockReq({
        method: 'POST', query: { action: 'withdraw-usdc' },
        body: { walletId: WALLET, shares, walletAddress: ADDR },
      });
      const res = createMockRes();
      await handler(req as any, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(circlePost).not.toHaveBeenCalled();
    },
  );
});
