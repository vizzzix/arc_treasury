/**
 * bridgeFee - CCTP V2 maxFee calculation, shared by the MetaMask path
 * (useBridgeCCTP) and the Circle server path (api/bridge.ts).
 *
 * maxFee is the MAXIMUM the Circle relayer can deduct — the actual fee is
 * usually lower. 0.5% of the amount, floored at 0.1 USDC, capped at 5 USDC.
 * Amounts are in 6-decimal USDC units.
 */

const MAX_FEE_CAP = 5_000_000n; // 5 USDC (6 decimals)
const MIN_FEE = 100_000n;       // 0.1 USDC

export function calculateBridgeFee(amountWei: bigint): bigint {
  const calculated = (amountWei * 50n) / 10_000n; // 0.5%
  if (calculated < MIN_FEE) return MIN_FEE;
  if (calculated > MAX_FEE_CAP) return MAX_FEE_CAP;
  return calculated;
}
