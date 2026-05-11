import { describe, it, expect } from 'vitest';
import { parseUnits } from 'viem';
import {
  formatPoolValue,
  formatShares,
  calculateFlexibleYield,
  calculateEURCPricePerShare,
} from '../useTreasuryVault';

describe('formatPoolValue', () => {
  it('returns "0.00" for undefined', () => {
    expect(formatPoolValue(undefined)).toBe('0.00');
  });

  it('returns "0.00" for 0n', () => {
    expect(formatPoolValue(0n)).toBe('0.00');
  });

  it('formats 6-decimal bigint correctly', () => {
    expect(formatPoolValue(1_500_000n)).toBe('1.50');
  });

  it('formats large values', () => {
    expect(formatPoolValue(1_234_567_890n)).toBe('1234.57');
  });
});

describe('formatShares', () => {
  it('returns "0" for undefined', () => {
    expect(formatShares(undefined)).toBe('0');
  });

  it('returns "0" for 0n (falsy bigint)', () => {
    expect(formatShares(0n)).toBe('0');
  });

  it('formats 18-decimal shares', () => {
    const shares = parseUnits('100.5', 18);
    expect(formatShares(shares)).toBe('100.500000');
  });

  it('uses floor rounding to prevent "Insufficient shares" errors', () => {
    // 1.9999999... should floor to 1.999999, not round up to 2.000000
    const shares = parseUnits('1.9999999', 18);
    const result = parseFloat(formatShares(shares));
    expect(result).toBeLessThanOrEqual(2.0);
    expect(result).toBeGreaterThan(1.999998);
  });

  it('floors at 6 decimal places', () => {
    // Exact value: 0.1234567890... → should floor to 0.123456
    const shares = 123456789012345678n; // ~0.12345678...
    const result = formatShares(shares);
    expect(result).toBe('0.123456');
  });
});

describe('calculateFlexibleYield', () => {
  it('returns positive yield when current > deposited', () => {
    const deposited = parseUnits('100', 6);   // 100 USDC deposited
    const current = parseUnits('105', 6);     // 105 USDC current value
    expect(calculateFlexibleYield(deposited, current)).toBeCloseTo(5, 1);
  });

  it('returns 0 when deposited > current (no negative yield)', () => {
    const deposited = parseUnits('100', 6);
    const current = parseUnits('95', 6);
    expect(calculateFlexibleYield(deposited, current)).toBe(0);
  });

  it('returns 0 when deposited equals current', () => {
    const deposited = parseUnits('100', 6);
    const current = parseUnits('100', 6);
    expect(calculateFlexibleYield(deposited, current)).toBe(0);
  });

  it('handles zero deposits', () => {
    const deposited = 0n;
    const current = parseUnits('10', 6);
    expect(calculateFlexibleYield(deposited, current)).toBeCloseTo(10, 1);
  });
});

describe('calculateEURCPricePerShare', () => {
  it('returns "1.00" when no data', () => {
    expect(calculateEURCPricePerShare(undefined, undefined)).toBe('1.00');
  });

  it('returns "1.00" when shares are 0', () => {
    expect(calculateEURCPricePerShare(1_000_000n, 0n)).toBe('1.00');
  });

  it('returns ~1.0000 for balanced pool', () => {
    // totalEURC = 1000 EURC (6 decimals) = 1_000_000_000
    // totalEURCShares = 1000 shares (18 decimals) = 1000 * 1e18
    const totalEURC = 1_000_000_000n;
    const totalEURCShares = parseUnits('1000', 18);
    const price = parseFloat(calculateEURCPricePerShare(totalEURC, totalEURCShares));
    expect(price).toBeCloseTo(1.0, 2);
  });

  it('calculates higher price when EURC > shares', () => {
    // 2000 EURC backing 1000 shares = 2.0 per share
    const totalEURC = 2_000_000_000n;
    const totalEURCShares = parseUnits('1000', 18);
    const price = parseFloat(calculateEURCPricePerShare(totalEURC, totalEURCShares));
    expect(price).toBeCloseTo(2.0, 2);
  });
});
