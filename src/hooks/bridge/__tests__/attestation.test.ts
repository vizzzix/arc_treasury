import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchAttestationMessage,
  findAttestationMessage,
  pollAttestation,
} from '../attestation';

const TX_HASH = '0x' + 'ab'.repeat(32);

const readyMessage = {
  message: '0xMSG',
  attestation: '0xATTEST',
  decodedMessage: { decodedMessageBody: { amount: '5000000' } },
};

const pendingMessage = { message: '0xMSG', attestation: 'PENDING' };

const jsonResponse = (body: unknown, ok = true) => ({
  ok,
  json: () => Promise.resolve(body),
});

describe('bridge/attestation', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  describe('fetchAttestationMessage', () => {
    it('returns the first message for a domain', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ messages: [readyMessage] }));

      const msg = await fetchAttestationMessage(0, TX_HASH);

      expect(msg).toEqual(readyMessage);
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining(`domain=0&transactionHash=${TX_HASH}`),
        expect.any(Object),
      );
    });

    it('returns null when no messages found', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ messages: [] }));
      expect(await fetchAttestationMessage(26, TX_HASH)).toBeNull();
    });

    it('returns null on non-ok response', async () => {
      fetchMock.mockResolvedValue(jsonResponse({}, false));
      expect(await fetchAttestationMessage(0, TX_HASH)).toBeNull();
    });
  });

  describe('findAttestationMessage', () => {
    it('tries domains in order and returns the first hit with its domain', async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ messages: [] }))
        .mockResolvedValueOnce(jsonResponse({ messages: [readyMessage] }));

      const result = await findAttestationMessage(TX_HASH, [0, 26]);

      expect(result).toEqual({ message: readyMessage, domain: 26 });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('returns null when no domain has the message', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ messages: [] }));
      expect(await findAttestationMessage(TX_HASH, [0, 26])).toBeNull();
    });

    it('continues to next domain when a fetch throws', async () => {
      fetchMock
        .mockRejectedValueOnce(new Error('network'))
        .mockResolvedValueOnce(jsonResponse({ messages: [readyMessage] }));

      const result = await findAttestationMessage(TX_HASH, [0, 26]);
      expect(result?.domain).toBe(26);
    });
  });

  describe('pollAttestation', () => {
    it('resolves ready when attestation becomes available', async () => {
      vi.useFakeTimers();
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ messages: [pendingMessage] }))
        .mockResolvedValueOnce(jsonResponse({ messages: [readyMessage] }));

      const promise = pollAttestation({ domain: 0, txHash: TX_HASH, intervalMs: 1000 });
      await vi.advanceTimersByTimeAsync(2500);
      const result = await promise;

      expect(result).toEqual({
        status: 'ready',
        message: '0xMSG',
        attestation: '0xATTEST',
      });
    });

    it('calls onTick each attempt with elapsed seconds', async () => {
      vi.useFakeTimers();
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ messages: [pendingMessage] }))
        .mockResolvedValueOnce(jsonResponse({ messages: [readyMessage] }));
      const onTick = vi.fn();

      const promise = pollAttestation({ domain: 0, txHash: TX_HASH, intervalMs: 1000, onTick });
      await vi.advanceTimersByTimeAsync(2500);
      await promise;

      expect(onTick).toHaveBeenCalledWith(1, 1);
      expect(onTick).toHaveBeenCalledWith(2, 2);
    });

    it('returns timeout after maxAttempts', async () => {
      vi.useFakeTimers();
      fetchMock.mockResolvedValue(jsonResponse({ messages: [pendingMessage] }));

      const promise = pollAttestation({
        domain: 0,
        txHash: TX_HASH,
        intervalMs: 100,
        maxAttempts: 3,
      });
      await vi.advanceTimersByTimeAsync(1000);
      const result = await promise;

      expect(result).toEqual({ status: 'timeout' });
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('returns aborted when signal fires mid-poll', async () => {
      vi.useFakeTimers();
      fetchMock.mockResolvedValue(jsonResponse({ messages: [pendingMessage] }));
      const controller = new AbortController();

      const promise = pollAttestation({
        domain: 0,
        txHash: TX_HASH,
        intervalMs: 1000,
        signal: controller.signal,
      });
      await vi.advanceTimersByTimeAsync(1500);
      controller.abort();
      await vi.advanceTimersByTimeAsync(100);
      const result = await promise;

      expect(result).toEqual({ status: 'aborted' });
    });

    it('returns aborted immediately when signal is already aborted', async () => {
      const controller = new AbortController();
      controller.abort();

      const result = await pollAttestation({
        domain: 0,
        txHash: TX_HASH,
        signal: controller.signal,
      });

      expect(result).toEqual({ status: 'aborted' });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('keeps polling through fetch errors', async () => {
      vi.useFakeTimers();
      fetchMock
        .mockRejectedValueOnce(new Error('network blip'))
        .mockResolvedValueOnce(jsonResponse({ messages: [readyMessage] }));

      const promise = pollAttestation({ domain: 0, txHash: TX_HASH, intervalMs: 100 });
      await vi.advanceTimersByTimeAsync(500);
      const result = await promise;

      expect(result.status).toBe('ready');
    });
  });
});
