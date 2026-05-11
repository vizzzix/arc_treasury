import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('sonner', () => ({
  toast: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    loading: vi.fn().mockReturnValue('toast-id'),
    dismiss: vi.fn(),
  },
}));

vi.mock('../bridge/utils', () => ({
  trackSiteBridge: vi.fn(),
}));

import { useServerBridge } from '../useServerBridge';
import { trackSiteBridge } from '../bridge/utils';

function mockFetchSequence(responses: Array<{ ok?: boolean; status?: number; body: any }>) {
  let callIndex = 0;
  return vi.fn().mockImplementation(() => {
    const resp = responses[callIndex] || responses[responses.length - 1];
    callIndex++;
    return Promise.resolve({
      ok: resp.ok !== false,
      status: resp.status || 200,
      json: () => Promise.resolve(resp.body),
    });
  });
}

const originalFetch = globalThis.fetch;

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.stubGlobal('fetch', originalFetch);
  vi.useRealTimers();
});

describe('useServerBridge', () => {
  it('starts with idle state', () => {
    const { result } = renderHook(() => useServerBridge());
    expect(result.current.phase).toBe('idle');
    expect(result.current.isBridging).toBe(false);
    expect(result.current.isComplete).toBe(false);
    expect(result.current.burnTxHash).toBeNull();
    expect(result.current.claimTxHash).toBeNull();
  });

  it('isBridging derives correctly from phase', () => {
    const { result } = renderHook(() => useServerBridge());
    // idle → not bridging
    expect(result.current.isBridging).toBe(false);
  });

  it('reset returns to idle', () => {
    const { result } = renderHook(() => useServerBridge());
    act(() => { result.current.reset(); });
    expect(result.current.phase).toBe('idle');
    expect(result.current.error).toBeNull();
  });

  it('sets error phase on approve failure', async () => {
    const mockFetch = mockFetchSequence([
      { ok: false, status: 500, body: { error: 'Approve failed' } },
    ]);
    vi.stubGlobal('fetch', mockFetch);

    const { result } = renderHook(() => useServerBridge());

    await act(async () => {
      await result.current.bridge('w1', '100', '0xrecipient', 'sepolia-to-arc', 'w2', '0xwallet');
    });

    expect(result.current.phase).toBe('error');
    expect(result.current.error).toContain('Approve failed');
  });

  it('tracks bridge and completes full flow', async () => {
    const fetchMock = mockFetchSequence([
      { body: { transactionId: 'approve-tx' } },
      { body: { state: 'COMPLETE', txHash: '0xapprove' } },
      { body: { transactionId: 'burn-tx' } },
      { body: { state: 'COMPLETE', txHash: '0xburn123' } },
      { body: { messages: [{ attestation: '0xATTEST', message: '0xMSG' }] } },
      { body: { status: 'submitted', transactionId: 'claim-tx' } },
      { body: { state: 'COMPLETE', txHash: '0xclaim' } },
    ]);
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useServerBridge());

    await act(async () => {
      await result.current.bridge('w1', '100', '0xrecipient', 'sepolia-to-arc', 'w2', '0xwallet');
    });

    expect(trackSiteBridge).toHaveBeenCalledWith('0xburn123', '0xrecipient', '100', 'to_arc');
    expect(result.current.phase).toBe('complete');
    expect(result.current.isComplete).toBe(true);
  }, 30_000);

  it('calls correct attestation domain for arc-to-sepolia', async () => {
    const fetchMock = mockFetchSequence([
      { body: { transactionId: 'a1' } },
      { body: { state: 'COMPLETE', txHash: '0xa' } },
      { body: { transactionId: 'b1' } },
      { body: { state: 'COMPLETE', txHash: '0xburn' } },
      { body: { messages: [{ attestation: '0xATT', message: '0xMSG' }] } },
      { body: { status: 'submitted', transactionId: 'c1' } },
      { body: { state: 'COMPLETE', txHash: '0xc' } },
    ]);
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useServerBridge());

    await act(async () => {
      await result.current.bridge('w1', '50', '0xrecipient', 'arc-to-sepolia', 'w2', '0xwallet');
    });

    const calls = fetchMock.mock.calls.map((c: any) => c[0]);
    const attestationCall = calls.find((url: string) => url.includes('action=messages'));
    expect(attestationCall).toContain('domain=26');
    expect(trackSiteBridge).toHaveBeenCalledWith('0xburn', '0xrecipient', '50', 'to_sepolia');
  }, 30_000);

  it('handles claim pending then retry', async () => {
    const fetchMock = mockFetchSequence([
      { body: { transactionId: 'a1' } },
      { body: { state: 'COMPLETE', txHash: '0xa' } },
      { body: { transactionId: 'b1' } },
      { body: { state: 'COMPLETE', txHash: '0xburn' } },
      { body: { messages: [{ attestation: '0xATT', message: '0xMSG' }] } },
      // claim returns pending
      { body: { status: 'pending', message: 'Attestation not ready' } },
      // retry claim succeeds
      { body: { status: 'submitted', transactionId: 'c1' } },
      { body: { state: 'COMPLETE', txHash: '0xclaim' } },
    ]);
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useServerBridge());

    await act(async () => {
      await result.current.bridge('w1', '50', '0xrecipient', 'sepolia-to-arc', 'w2', '0xwallet');
    });

    expect(result.current.phase).toBe('complete');
  }, 30_000);
});
