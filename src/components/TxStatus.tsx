import { CheckCircle2, XCircle, Loader2, ExternalLink, X } from 'lucide-react';

export type TxState = 'pending' | 'success' | 'failed';

interface TxStatusProps {
  status: TxState;
  /** Headline per state, e.g. { pending: 'Processing Swap...', success: 'Swap Complete!', failed: 'Swap Failed' } */
  titles: Record<TxState, string>;
  /** Sub-line describing the action (e.g. "Swapped 10 EURC → 11 USDC") */
  description?: string;
  explorerUrl?: string;
  onDismiss?: () => void;
}

const TONE: Record<TxState, { wrap: string; text: string }> = {
  success: { wrap: 'bg-green-500/10 border-green-500/20', text: 'text-green-400' },
  failed: { wrap: 'bg-red-500/10 border-red-500/20', text: 'text-red-400' },
  pending: { wrap: 'bg-blue-500/10 border-blue-500/20', text: 'text-blue-400' },
};

/**
 * Unified inline transaction status card. Replaces ad-hoc per-page status
 * blocks so swap / deposit / bridge flows read the same. Announced to screen
 * readers via role=status + aria-live.
 */
export function TxStatus({ status, titles, description, explorerUrl, onDismiss }: TxStatusProps) {
  const tone = TONE[status];
  return (
    <div
      role="status"
      aria-live="polite"
      className={`mt-4 p-4 rounded-xl border ${tone.wrap}`}
    >
      <div className="flex items-start gap-3">
        {status === 'success' && <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" aria-hidden="true" />}
        {status === 'failed' && <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" aria-hidden="true" />}
        {status === 'pending' && <Loader2 className="w-5 h-5 text-blue-400 animate-spin flex-shrink-0 mt-0.5" aria-hidden="true" />}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium mb-1 ${tone.text}`}>{titles[status]}</p>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
          {explorerUrl && (
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline flex items-center gap-1 mt-2"
            >
              View transaction <ExternalLink className="w-3 h-3" aria-hidden="true" />
            </a>
          )}
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            aria-label="Dismiss transaction status"
            className="p-1 hover:bg-white/10 rounded flex-shrink-0"
          >
            <X className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}
