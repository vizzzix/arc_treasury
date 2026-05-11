/**
 * Shared bridge utilities used by both frontend (useBridgeCCTP) and API (api/bridge.ts).
 * Extracted for testability and to eliminate duplication.
 */

/**
 * Convert human-readable amount to micro-units (6 decimal places).
 * Handles commas, truncates beyond 6 decimals, avoids floating-point loss.
 */
export function toMicro(amount: string): string {
  const [whole = '0', frac = ''] = amount.replace(/,/g, '').split('.');
  const paddedFrac = frac.padEnd(6, '0').slice(0, 6);
  return BigInt(whole + paddedFrac).toString();
}

/**
 * Pad an Ethereum address to bytes32 (for CCTP mintRecipient).
 */
export function padAddress(addr: string): string {
  const clean = addr.toLowerCase().replace('0x', '');
  return '0x' + clean.padStart(64, '0');
}

/**
 * Calculate CCTP maxFee with floor/cap clamping.
 * Fee = 0.5% of amount, clamped to [MIN_FEE, MAX_FEE_CAP].
 * All values in micro-units (6 decimals).
 */
export function calculateMaxFee(amountMicro: bigint): bigint {
  const MAX_FEE_CAP = 5_000_000n; // 5 USDC
  const MIN_FEE = 100_000n;       // 0.1 USDC
  const calculated = (amountMicro * 50n) / 10_000n; // 0.5%
  if (calculated < MIN_FEE) return MIN_FEE;
  if (calculated > MAX_FEE_CAP) return MAX_FEE_CAP;
  return calculated;
}
