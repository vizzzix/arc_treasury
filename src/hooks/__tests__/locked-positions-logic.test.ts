import { describe, it, expect } from 'vitest';
import { parseUnits, parseEther } from 'viem';
import { calculateEarnedYield, mapLockedPosition } from '../useLockedPositions';
import type { LockedPosition } from '../useLockedPositions';

const NATIVE_USDC = '0x3600000000000000000000000000000000000000' as `0x${string}`;
const EURC_TOKEN = '0x742b2d045d430fe718b57046645ba33295914b69' as `0x${string}`;

describe('calculateEarnedYield', () => {
  it('calculates yield for 1 year at 5%', () => {
    const depositTime = new Date('2025-01-01');
    const now = new Date('2026-01-01').getTime();
    const result = calculateEarnedYield(1000, 5, depositTime, now);
    expect(result).toBeCloseTo(50, 0);
  });

  it('calculates yield for 6 months at 4%', () => {
    const depositTime = new Date('2025-01-01');
    const now = new Date('2025-07-02').getTime(); // ~6 months
    const result = calculateEarnedYield(1000, 4, depositTime, now);
    expect(result).toBeCloseTo(20, 0);
  });

  it('returns 0 for zero amount', () => {
    const depositTime = new Date('2025-01-01');
    const now = new Date('2026-01-01').getTime();
    expect(calculateEarnedYield(0, 5, depositTime, now)).toBe(0);
  });

  it('returns 0 for zero APY', () => {
    const depositTime = new Date('2025-01-01');
    const now = new Date('2026-01-01').getTime();
    expect(calculateEarnedYield(1000, 0, depositTime, now)).toBe(0);
  });

  it('returns ~0 for just-deposited position', () => {
    const now = Date.now();
    const depositTime = new Date(now);
    expect(calculateEarnedYield(1000, 5, depositTime, now)).toBeCloseTo(0, 5);
  });
});

describe('mapLockedPosition', () => {
  const baseTime = Math.floor(new Date('2025-01-01').getTime() / 1000);
  const threeMonthsLater = baseTime + 90 * 24 * 60 * 60;

  function makePosition(overrides: Partial<LockedPosition> = {}): LockedPosition {
    return {
      id: 1n,
      amount: parseEther('100'), // 100 USDC (18 dec)
      token: NATIVE_USDC,
      lockPeriodMonths: 3,
      depositTime: BigInt(baseTime),
      unlockTime: BigInt(threeMonthsLater),
      lastYieldClaim: BigInt(baseTime),
      withdrawn: false,
      ...overrides,
    };
  }

  it('returns null for withdrawn positions', () => {
    const pos = makePosition({ withdrawn: true });
    expect(mapLockedPosition(pos, 0, 5)).toBeNull();
  });

  it('maps USDC position correctly (18 decimals)', () => {
    const pos = makePosition({ amount: parseEther('500') });
    const result = mapLockedPosition(pos, 2, 4.5);
    expect(result).not.toBeNull();
    expect(result!.amount).toBeCloseTo(500, 1);
    expect(result!.token).toBe('USDC');
    expect(result!.arrayIndex).toBe(2);
    expect(result!.lockPeriodMonths).toBe(3);
    expect(result!.currentAPY).toBe(4.5);
  });

  it('maps EURC position correctly (6 decimals)', () => {
    const pos = makePosition({
      amount: parseUnits('250', 6),
      token: EURC_TOKEN,
    });
    const result = mapLockedPosition(pos, 0, 5);
    expect(result).not.toBeNull();
    expect(result!.amount).toBeCloseTo(250, 1);
    expect(result!.token).toBe('EURC');
  });

  it('detects unlocked position', () => {
    const pos = makePosition();
    // Set now to well past unlock time
    const now = (threeMonthsLater + 86400) * 1000;
    const result = mapLockedPosition(pos, 0, 5, now);
    expect(result!.isUnlocked).toBe(true);
  });

  it('detects locked position', () => {
    const pos = makePosition();
    // Set now to before unlock time
    const now = (baseTime + 86400) * 1000; // 1 day after deposit
    const result = mapLockedPosition(pos, 0, 5, now);
    expect(result!.isUnlocked).toBe(false);
  });

  it('calculates earned yield', () => {
    const pos = makePosition({ amount: parseEther('1000') });
    // 1 year after deposit at 5%
    const oneYearLater = (baseTime + 365 * 24 * 60 * 60) * 1000;
    const result = mapLockedPosition(pos, 0, 5, oneYearLater);
    expect(result!.earnedYield).toBeCloseTo(50, 0);
  });

  it('converts id to string', () => {
    const pos = makePosition({ id: 42n });
    const result = mapLockedPosition(pos, 0, 5);
    expect(result!.id).toBe('42');
  });

  it('handles 12-month lock period', () => {
    const pos = makePosition({ lockPeriodMonths: 12 });
    const result = mapLockedPosition(pos, 0, 5);
    expect(result!.lockPeriodMonths).toBe(12);
  });
});
