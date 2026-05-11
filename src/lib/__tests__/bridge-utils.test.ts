import { describe, it, expect } from 'vitest';
import { toMicro, padAddress, calculateMaxFee } from '../bridge-utils';

describe('toMicro', () => {
  it('converts integer amount', () => {
    expect(toMicro('100')).toBe('100000000');
  });

  it('converts decimal amount', () => {
    expect(toMicro('20.5')).toBe('20500000');
  });

  it('handles exactly 6 decimal places', () => {
    expect(toMicro('1.123456')).toBe('1123456');
  });

  it('truncates beyond 6 decimal places', () => {
    expect(toMicro('1.1234567')).toBe('1123456');
  });

  it('handles zero', () => {
    expect(toMicro('0')).toBe('0');
  });

  it('handles no decimal part', () => {
    expect(toMicro('42')).toBe('42000000');
  });

  it('strips commas', () => {
    expect(toMicro('1,000.50')).toBe('1000500000');
  });

  it('handles very large amount without overflow', () => {
    expect(toMicro('999999999')).toBe('999999999000000');
  });

  it('handles smallest possible micro amount', () => {
    expect(toMicro('0.000001')).toBe('1');
  });

  it('handles leading zeros', () => {
    expect(toMicro('001.5')).toBe('1500000');
  });

  it('handles amount with trailing zeros in decimal', () => {
    expect(toMicro('10.100000')).toBe('10100000');
  });
});

describe('padAddress', () => {
  it('pads a standard 40-char address to bytes32', () => {
    const result = padAddress('0x1234567890abcdef1234567890abcdef12345678');
    expect(result).toBe('0x0000000000000000000000001234567890abcdef1234567890abcdef12345678');
    expect(result.length).toBe(66); // 0x + 64 hex chars
  });

  it('lowercases the address', () => {
    const result = padAddress('0xABCDEF1234567890ABCDEF1234567890ABCDEF12');
    expect(result).toContain('abcdef');
    expect(result).not.toContain('ABCDEF');
  });

  it('handles already-lowercase address', () => {
    const addr = '0xed0037e27139a7792c7982640d045a9d9f2aae8b';
    const result = padAddress(addr);
    expect(result).toBe('0x000000000000000000000000ed0037e27139a7792c7982640d045a9d9f2aae8b');
  });

  it('always produces 66-char output', () => {
    const result = padAddress('0x0000000000000000000000000000000000000001');
    expect(result.length).toBe(66);
  });
});

describe('calculateMaxFee', () => {
  it('returns MIN_FEE for small amounts (below floor)', () => {
    // 10 USDC = 10_000_000 micro. 0.5% = 50_000 < MIN_FEE(100_000)
    expect(calculateMaxFee(10_000_000n)).toBe(100_000n);
  });

  it('returns calculated fee for normal amounts', () => {
    // 100 USDC = 100_000_000 micro. 0.5% = 500_000
    expect(calculateMaxFee(100_000_000n)).toBe(500_000n);
  });

  it('returns MAX_FEE_CAP for large amounts', () => {
    // 2000 USDC = 2_000_000_000 micro. 0.5% = 10_000_000 > MAX_FEE_CAP(5_000_000)
    expect(calculateMaxFee(2_000_000_000n)).toBe(5_000_000n);
  });

  it('returns exact MIN_FEE at the boundary', () => {
    // 20 USDC = 20_000_000 micro. 0.5% = 100_000 = MIN_FEE exactly
    expect(calculateMaxFee(20_000_000n)).toBe(100_000n);
  });

  it('returns exact MAX_FEE_CAP at the boundary', () => {
    // 1000 USDC = 1_000_000_000 micro. 0.5% = 5_000_000 = MAX_FEE_CAP exactly
    expect(calculateMaxFee(1_000_000_000n)).toBe(5_000_000n);
  });

  it('handles zero amount', () => {
    // 0 USDC. 0.5% = 0 < MIN_FEE
    expect(calculateMaxFee(0n)).toBe(100_000n);
  });

  it('handles 1 micro (dust)', () => {
    // 1 micro. 0.5% = 0 (integer division) < MIN_FEE
    expect(calculateMaxFee(1n)).toBe(100_000n);
  });

  it('returns fee between boundaries', () => {
    // 500 USDC = 500_000_000 micro. 0.5% = 2_500_000
    const fee = calculateMaxFee(500_000_000n);
    expect(fee).toBe(2_500_000n);
    expect(fee > 100_000n).toBe(true);
    expect(fee < 5_000_000n).toBe(true);
  });
});
