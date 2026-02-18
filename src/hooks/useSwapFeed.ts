import { useState, useEffect, useCallback } from 'react';

export type ActivityItem = {
  id: string;
  type: 'swap' | 'add' | 'remove';
  wallet_address: string;
  amount_usd: number;
  details: string;
  created_at: string;
};

export interface SwapStats {
  totalSwapVolume: number;
  swapCount: number;
  totalLpVolume: number;
  lpCount: number;
}

export interface TopSwapper {
  wallet_address: string;
  total_volume: number;
  rank?: number;
}

export const useSwapFeed = (limit: number = 10) => {
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [stats, setStats] = useState<SwapStats>({
    totalSwapVolume: 0,
    swapCount: 0,
    totalLpVolume: 0,
    lpCount: 0,
  });
  const [topSwappers, setTopSwappers] = useState<TopSwapper[]>([]);
  const [allSwappersRanked, setAllSwappersRanked] = useState<TopSwapper[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchActivity = async () => {
    try {
      const res = await fetch(`/api/track-tx?action=feed-activity&limit=${limit}&_t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) return;
      const { swaps, lpEvents } = await res.json();

      const combined: ActivityItem[] = [];

      if (swaps) {
        swaps.forEach((s: any) => {
          combined.push({
            id: `swap-${s.id}`,
            type: 'swap',
            wallet_address: s.wallet_address,
            amount_usd: Number(s.amount_usd),
            details: s.token_in && s.token_out ? `${s.token_in}→${s.token_out}` : 'Swap',
            created_at: s.created_at,
          });
        });
      }

      if (lpEvents) {
        lpEvents.forEach((e: any) => {
          combined.push({
            id: `lp-${e.id}`,
            type: e.action,
            wallet_address: e.wallet_address,
            amount_usd: Number(e.amount_usd),
            details: e.action === 'add' ? 'Add LP' : 'Remove LP',
            created_at: e.created_at,
          });
        });
      }

      combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setActivity(combined.slice(0, limit));
    } catch (e) {
      console.error('Failed to fetch swap activity:', e);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch(`/api/track-tx?action=feed-stats&_t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      setStats({
        totalSwapVolume: data.totalSwapVolume,
        swapCount: data.swapCount,
        totalLpVolume: data.totalLpVolume,
        lpCount: data.lpCount,
      });
    } catch (e) {
      console.error('Failed to fetch swap stats:', e);
    }
  };

  const fetchTopSwappers = async () => {
    try {
      const res = await fetch(`/api/track-tx?action=feed-top&_t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) return;
      const { ranked } = await res.json();

      setAllSwappersRanked(ranked || []);
      setTopSwappers((ranked || []).slice(0, 5));
    } catch (e) {
      console.error('Failed to fetch top swappers:', e);
    }
  };

  const refresh = useCallback(async () => {
    await Promise.all([fetchActivity(), fetchStats(), fetchTopSwappers()]);
  }, [limit]);

  useEffect(() => {
    setIsLoading(true);
    refresh().finally(() => setIsLoading(false));

    const interval = setInterval(refresh, 15000);
    return () => clearInterval(interval);
  }, [refresh]);

  // Listen for swap/liquidity write events and refresh immediately
  useEffect(() => {
    const onFeedUpdate = () => {
      setTimeout(refresh, 1500);
    };
    window.addEventListener('swap-feed-update', onFeedUpdate);
    return () => window.removeEventListener('swap-feed-update', onFeedUpdate);
  }, [refresh]);

  const getUserRank = (address: string | undefined): TopSwapper | null => {
    if (!address) return null;
    const found = allSwappersRanked.find(
      s => s.wallet_address.toLowerCase() === address.toLowerCase()
    );
    return found || null;
  };

  return {
    activity,
    stats,
    topSwappers,
    allSwappersRanked,
    getUserRank,
    isLoading,
    refresh,
  };
};
