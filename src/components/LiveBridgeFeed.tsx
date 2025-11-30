import { useState } from 'react';
import { useBridgeFeed, BridgeTransaction, TopBridger } from '@/hooks/useBridgeFeed';
import { ArrowRight, RefreshCw, Activity, Trophy, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useAccount } from 'wagmi';

const formatAddress = (address: string) => {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

const formatAmount = (amount: number, showDecimals = false) => {
  // For small amounts: smart decimal display
  if (showDecimals && amount < 100) {
    const rounded = Math.round(amount);
    const isCloseToWhole = Math.abs(amount - rounded) < 0.01;
    if (isCloseToWhole) {
      return `$${rounded.toLocaleString('en-US')}`;
    }
    // Check if close to .X0 (like 0.10, 0.20, 1.50) -> show as 0.1, 0.2, 1.5
    const roundedOne = Math.round(amount * 10) / 10;
    const isCloseToOneDecimal = Math.abs(amount - roundedOne) < 0.01;
    if (isCloseToOneDecimal) {
      return `$${roundedOne}`;
    }
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `$${Math.round(amount).toLocaleString('en-US')}`;
};

const getTierBadge = (amount: number): string => {
  if (amount >= 50000) return '🐋'; // Whale
  if (amount >= 10000) return '🦈'; // Shark
  if (amount >= 1000) return '🐬';  // Dolphin
  if (amount >= 100) return '🐟';   // Fish
  return '🦐';                       // Shrimp
};

const TransactionRow = ({ tx }: { tx: BridgeTransaction }) => {
  const isToArc = tx.direction === 'to_arc';
  const timeAgo = formatDistanceToNow(new Date(tx.created_at), { addSuffix: false });

  return (
    <div className="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-white/[0.02] hover:bg-white/[0.05] transition-colors text-xs">
      <span className="font-mono text-foreground/70">{formatAddress(tx.wallet_address)}</span>
      <span className="text-muted-foreground">{formatAmount(tx.amount_usd, true)}</span>
      <span>{getTierBadge(tx.amount_usd)}</span>
      <span className={`${isToArc ? 'text-green-400' : 'text-blue-400'}`}>
        {isToArc ? 'Sep→Arc' : 'Arc→Sep'}
      </span>
      <span className="ml-auto text-muted-foreground/60">{timeAgo}</span>
    </div>
  );
};

export const LiveBridgeFeed = () => {
  const { transactions, stats, topBridgers, getUserRank, isLoading, refresh } = useBridgeFeed(20);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showTop, setShowTop] = useState(false);
  const { address } = useAccount();

  // Check if user is in top 5
  const userRankData = getUserRank(address);
  const isUserInTop5 = userRankData && userRankData.rank && userRankData.rank <= 5;

  // Filter out $0 transactions and take first 5
  const filteredTransactions = transactions
    .filter(tx => tx.amount_usd > 0.01)
    .slice(0, 5);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refresh();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  if (isLoading && transactions.length === 0) {
    return (
      <div className="p-4 rounded-2xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 backdrop-blur-sm">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-4 h-4 text-primary animate-pulse" />
          <h3 className="font-semibold text-sm">Live Activity</h3>
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 rounded-lg bg-white/5 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 rounded-2xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 backdrop-blur-sm">
      {/* Header with stats inline */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Activity className="w-4 h-4 text-primary" />
            <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
          </div>
          <h3 className="font-semibold text-sm">Live Activity</h3>
          {(stats.totalVolume24h > 0 || stats.transactionCount24h > 0) && (
            <span className="text-xs text-muted-foreground">
              • {formatAmount(stats.totalVolume24h)} • {stats.transactionCount24h} bridges (24h)
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowTop(!showTop)}
            className={`p-1 rounded-lg hover:bg-white/10 transition-colors ${showTop ? 'bg-yellow-500/20 text-yellow-500' : ''}`}
            title="Top Bridgers"
          >
            <Trophy className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-1 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-muted-foreground ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Top Bridgers Panel */}
      {showTop && (
        <div className="mb-3 p-3 rounded-xl bg-gradient-to-br from-yellow-500/10 to-orange-500/5 border border-yellow-500/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-yellow-500">Top 5 Bridgers (All Time)</span>
            <button onClick={() => setShowTop(false)} className="p-0.5 hover:bg-white/10 rounded">
              <X className="w-3 h-3 text-muted-foreground" />
            </button>
          </div>
          <div className="space-y-1.5">
            {topBridgers.map((bridger, index) => {
              const isCurrentUser = address?.toLowerCase() === bridger.wallet_address.toLowerCase();
              return (
                <div key={bridger.wallet_address} className={`flex items-center gap-2 text-xs ${isCurrentUser ? 'bg-primary/10 rounded px-1 -mx-1' : ''}`}>
                  <span className={`w-4 text-center font-medium ${index === 0 ? 'text-yellow-500' : index === 1 ? 'text-gray-400' : index === 2 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                    {index + 1}
                  </span>
                  <span className={`font-mono ${isCurrentUser ? 'text-primary font-semibold' : 'text-foreground/70'}`}>
                    {isCurrentUser ? 'You' : formatAddress(bridger.wallet_address)}
                  </span>
                  <span className="ml-auto">{formatAmount(bridger.total_volume)} {getTierBadge(bridger.total_volume)}</span>
                </div>
              );
            })}
            {/* Show user's rank if not in top 5 */}
            {userRankData && !isUserInTop5 && (
              <>
                <div className="text-center text-muted-foreground/50 text-[10px]">• • •</div>
                <div className="flex items-center gap-2 text-xs bg-primary/10 rounded px-1 -mx-1">
                  <span className="w-4 text-center font-medium text-muted-foreground">
                    {userRankData.rank}
                  </span>
                  <span className="font-mono text-primary font-semibold">You</span>
                  <span className="ml-auto">{formatAmount(userRankData.total_volume)} {getTierBadge(userRankData.total_volume)}</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Transactions */}
      {filteredTransactions.length > 0 ? (
        <div className="space-y-1">
          {filteredTransactions.map((tx) => (
            <TransactionRow key={tx.id} tx={tx} />
          ))}
        </div>
      ) : (
        <div className="text-center py-4 text-muted-foreground">
          <p className="text-sm">No recent bridge activity</p>
        </div>
      )}
    </div>
  );
};
