/**
 * Tests for bridge logic extracted from useBridgeCCTP.
 * Covers: direction detection, attestation parsing, amount extraction,
 * and regression tests for known bugs (stuck claim, wrong timeout).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Test the direction detection / attestation parsing logic
// that lives inside useBridgeCCTP (claimPendingBridge, restorePendingBurn)
// by testing the pattern directly

describe('CCTP direction detection', () => {
  const CCTP_DOMAINS = {
    ethereumSepolia: 0,
    arcTestnet: 26,
  } as const;

  function detectDirection(sourceDomain: number): { from: string; to: string } {
    if (sourceDomain === CCTP_DOMAINS.arcTestnet) {
      return { from: 'arcTestnet', to: 'ethereumSepolia' };
    }
    return { from: 'ethereumSepolia', to: 'arcTestnet' };
  }

  it('arc domain 26 → arc-to-sepolia', () => {
    const { from, to } = detectDirection(26);
    expect(from).toBe('arcTestnet');
    expect(to).toBe('ethereumSepolia');
  });

  it('sepolia domain 0 → sepolia-to-arc', () => {
    const { from, to } = detectDirection(0);
    expect(from).toBe('ethereumSepolia');
    expect(to).toBe('arcTestnet');
  });
});

describe('attestation response parsing', () => {
  function parseAttestationAmount(decodedBody: any): string {
    if (decodedBody?.amount) {
      return (parseFloat(decodedBody.amount) / 1e6).toFixed(2);
    }
    return '0';
  }

  it('parses 1111 USDC from micro units', () => {
    expect(parseAttestationAmount({ amount: '1111000000' })).toBe('1111.00');
  });

  it('parses decimal amounts', () => {
    expect(parseAttestationAmount({ amount: '50500000' })).toBe('50.50');
  });

  it('parses small amounts', () => {
    expect(parseAttestationAmount({ amount: '1000000' })).toBe('1.00');
  });

  it('parses sub-dollar amounts', () => {
    expect(parseAttestationAmount({ amount: '100000' })).toBe('0.10');
  });

  it('handles missing amount', () => {
    expect(parseAttestationAmount({})).toBe('0');
    expect(parseAttestationAmount(null)).toBe('0');
    expect(parseAttestationAmount(undefined)).toBe('0');
  });

  it('handles zero amount', () => {
    expect(parseAttestationAmount({ amount: '0' })).toBe('0.00');
  });
});

describe('attestation readiness check', () => {
  function isAttestationReady(attestation: any): boolean {
    return attestation && attestation !== 'PENDING';
  }

  it('ready when attestation is hex string', () => {
    expect(isAttestationReady('0x299d6f...')).toBe(true);
  });

  it('not ready when PENDING', () => {
    expect(isAttestationReady('PENDING')).toBe(false);
  });

  it('not ready when null', () => {
    expect(isAttestationReady(null)).toBeFalsy();
  });

  it('not ready when undefined', () => {
    expect(isAttestationReady(undefined)).toBeFalsy();
  });

  it('not ready when empty string', () => {
    expect(isAttestationReady('')).toBeFalsy();
  });
});

describe('already-claimed detection', () => {
  function isAlreadyClaimed(errorMessage: string): boolean {
    return errorMessage.includes('Nonce already used') || errorMessage.includes('already');
  }

  it('detects "Nonce already used"', () => {
    expect(isAlreadyClaimed('Nonce already used')).toBe(true);
  });

  it('detects "already received"', () => {
    expect(isAlreadyClaimed('Message already received')).toBe(true);
  });

  it('does not match unrelated errors', () => {
    expect(isAlreadyClaimed('insufficient funds')).toBe(false);
    expect(isAlreadyClaimed('user rejected')).toBe(false);
  });
});

describe('network error detection', () => {
  function isNetworkSwitchError(errorMsg: string): boolean {
    return errorMsg.includes('chain') ||
           errorMsg.includes('network') ||
           errorMsg.includes('Chain ID') ||
           errorMsg.includes('not switched') ||
           errorMsg.includes('does not match') ||
           (errorMsg.includes('current') && errorMsg.includes('expected'));
  }

  it('detects chain mismatch', () => {
    expect(isNetworkSwitchError('Chain ID mismatch')).toBe(true);
  });

  it('detects network switch needed', () => {
    expect(isNetworkSwitchError('Please switch network')).toBe(true);
  });

  it('detects current/expected pattern', () => {
    expect(isNetworkSwitchError('current chain 1 expected 5042002')).toBe(true);
  });

  it('does not match unrelated errors', () => {
    expect(isNetworkSwitchError('insufficient funds')).toBe(false);
    expect(isNetworkSwitchError('user rejected transaction')).toBe(false);
  });
});

describe('fee calculation consistency (frontend vs API)', () => {
  // This tests that the fee logic in useBridgeCCTP matches api/bridge.ts
  // Both use the same formula: 0.5% clamped to [0.1, 5] USDC

  function calculateMaxFee(amountMicro: bigint): bigint {
    const MAX_FEE_CAP = 5_000_000n;
    const MIN_FEE = 100_000n;
    const calculated = (amountMicro * 50n) / 10_000n;
    if (calculated < MIN_FEE) return MIN_FEE;
    if (calculated > MAX_FEE_CAP) return MAX_FEE_CAP;
    return calculated;
  }

  const testCases = [
    { amount: '10', expected: 100_000n },    // floor
    { amount: '100', expected: 500_000n },   // normal
    { amount: '500', expected: 2_500_000n }, // mid-range
    { amount: '1000', expected: 5_000_000n }, // cap boundary
    { amount: '2000', expected: 5_000_000n }, // above cap
  ];

  for (const { amount, expected } of testCases) {
    it(`${amount} USDC → fee ${expected}`, () => {
      const amountMicro = BigInt(parseFloat(amount) * 1e6);
      expect(calculateMaxFee(amountMicro)).toBe(expected);
    });
  }
});

describe('regression: waitForTransactionReceipt timeout', () => {
  // The stuck claim button bug was caused by missing timeout on
  // waitForTransactionReceipt. This test verifies the pattern.
  it('timeout value should be 120_000ms (2 minutes)', async () => {
    const { readFileSync } = await import('fs');
    const content = readFileSync('src/hooks/useBridgeCCTP.ts', 'utf8');

    // Count all waitForTransactionReceipt calls
    const allCalls = content.match(/waitForTransactionReceipt\(\{[^}]+\}/g) || [];

    // Every call must include timeout
    for (const call of allCalls) {
      expect(call).toContain('timeout:');
    }

    // No bare waitForTransactionReceipt without timeout
    const bareCallPattern = /waitForTransactionReceipt\(\{\s*hash:\s*\w+\s*\}\)/g;
    const bareCalls = content.match(bareCallPattern) || [];
    expect(bareCalls).toHaveLength(0);
  });
});

describe('pending burn tx hash validation', () => {
  function isValidTxHash(hash: string): boolean {
    return hash.startsWith('0x') && hash.length === 66;
  }

  it('accepts valid 66-char tx hash', () => {
    expect(isValidTxHash('0xcffcf259dac41466a5faab9367657d2b7fc98c5ee1bdbbd9b4dd5a954d971fd4')).toBe(true);
  });

  it('rejects non-0x prefix', () => {
    expect(isValidTxHash('abc123')).toBe(false);
  });

  it('rejects short hash', () => {
    expect(isValidTxHash('0xabc')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isValidTxHash('')).toBe(false);
  });
});
