import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { WalletHeader } from "@/components/WalletHeader";
import { WalletConnect } from "@/components/WalletConnect";
import { Skeleton } from "@/components/ui/skeleton";
import { useUnifiedWallet } from "@/hooks/useUnifiedWallet";
import {
  useTransactionHistory,
  getTxTypeLabel,
  getTxStatusColor,
} from "@/hooks/useTransactionHistory";
import type { TransactionRecord } from "@/hooks/useTransactionHistory";
import {
  ArrowLeft,
  ExternalLink,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  Lock,
  Unlock,
  Coins,
  Sparkles,
  RefreshCw,
  ChevronDown,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const ARC_EXPLORER = "https://testnet.arcscan.app";

function getTxIcon(txType: string) {
  if (txType.startsWith("deposit")) return <ArrowDownToLine className="w-4 h-4" />;
  if (txType.startsWith("withdraw")) return <ArrowUpFromLine className="w-4 h-4" />;
  if (txType.startsWith("swap")) return <ArrowLeftRight className="w-4 h-4" />;
  if (txType.includes("locked") || txType.includes("lock")) return <Lock className="w-4 h-4" />;
  if (txType.includes("unlock") || txType === "early-withdraw-locked") return <Unlock className="w-4 h-4" />;
  if (txType.includes("liquidity")) return <Coins className="w-4 h-4" />;
  if (txType === "mint-badge") return <Sparkles className="w-4 h-4" />;
  if (txType.startsWith("bridge")) return <ArrowLeftRight className="w-4 h-4" />;
  return <Coins className="w-4 h-4" />;
}

function getStatusBadge(status: string) {
  const colorClass = getTxStatusColor(status);
  const bgMap: Record<string, string> = {
    COMPLETE: "bg-green-500/10",
    CONFIRMED: "bg-green-500/10",
    FAILED: "bg-red-500/10",
    CANCELLED: "bg-red-500/10",
    PENDING: "bg-yellow-500/10",
    QUEUED: "bg-yellow-500/10",
    SENT: "bg-yellow-500/10",
  };
  const bg = bgMap[status] || "bg-muted/50";

  return (
    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${bg} ${colorClass}`}>
      {status}
    </span>
  );
}

function TransactionRow({ tx }: { tx: TransactionRecord }) {
  const timeAgo = formatDistanceToNow(new Date(tx.created_at), { addSuffix: true });

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-card/50 hover:bg-card/80 transition-colors">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center text-muted-foreground">
        {getTxIcon(tx.tx_type)}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">
            {getTxTypeLabel(tx.tx_type)}
          </span>
          {getStatusBadge(tx.status)}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {tx.amount && (
            <span className="text-xs text-muted-foreground">
              {parseFloat(tx.amount).toLocaleString(undefined, { maximumFractionDigits: 4 })}
              {tx.currency ? ` ${tx.currency}` : ""}
            </span>
          )}
          <span className="text-[10px] text-muted-foreground/60">{timeAgo}</span>
        </div>
        {tx.error_reason && (
          <p className="text-[10px] text-red-400 mt-0.5 truncate">{tx.error_reason}</p>
        )}
      </div>

      {tx.tx_hash && (
        <a
          href={`${ARC_EXPLORER}/tx/${tx.tx_hash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      )}
    </div>
  );
}

const History = () => {
  const navigate = useNavigate();
  const { isConnected } = useUnifiedWallet();
  const { transactions, isLoading, error, hasMore, loadMore, refetch } = useTransactionHistory();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-background/80 backdrop-blur-xl">
        <div className="max-w-md mx-auto px-4 h-14 flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold">Transaction History</h1>
          <WalletHeader />
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-6 space-y-4">
        {!isConnected ? (
          <div className="text-center py-12 space-y-4">
            <p className="text-muted-foreground">Connect your wallet to view transaction history</p>
            <WalletConnect />
          </div>
        ) : (
          <>
            {/* Refresh button */}
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={refetch}
                disabled={isLoading}
                className="text-xs gap-1"
              >
                <RefreshCw className={`w-3 h-3 ${isLoading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>

            {isLoading && transactions.length === 0 ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-lg" />
                ))}
              </div>
            ) : error ? (
              <div className="text-center py-8">
                <p className="text-red-400 text-sm">{error}</p>
                <Button variant="outline" size="sm" onClick={refetch} className="mt-3">
                  Retry
                </Button>
              </div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-12 space-y-3">
                <Coins className="w-10 h-10 mx-auto text-muted-foreground/50" />
                <p className="text-muted-foreground text-sm">No transactions yet</p>
                <p className="text-xs text-muted-foreground/60">
                  Your vault, swap, and bridge transactions will appear here
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/dashboard")}
                  className="mt-2"
                >
                  Go to Dashboard
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {transactions.map((tx) => (
                  <TransactionRow key={tx.circle_tx_id} tx={tx} />
                ))}

                {hasMore && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={loadMore}
                    className="w-full text-xs text-muted-foreground"
                  >
                    <ChevronDown className="w-3 h-3 mr-1" />
                    Load more
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default History;
