import { describe, it, expect } from 'vitest';
import { calculateBridgeFee } from '@/lib/bridgeFee';

describe('calculateBridgeFee', () => {
  it('returns 0.5% of amount for normal amounts', () => {
    // 1000 USDC (6 decimals) = 1_000_000_000
    // 0.5% = 5_000_000 (5 USDC) — hits cap
    const fee = calculateBridgeFee(1_000_000_000n);
    expect(fee).toBe(5_000_000n); // capped at 5 USDC
  });

  it('returns MIN_FEE (0.1 USDC) for very small amounts', () => {
    // 1 USDC = 1_000_000 → 0.5% = 5000 → below MIN_FEE
    const fee = calculateBridgeFee(1_000_000n);
    expect(fee).toBe(100_000n); // 0.1 USDC floor
  });

  it('returns MAX_FEE_CAP (5 USDC) for very large amounts', () => {
    // 10000 USDC = 10_000_000_000 → 0.5% = 50_000_000 → above cap
    const fee = calculateBridgeFee(10_000_000_000n);
    expect(fee).toBe(5_000_000n); // 5 USDC cap
  });

  it('calculates exact 0.5% for mid-range amounts', () => {
    // 200 USDC = 200_000_000 → 0.5% = 1_000_000 (1 USDC)
    const fee = calculateBridgeFee(200_000_000n);
    expect(fee).toBe(1_000_000n);
  });

  it('returns MIN_FEE for 10 USDC (0.5% = 50000 < 100000)', () => {
    const fee = calculateBridgeFee(10_000_000n);
    expect(fee).toBe(100_000n);
  });

  it('returns exact fee at boundary (20 USDC → 0.5% = 100000 = MIN_FEE)', () => {
    const fee = calculateBridgeFee(20_000_000n);
    expect(fee).toBe(100_000n); // exactly MIN_FEE
  });

  it('returns exact fee at upper boundary (1000 USDC → 0.5% = 5000000 = MAX_FEE)', () => {
    const fee = calculateBridgeFee(1_000_000_000n);
    expect(fee).toBe(5_000_000n); // exactly MAX_FEE
  });

  it('returns calculated fee just above min threshold', () => {
    // 30 USDC = 30_000_000 → 0.5% = 150_000 → above MIN_FEE
    const fee = calculateBridgeFee(30_000_000n);
    expect(fee).toBe(150_000n);
  });
});
