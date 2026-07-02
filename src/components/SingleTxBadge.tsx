import { Zap } from 'lucide-react';

/**
 * Communicates that an action executes as ONE atomic transaction (one wallet
 * signature) — thanks to Arc's Multicall3From batching of approve + action.
 * Only use on genuinely single-tx flows (swaps, EURC/USDC deposits), not on
 * the two-step add-liquidity.
 */
export function SingleTxBadge({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary ${className}`}
      title="Runs as a single atomic transaction — approve + action in one signature"
    >
      <Zap className="h-3 w-3" aria-hidden="true" />
      1 signature
    </span>
  );
}
