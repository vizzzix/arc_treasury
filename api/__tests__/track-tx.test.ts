import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockReq, createMockRes } from '../../src/test/mock-vercel';

// Mock external deps before importing handler
vi.mock('../_lib/supabase', () => ({
  supabaseAdmin: {},
  insertCircleTx: vi.fn().mockResolvedValue(undefined),
  updateCircleTxStatus: vi.fn().mockResolvedValue(undefined),
  insertSiteSwap: vi.fn().mockResolvedValue(undefined),
  insertSiteLiquidity: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../_lib/cors', () => ({
  handleCors: vi.fn().mockReturnValue(false),
}));

vi.mock('../_lib/rateLimit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue(true),
  getRateLimitHeaders: vi.fn().mockReturnValue({}),
}));

import handler from '../track-tx';
import { insertSiteSwap, insertSiteLiquidity } from '../_lib/supabase';

const VALID_ADDRESS = '0xed0037e27139a7792c7982640d045a9d9f2aae8b';
const VALID_TX_HASH = '0x' + 'ab'.repeat(32);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('api/track-tx - track-swap isolation from points tables', () => {
  it('writes client swaps to site_swaps, never swap_transactions', async () => {
    const req = createMockReq({
      method: 'POST',
      query: { action: 'track-swap' },
      body: { txHash: VALID_TX_HASH, walletAddress: VALID_ADDRESS, amountUsd: 100, tokenIn: 'USDC', tokenOut: 'EURC' },
    });
    const res = createMockRes();
    await handler(req as any, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(insertSiteSwap).toHaveBeenCalledWith(
      expect.objectContaining({ amount_usd: 100, wallet_address: VALID_ADDRESS, token_in: 'USDC', token_out: 'EURC' }),
    );
  });

  it('rejects amount above the cap (points-forgery guard)', async () => {
    const req = createMockReq({
      method: 'POST',
      query: { action: 'track-swap' },
      body: { txHash: VALID_TX_HASH, walletAddress: VALID_ADDRESS, amountUsd: 1_000_000_000 },
    });
    const res = createMockRes();
    await handler(req as any, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(insertSiteSwap).not.toHaveBeenCalled();
  });

  it('rejects NaN / non-finite amount', async () => {
    const req = createMockReq({
      method: 'POST',
      query: { action: 'track-swap' },
      body: { txHash: VALID_TX_HASH, walletAddress: VALID_ADDRESS, amountUsd: 'abc' },
    });
    const res = createMockRes();
    await handler(req as any, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(insertSiteSwap).not.toHaveBeenCalled();
  });

  it('rejects malformed txHash', async () => {
    const req = createMockReq({
      method: 'POST',
      query: { action: 'track-swap' },
      body: { txHash: '0x123', walletAddress: VALID_ADDRESS, amountUsd: 100 },
    });
    const res = createMockRes();
    await handler(req as any, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(insertSiteSwap).not.toHaveBeenCalled();
  });
});

describe('api/track-tx - track-liquidity isolation', () => {
  it('writes client liquidity to site_liquidity', async () => {
    const req = createMockReq({
      method: 'POST',
      query: { action: 'track-liquidity' },
      body: { txHash: VALID_TX_HASH, walletAddress: VALID_ADDRESS, amountUsd: 500, action: 'add' },
    });
    const res = createMockRes();
    await handler(req as any, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(insertSiteLiquidity).toHaveBeenCalledWith(
      expect.objectContaining({ amount_usd: 500, action: 'add', wallet_address: VALID_ADDRESS }),
    );
  });

  it('rejects amount above the cap', async () => {
    const req = createMockReq({
      method: 'POST',
      query: { action: 'track-liquidity' },
      body: { txHash: VALID_TX_HASH, walletAddress: VALID_ADDRESS, amountUsd: 5_000_000_000, action: 'add' },
    });
    const res = createMockRes();
    await handler(req as any, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(insertSiteLiquidity).not.toHaveBeenCalled();
  });

  it('rejects invalid action', async () => {
    const req = createMockReq({
      method: 'POST',
      query: { action: 'track-liquidity' },
      body: { txHash: VALID_TX_HASH, walletAddress: VALID_ADDRESS, amountUsd: 500, action: 'steal' },
    });
    const res = createMockRes();
    await handler(req as any, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(insertSiteLiquidity).not.toHaveBeenCalled();
  });
});
