import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export interface SwapTransaction {
  id: number;
  wallet_address: string;
  amount_usd: number;
  from_token: string;
  to_token: string;
  tx_hash: string;
  created_at: string;
}

export interface LiquidityEvent {
  id: number;
  wallet_address: string;
  action: 'add' | 'remove';
  amount_usd: number;
  tx_hash: string;
  created_at: string;
}

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
    if (!supabase) return;
    try {
      // Fetch recent swaps
      const { data: swaps } = await supabase
        .from('swap_transactions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      // Fetch recent LP events
      const { data: lpEvents } = await supabase
        .from('liquidity_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      // Combine and sort by time
      const combined: ActivityItem[] = [];

      if (swaps) {
        swaps.forEach((s) => {
          combined.push({
            id: `swap-${s.id}`,
            type: 'swap',
            wallet_address: s.wallet_address,
            amount_usd: s.amount_usd,
            details: s.from_token && s.to_token ? `${s.from_token}→${s.to_token}` : 'Swap',
            created_at: s.created_at,
          });
        });
      }

      if (lpEvents) {
        lpEvents.forEach((e) => {
          combined.push({
            id: `lp-${e.id}`,
            type: e.action,
            wallet_address: e.wallet_address,
            amount_usd: e.amount_usd,
            details: e.action === 'add' ? 'Add LP' : 'Remove LP',
            created_at: e.created_at,
          });
        });
      }

      // Sort by time and take top N
      combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setActivity(combined.slice(0, limit));
    } catch (e) {
      console.error('Failed to fetch swap activity:', e);
    }
  };

  const fetchStats = async () => {
    if (!supabase) return;
    try {
      // Get 24h stats for swaps
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const [swapRes, lpRes] = await Promise.all([
        supabase
          .from('swap_transactions')
          .select('amount_usd')
          .gte('created_at', oneDayAgo),
        supabase
          .from('liquidity_events')
          .select('amount_usd')
          .gte('created_at', oneDayAgo),
      ]);

      const swapVolume = swapRes.data?.reduce((sum, s) => sum + (s.amount_usd || 0), 0) || 0;
      const lpVolume = lpRes.data?.reduce((sum, e) => sum + (e.amount_usd || 0), 0) || 0;

      setStats({
        totalSwapVolume: swapVolume,
        swapCount: swapRes.data?.length || 0,
        totalLpVolume: lpVolume,
        lpCount: lpRes.data?.length || 0,
      });
    } catch (e) {
      console.error('Failed to fetch swap stats:', e);
    }
  };

  const fetchTopSwappers = async () => {
    if (!supabase) return;
    try {
      // Fetch all swap transactions with pagination
      let allSwaps: { wallet_address: string; amount_usd: number }[] = [];
      let allLp: { wallet_address: string; amount_usd: number }[] = [];
      let offset = 0;
      const pageSize = 1000;

      // Fetch swaps
      while (true) {
        const { data, error: fetchError } = await supabase
          .from('swap_transactions')
          .select('wallet_address, amount_usd')
          .range(offset, offset + pageSize - 1);

        if (fetchError) throw fetchError;
        if (!data || data.length === 0) break;

        allSwaps = [...allSwaps, ...data];
        if (data.length < pageSize) break;
        offset += pageSize;
      }

      // Fetch LP events
      offset = 0;
      while (true) {
        const { data, error: fetchError } = await supabase
          .from('liquidity_events')
          .select('wallet_address, amount_usd')
          .range(offset, offset + pageSize - 1);

        if (fetchError) throw fetchError;
        if (!data || data.length === 0) break;

        allLp = [...allLp, ...data];
        if (data.length < pageSize) break;
        offset += pageSize;
      }

      // Aggregate by wallet (combine swaps + LP)
      const volumeByWallet: Record<string, number> = {};

      allSwaps.forEach(tx => {
        const addr = tx.wallet_address.toLowerCase();
        volumeByWallet[addr] = (volumeByWallet[addr] || 0) + Number(tx.amount_usd || 0);
      });

      allLp.forEach(tx => {
        const addr = tx.wallet_address.toLowerCase();
        volumeByWallet[addr] = (volumeByWallet[addr] || 0) + Number(tx.amount_usd || 0);
      });

      // Sort and rank
      const allSorted = Object.entries(volumeByWallet)
        .map(([wallet_address, total_volume]) => ({ wallet_address, total_volume }))
        .sort((a, b) => b.total_volume - a.total_volume)
        .map((s, i) => ({ ...s, rank: i + 1 }));

      setAllSwappersRanked(allSorted);
      setTopSwappers(allSorted.slice(0, 5));
    } catch (e) {
      console.error('Failed to fetch top swappers:', e);
    }
  };

  const refresh = async () => {
    await Promise.all([fetchActivity(), fetchStats(), fetchTopSwappers()]);
  };

  useEffect(() => {
    setIsLoading(true);
    refresh().finally(() => setIsLoading(false));

    // Refresh every 30 seconds
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, [limit]);

  // Get user rank by address
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
