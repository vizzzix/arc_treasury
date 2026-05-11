import { describe, it, expect } from 'vitest';
import { parseEther, parseUnits } from 'viem';
import {
  calculateSlippageMinOutput,
  calculateTotalLiquidityUsd,
  calculateRemoveLiquidityMinOutputs,
} from '../useSwapPool';

describe('calculateSlippageMinOutput', () => {
  it('applies 0.5% slippage correctly', () => {
    const output = parseUnits('100', 6); // 100 EURC
    const result = calculateSlippageMinOutput(output, 0.5);
    // 100 - 0.5% = 99.5 → 99_500_000
    expect(result).toBe(99_500_000n);
  });

  it('applies 1% slippage correctly', () => {
    const output = parseEther('1000'); // 1000 USDC (18 dec)
    const result = calculateSlippageMinOutput(output, 1.0);
    // 1000 - 1% = 990
    expect(result).toBe(parseEther('990'));
  });

  it('applies 0% slippage (no change)', () => {
    const output = parseUnits('50', 6);
    const result = calculateSlippageMinOutput(output, 0);
    expect(result).toBe(50_000_000n);
  });

  it('handles fractional slippage (0.1%)', () => {
    const output = parseUnits('1000', 6); // 1000 EURC
    const result = calculateSlippageMinOutput(output, 0.1);
    // 1000 - 0.1% = 999
    expect(result).toBe(999_000_000n);
  });

  it('handles large slippage (5%)', () => {
    const output = parseEther('200');
    const result = calculateSlippageMinOutput(output, 5.0);
    // 200 - 5% = 190
    expect(result).toBe(parseEther('190'));
  });

  it('preserves BigInt precision (no floating-point loss)', () => {
    const output = 123_456_789_012_345_678n;
    const result = calculateSlippageMinOutput(output, 0.5);
    // 0.5% = 50 bps → output - output * 50 / 10000
    const expected = output - (output * 50n / 10000n);
    expect(result).toBe(expected);
  });
});

describe('calculateTotalLiquidityUsd', () => {
  it('calculates combined USDC + EURC value', () => {
    const usdcReserve = parseEther('1000');       // 1000 USDC (18 dec)
    const eurcReserve = parseUnits('1000', 6);    // 1000 EURC (6 dec)
    const eurToUsd = 1.08;
    const result = calculateTotalLiquidityUsd(usdcReserve, eurcReserve, eurToUsd);
    // 1000 + 1000 * 1.08 = 2080.00
    expect(result).toBe('2080.00');
  });

  it('returns "0.00" for empty pool', () => {
    const result = calculateTotalLiquidityUsd(0n, 0n, 1.08);
    expect(result).toBe('0.00');
  });

  it('handles USDC-only pool', () => {
    const result = calculateTotalLiquidityUsd(parseEther('500'), 0n, 1.08);
    expect(result).toBe('500.00');
  });

  it('handles EURC-only pool', () => {
    const result = calculateTotalLiquidityUsd(0n, parseUnits('500', 6), 1.10);
    expect(result).toBe('550.00');
  });

  it('uses different EUR/USD rates correctly', () => {
    const usdcReserve = parseEther('100');
    const eurcReserve = parseUnits('100', 6);
    const result1 = calculateTotalLiquidityUsd(usdcReserve, eurcReserve, 1.0);
    expect(result1).toBe('200.00');
    const result2 = calculateTotalLiquidityUsd(usdcReserve, eurcReserve, 1.20);
    expect(result2).toBe('220.00');
  });
});

describe('calculateRemoveLiquidityMinOutputs', () => {
  it('calculates proportional outputs for full removal', () => {
    const result = calculateRemoveLiquidityMinOutputs(
      '100', '100', '500', '400'
    );
    expect(result.expectedUsdc).toBeCloseTo(500, 1);
    expect(result.expectedEurc).toBeCloseTo(400, 1);
  });

  it('calculates proportional outputs for partial removal', () => {
    const result = calculateRemoveLiquidityMinOutputs(
      '50', '100', '500', '400'
    );
    expect(result.expectedUsdc).toBeCloseTo(250, 1);
    expect(result.expectedEurc).toBeCloseTo(200, 1);
  });

  it('caps ratio at 1.0 if lpAmount > userLpTokens', () => {
    const result = calculateRemoveLiquidityMinOutputs(
      '200', '100', '500', '400'
    );
    expect(result.expectedUsdc).toBeCloseTo(500, 1);
    expect(result.expectedEurc).toBeCloseTo(400, 1);
  });

  it('returns 0 when user has no LP tokens', () => {
    const result = calculateRemoveLiquidityMinOutputs(
      '10', '0', '500', '400'
    );
    expect(result.expectedUsdc).toBe(0);
    expect(result.expectedEurc).toBe(0);
    expect(result.minUsdcOut).toBe(0n);
    expect(result.minEurcOut).toBe(0n);
  });

  it('applies 1% slippage protection by default', () => {
    const result = calculateRemoveLiquidityMinOutputs(
      '100', '100', '100', '100'
    );
    // expectedUsdc = 100, minUsdcOut = 100 * 0.99 = 99 USDC (18 dec)
    expect(result.minUsdcOut).toBe(parseEther('99'));
    expect(result.minEurcOut).toBe(parseUnits('99', 6));
  });
});
