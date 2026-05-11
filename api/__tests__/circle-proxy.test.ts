import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockReq, createMockRes } from '../../src/test/mock-vercel';

vi.mock('../_lib/supabase', () => ({
  updateCircleTxStatus: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../_lib/cors', () => ({
  handleCors: vi.fn().mockReturnValue(false),
}));

import handler from '../circle';

const VALID_TX_HASH = '0x' + 'ab'.repeat(32);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('api/circle - messages proxy', () => {
  it('returns 400 when domain missing', async () => {
    const req = createMockReq({ query: { action: 'messages', transactionHash: VALID_TX_HASH } });
    const res = createMockRes();
    await handler(req as any, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body.error).toContain('domain');
  });

  it('returns 400 when transactionHash missing', async () => {
    const req = createMockReq({ query: { action: 'messages', domain: '26' } });
    const res = createMockRes();
    await handler(req as any, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body.error).toContain('transactionHash');
  });

  it('proxies to correct Circle API URL', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ messages: [{ status: 'complete' }] }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const req = createMockReq({
      query: { action: 'messages', domain: '26', transactionHash: VALID_TX_HASH },
    });
    const res = createMockRes();
    await handler(req as any, res);

    expect(mockFetch).toHaveBeenCalledWith(
      `https://iris-api-sandbox.circle.com/v2/messages/26?transactionHash=${VALID_TX_HASH}`,
      expect.objectContaining({ headers: { Accept: 'application/json' } }),
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body.messages).toBeDefined();

    vi.unstubAllGlobals();
  });

  it('forwards error status from Circle API', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ error: 'Not found' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const req = createMockReq({
      query: { action: 'messages', domain: '0', transactionHash: VALID_TX_HASH },
    });
    const res = createMockRes();
    await handler(req as any, res);

    expect(res.status).toHaveBeenCalledWith(404);

    vi.unstubAllGlobals();
  });
});

describe('api/circle - fees proxy', () => {
  it('returns 400 when params missing', async () => {
    const req = createMockReq({ query: { action: 'fees' } });
    const res = createMockRes();
    await handler(req as any, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('proxies fees request correctly', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ fee: '0.1' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const req = createMockReq({
      query: { action: 'fees', destDomain: '26', srcDomain: '0' },
    });
    const res = createMockRes();
    await handler(req as any, res);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://iris-api-sandbox.circle.com/v2/burn/USDC/fees/26/0',
      expect.any(Object),
    );

    vi.unstubAllGlobals();
  });
});

describe('api/circle - routing', () => {
  it('returns 400 for invalid action', async () => {
    const req = createMockReq({ query: { action: 'unknown' } });
    const res = createMockRes();
    await handler(req as any, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rejects non-GET for messages', async () => {
    const req = createMockReq({ method: 'POST', query: { action: 'messages' } });
    const res = createMockRes();
    await handler(req as any, res);
    expect(res.status).toHaveBeenCalledWith(405);
  });
});

describe('api/circle - webhook', () => {
  it('returns 200 for HEAD request', async () => {
    const req = createMockReq({ method: 'HEAD', query: { action: 'webhook' } });
    const res = createMockRes();
    await handler(req as any, res);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('rejects non-POST/HEAD webhook', async () => {
    const req = createMockReq({ method: 'GET', query: { action: 'webhook' } });
    const res = createMockRes();
    await handler(req as any, res);
    expect(res.status).toHaveBeenCalledWith(405);
  });

  it('rejects missing signature headers', async () => {
    const req = createMockReq({
      method: 'POST',
      query: { action: 'webhook' },
      headers: { 'x-forwarded-for': '54.243.112.156', origin: '' },
    });
    const res = createMockRes();
    await handler(req as any, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });
});
