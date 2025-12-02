import { useState, useEffect, useCallback, useRef } from 'react';
import { useBridgeFeed, BridgeTransaction, TopBridger } from '@/hooks/useBridgeFeed';
import { RefreshCw, Activity, Trophy, X, Zap } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useAccount } from 'wagmi';

// Boost multipliers based on rank (24h leaderboard position)
const getBoostMultiplier = (rank: number): number => {
  if (rank === 1) return 3.0;
  if (rank === 2) return 2.5;
  if (rank === 3) return 2.0;
  if (rank <= 5) return 1.5;
  if (rank <= 10) return 1.25;
  return 1.0;
};

const formatBoost = (rank: number): string => {
  const boost = getBoostMultiplier(rank);
  return `${boost}x`;
};

const formatAddress = (address: string) => {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

const formatAmount = (amount: number, showDecimals = false) => {
  if (showDecimals && amount < 100) {
    const rounded = Math.round(amount);
    const isCloseToWhole = Math.abs(amount - rounded) < 0.01;
    if (isCloseToWhole) {
      return `$${rounded.toLocaleString('en-US')}`;
    }
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
  if (amount >= 50000) return '🐋';
  if (amount >= 10000) return '🦈';
  if (amount >= 1000) return '🐬';
  if (amount >= 100) return '🐟';
  return '🦐';
};

interface TransactionRowProps {
  tx: BridgeTransaction;
  isTop10: boolean;
}

const TransactionRow = ({ tx, isTop10 }: TransactionRowProps) => {
  const isToArc = tx.direction === 'to_arc';
  const timeAgo = formatDistanceToNow(new Date(tx.created_at), { addSuffix: false });

  return (
    <div className={`flex items-center gap-2 py-1.5 px-2 rounded-lg transition-colors text-xs ${isTop10 ? 'bg-yellow-500/10 border border-yellow-500/20' : 'bg-white/[0.02] hover:bg-white/[0.05]'}`}>
      {isTop10 && <span className="text-yellow-500">👑</span>}
      <span className={`font-mono ${isTop10 ? 'text-yellow-500 font-medium' : 'text-foreground/70'}`}>{formatAddress(tx.wallet_address)}</span>
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
  const { transactions, stats, topBridgers, allBridgersRanked, getUserRank, isLoading, refresh } = useBridgeFeed(20);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showTop, setShowTop] = useState(false);

  // Ref to prevent rapid toggle during re-renders
  const isTogglingRef = useRef(false);
  const { address } = useAccount();

  // Get user's rank
  const userRankData = getUserRank(address);
  const isUserInTop10Real = userRankData && userRankData.rank && userRankData.rank <= 10;

  // Get top 10 bridgers (show 10 in panel now)
  const top10Bridgers = allBridgersRanked.slice(0, 10);

  // Get top 10 wallet addresses for highlighting
  const top10Wallets = new Set(
    allBridgersRanked.slice(0, 10).map(b => b.wallet_address.toLowerCase())
  );

  // Filter out $0 transactions and take first 5
  const filteredTransactions = transactions
    .filter(tx => tx.amount_usd > 0.01)
    .slice(0, 5);

  // Stable toggle function with debounce protection
  const toggleShowTop = useCallback(() => {
    if (isTogglingRef.current) return;
    isTogglingRef.current = true;
    setShowTop(prev => !prev);
    // Reset after short delay to allow next click
    setTimeout(() => {
      isTogglingRef.current = false;
    }, 100);
  }, []);

  const closeShowTop = useCallback(() => {
    if (isTogglingRef.current) return;
    isTogglingRef.current = true;
    setShowTop(false);
    setTimeout(() => {
      isTogglingRef.current = false;
    }, 100);
  }, []);

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
    <div className="p-4 rounded-2xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 backdrop-blur-sm relative overflow-hidden">
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
              • {formatAmount(stats.totalVolume24h)} • {stats.transactionCount24h} bridges
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={toggleShowTop}
            className={`p-2 -m-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer select-none touch-manipulation ${showTop ? 'bg-yellow-500/20 text-yellow-500' : ''}`}
            title="Top Bridgers"
          >
            <Trophy className={`w-4 h-4 ${!showTop ? 'text-yellow-500 animate-pulse' : ''}`} />
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

      {/* Top 10 Bridgers Panel with Boosts */}
      {showTop && (
        <div className="mb-3 p-3 rounded-xl bg-gradient-to-br from-yellow-500/10 to-orange-500/5 border border-yellow-500/20">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-yellow-500">Top 10 Bridgers (24h)</span>
              <span className="text-[10px] text-yellow-500/70 flex items-center gap-0.5">
                <Zap className="w-3 h-3" /> Points Boost Active
              </span>
            </div>
            <button
              type="button"
              onClick={closeShowTop}
              className="p-1.5 -m-1 hover:bg-white/10 rounded cursor-pointer select-none touch-manipulation"
            >
              <X className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </div>
          <div className="space-y-1.5">
            {top10Bridgers.map((bridger, index) => {
              const isCurrentUser = address?.toLowerCase() === bridger.wallet_address.toLowerCase();
              const rank = index + 1;
              const boost = getBoostMultiplier(rank);

              return (
                <div key={bridger.wallet_address} className={`flex items-center gap-2 text-xs ${isCurrentUser ? 'bg-primary/10 rounded px-1 -mx-1' : ''}`}>
                  <span className={`w-4 text-center font-medium ${index === 0 ? 'text-yellow-500' : index === 1 ? 'text-gray-400' : index === 2 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                    {rank}
                  </span>
                  <span className={`font-mono shrink-0 ${isCurrentUser ? 'text-primary font-semibold' : 'text-foreground/70'}`}>
                    {isCurrentUser ? 'You' : formatAddress(bridger.wallet_address)}
                  </span>
                  {/* Boost indicator */}
                  <span className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    rank === 1 ? 'bg-yellow-500/20 text-yellow-400' :
                    rank === 2 ? 'bg-gray-400/20 text-gray-300' :
                    rank === 3 ? 'bg-amber-500/20 text-amber-400' :
                    rank <= 5 ? 'bg-blue-500/20 text-blue-400' :
                    'bg-green-500/20 text-green-400'
                  }`}>
                    <Zap className="w-2.5 h-2.5" />
                    {formatBoost(rank)}
                  </span>
                  <span className="ml-auto shrink-0">{formatAmount(bridger.total_volume)} {getTierBadge(bridger.total_volume)}</span>
                </div>
              );
            })}

            {/* Show user's rank if not in top 10 but has rank data */}
            {userRankData && !isUserInTop10Real && (
              <>
                <div className="text-center text-muted-foreground/50 text-[10px]">• • •</div>
                <div className="flex items-center gap-2 text-xs bg-primary/10 rounded px-1 -mx-1">
                  <span className="w-4 text-center font-medium text-muted-foreground">
                    {userRankData.rank}
                  </span>
                  <span className="font-mono text-primary font-semibold">You</span>
                  <span className="text-[10px] text-muted-foreground/60 flex items-center gap-0.5">
                    <Zap className="w-2.5 h-2.5" /> No boost
                  </span>
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
            <TransactionRow
              key={tx.id}
              tx={tx}
              isTop10={top10Wallets.has(tx.wallet_address.toLowerCase())}
            />
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
