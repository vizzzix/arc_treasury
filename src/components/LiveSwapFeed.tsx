import { useState } from 'react';
import { useSwapFeed, ActivityItem, TopSwapper } from '@/hooks/useSwapFeed';
import { RefreshCw, Activity, ArrowRightLeft, Plus, Minus, Trophy, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useAccount } from 'wagmi';

const formatAddress = (address: string) => {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

const formatAmount = (amount: number) => {
  if (amount < 1) return `$${amount.toFixed(2)}`;
  if (amount < 100) return `$${amount.toFixed(1)}`;
  return `$${Math.round(amount).toLocaleString('en-US')}`;
};

const ActivityRow = ({ item }: { item: ActivityItem }) => {
  const timeAgo = formatDistanceToNow(new Date(item.created_at), { addSuffix: false });

  const getIcon = () => {
    if (item.type === 'swap') return <ArrowRightLeft className="w-3 h-3 text-blue-400" />;
    if (item.type === 'add') return <Plus className="w-3 h-3 text-green-400" />;
    return <Minus className="w-3 h-3 text-orange-400" />;
  };

  const getTypeColor = () => {
    if (item.type === 'swap') return 'text-blue-400';
    if (item.type === 'add') return 'text-green-400';
    return 'text-orange-400';
  };

  return (
    <div className="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-white/[0.02] hover:bg-white/[0.05] transition-colors text-xs">
      {getIcon()}
      <span className="font-mono text-foreground/70">{formatAddress(item.wallet_address)}</span>
      <span className="text-muted-foreground">{formatAmount(item.amount_usd)}</span>
      <span className={getTypeColor()}>{item.details}</span>
      <span className="ml-auto text-muted-foreground/60">{timeAgo}</span>
    </div>
  );
};

const getTierBadge = (amount: number): string => {
  if (amount >= 50000) return '🐋';
  if (amount >= 10000) return '🦈';
  if (amount >= 1000) return '🐬';
  if (amount >= 100) return '🐟';
  return '🦐';
};

export const LiveSwapFeed = () => {
  const { activity, stats, topSwappers, getUserRank, isLoading, refresh } = useSwapFeed(10);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showTop, setShowTop] = useState(false);
  const { address } = useAccount();

  // Check if user is in top 5
  const userRankData = getUserRank(address);
  const isUserInTop5 = userRankData && userRankData.rank && userRankData.rank <= 5;

  // Filter out tiny transactions and take first 5
  const filteredActivity = activity
    .filter(item => item.amount_usd > 0.1)
    .slice(0, 5);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refresh();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  if (isLoading && activity.length === 0) {
    return (
      <div className="p-4 rounded-2xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 backdrop-blur-sm">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-4 h-4 text-primary animate-pulse" />
          <h3 className="font-semibold text-sm">Live Activity</h3>
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-8 rounded-lg bg-white/5 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 rounded-2xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Activity className="w-4 h-4 text-primary" />
            <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
          </div>
          <h3 className="font-semibold text-sm">Live Activity</h3>
          {(stats.swapCount > 0 || stats.lpCount > 0) && (
            <span className="text-xs text-muted-foreground">
              {stats.swapCount > 0 && `${stats.swapCount} swaps`}
              {stats.swapCount > 0 && stats.lpCount > 0 && ' • '}
              {stats.lpCount > 0 && `${stats.lpCount} LP`}
              <span className="text-muted-foreground/60"> (24h)</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowTop(!showTop)}
            className={`p-1 rounded-lg hover:bg-white/10 transition-colors ${showTop ? 'bg-yellow-500/20 text-yellow-500' : ''}`}
            title="Top Swappers"
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

      {/* Top Swappers Panel */}
      {showTop && (
        <div className="mb-3 p-3 rounded-xl bg-gradient-to-br from-yellow-500/10 to-orange-500/5 border border-yellow-500/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-yellow-500">Top 5 Swappers (All Time)</span>
            <button onClick={() => setShowTop(false)} className="p-0.5 hover:bg-white/10 rounded">
              <X className="w-3 h-3 text-muted-foreground" />
            </button>
          </div>
          <div className="space-y-1.5">
            {topSwappers.map((swapper, index) => {
              const isCurrentUser = address?.toLowerCase() === swapper.wallet_address.toLowerCase();
              return (
                <div key={swapper.wallet_address} className={`flex items-center gap-2 text-xs ${isCurrentUser ? 'bg-primary/10 rounded px-1 -mx-1' : ''}`}>
                  <span className={`w-4 text-center font-medium ${index === 0 ? 'text-yellow-500' : index === 1 ? 'text-gray-400' : index === 2 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                    {index + 1}
                  </span>
                  <span className={`font-mono ${isCurrentUser ? 'text-primary font-semibold' : 'text-foreground/70'}`}>
                    {isCurrentUser ? 'You' : formatAddress(swapper.wallet_address)}
                  </span>
                  <span className="ml-auto">{formatAmount(swapper.total_volume)} {getTierBadge(swapper.total_volume)}</span>
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

      {/* Activity Feed */}
      {filteredActivity.length > 0 ? (
        <div className="space-y-1">
          {filteredActivity.map((item) => (
            <ActivityRow key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <div className="text-center py-4 text-muted-foreground">
          <p className="text-sm">No recent activity</p>
        </div>
      )}
    </div>
  );
};
