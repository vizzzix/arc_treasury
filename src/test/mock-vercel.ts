import { vi } from 'vitest';

export function createMockReq(overrides: {
  method?: string;
  query?: Record<string, string>;
  body?: any;
  headers?: Record<string, string>;
} = {}) {
  return {
    method: overrides.method || 'GET',
    query: overrides.query || {},
    body: overrides.body || {},
    headers: overrides.headers || {
      'x-forwarded-for': '127.0.0.1',
      origin: 'https://arctreasury.biz',
    },
    socket: { remoteAddress: '127.0.0.1' },
  };
}

export function createMockRes() {
  const res: any = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: null as any,
    redirectUrl: null as string | null,
  };

  res.status = vi.fn((code: number) => {
    res.statusCode = code;
    return res;
  });

  res.json = vi.fn((data: any) => {
    res.body = data;
    return res;
  });

  res.setHeader = vi.fn((key: string, value: string) => {
    res.headers[key] = value;
    return res;
  });

  res.redirect = vi.fn((url: string) => {
    res.redirectUrl = url;
    return res;
  });

  res.end = vi.fn(() => res);

  return res;
}
