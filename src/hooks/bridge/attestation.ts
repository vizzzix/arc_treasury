/**
 * bridge/attestation - Shared CCTP attestation fetching and polling.
 *
 * Single source of truth for talking to the Circle attestation API (via the
 * /api/circle proxy). Replaces the four hand-rolled polling loops that used
 * to live in useBridgeCCTP and useServerBridge.
 *
 * All functions accept an AbortSignal so hooks can cancel in-flight polling
 * when the component unmounts or a new bridge supersedes the current one.
 */

import { CIRCLE_ATTESTATION_API } from '@/lib/constants';

/** Raw message shape returned by Circle's /v2/messages endpoint. */
export interface CctpMessage {
  message?: string;
  attestation?: string;
  decodedMessage?: {
    decodedMessageBody?: {
      amount?: string;
    };
  };
}

export type PollResult =
  | { status: 'ready'; message: `0x${string}`; attestation: `0x${string}` }
  | { status: 'timeout' }
  | { status: 'aborted' };

const DEFAULT_INTERVAL_MS = 2000;
const DEFAULT_MAX_ATTEMPTS = 150; // 150 * 2s = 5 minutes

/** Abort-aware sleep that resolves (never rejects) on abort. */
const sleep = (ms: number, signal?: AbortSignal): Promise<void> =>
  new Promise((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });

/** Fetch the CCTP message for a burn tx on one domain. Null if not found. */
export async function fetchAttestationMessage(
  domain: number,
  txHash: string,
  signal?: AbortSignal,
): Promise<CctpMessage | null> {
  const url = `${CIRCLE_ATTESTATION_API}&domain=${domain}&transactionHash=${txHash}`;
  const response = await fetch(url, { signal });
  if (!response.ok) return null;
  const data = await response.json();
  return data.messages?.[0] ?? null;
}

/**
 * Try each domain in order and return the first message found along with the
 * domain it was found on (= the burn's source domain). Used to auto-detect
 * bridge direction from a bare tx hash.
 */
export async function findAttestationMessage(
  txHash: string,
  domains: number[],
  signal?: AbortSignal,
): Promise<{ message: CctpMessage; domain: number } | null> {
  for (const domain of domains) {
    if (signal?.aborted) return null;
    try {
      const message = await fetchAttestationMessage(domain, txHash, signal);
      if (message) return { message, domain };
    } catch {
      // Network error on this attempt — try the next domain
    }
  }
  return null;
}

/**
 * Poll until the attestation is ready, the attempt budget runs out, or the
 * signal aborts. Fetch errors are swallowed and polling continues.
 */
export async function pollAttestation(options: {
  domain: number;
  txHash: string;
  signal?: AbortSignal;
  intervalMs?: number;
  maxAttempts?: number;
  onTick?: (attempt: number, elapsedSeconds: number) => void;
}): Promise<PollResult> {
  const {
    domain,
    txHash,
    signal,
    intervalMs = DEFAULT_INTERVAL_MS,
    maxAttempts = DEFAULT_MAX_ATTEMPTS,
    onTick,
  } = options;

  if (signal?.aborted) return { status: 'aborted' };

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await sleep(intervalMs, signal);
    if (signal?.aborted) return { status: 'aborted' };

    onTick?.(attempt, Math.round((attempt * intervalMs) / 1000));

    try {
      const msg = await fetchAttestationMessage(domain, txHash, signal);
      if (msg?.attestation && msg.attestation !== 'PENDING' && msg.message) {
        return {
          status: 'ready',
          message: msg.message as `0x${string}`,
          attestation: msg.attestation as `0x${string}`,
        };
      }
    } catch {
      // Transient fetch error — keep polling
    }
    if (signal?.aborted) return { status: 'aborted' };
  }

  return { status: 'timeout' };
}
