import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface BridgeTransaction {
  id: number;
  wallet_address: string;
  amount_usd: number;
  direction: 'to_arc' | 'to_sepolia' | 'sep_to_sol' | 'arc_to_sol' | 'sol_to_sep' | 'sol_to_arc';
  tx_hash: string;
  created_at: string;
}

export interface BridgeStats {
  totalVolume24h: number;
  transactionCount24h: number;
  uniqueUsers24h: number;
}

export interface TopBridger {
  wallet_address: string;
  total_volume: number;
  rank?: number;
}

const POLL_INTERVAL = 120_000;

export const useBridgeFeed = (limit: number = 10) => {
  const [transactions, setTransactions] = useState<BridgeTransaction[]>([]);
  const [stats, setStats] = useState<BridgeStats>({
    totalVolume24h: 0,
    transactionCount24h: 0,
    uniqueUsers24h: 0,
  });
  const [topBridgers, setTopBridgers] = useState<TopBridger[]>([]);
  const [allBridgersRanked, setAllBridgersRanked] = useState<TopBridger[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    if (!supabase) return;

    try {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const [txRes, countResult, recentResult, topRes] = await Promise.all([
        supabase
          .from('site_bridges')
          .select('wallet_address, amount_usd, direction, tx_hash, created_at')
          .order('created_at', { ascending: false })
          .limit(limit),
        supabase.from('site_bridges').select('*', { count: 'exact', head: true }),
        supabase.from('site_bridges')
          .select('wallet_address, amount_usd')
          .order('created_at', { ascending: false })
          .limit(500),
        supabase.from('site_bridges')
          .select('wallet_address, amount_usd')
          .gte('created_at', oneDayAgo)
          .order('amount_usd', { ascending: false })
          .limit(500),
      ]);

      if (txRes.data) {
        setTransactions(txRes.data.map((tx: any, idx: number) => ({
          id: idx,
          wallet_address: tx.wallet_address,
          amount_usd: tx.amount_usd,
          direction: tx.direction,
          tx_hash: tx.tx_hash,
          created_at: tx.created_at,
        })));
      }

      const recentData = recentResult.data || [];
      const totalVolume = recentData.reduce((sum, tx) => sum + Number(tx.amount_usd), 0);
      const uniqueUsers = new Set(recentData.map(tx => tx.wallet_address.toLowerCase())).size;
      setStats({
        totalVolume24h: totalVolume,
        transactionCount24h: countResult.count || 0,
        uniqueUsers24h: uniqueUsers,
      });

      const volumeByWallet = (topRes.data || []).reduce((acc, tx) => {
        const addr = tx.wallet_address.toLowerCase();
        acc[addr] = (acc[addr] || 0) + Number(tx.amount_usd);
        return acc;
      }, {} as Record<string, number>);

      const allSorted = Object.entries(volumeByWallet)
        .map(([wallet_address, total_volume]) => ({ wallet_address, total_volume }))
        .sort((a, b) => b.total_volume - a.total_volume)
        .map((b, i) => ({ ...b, rank: i + 1 }));

      setAllBridgersRanked(allSorted);
      setTopBridgers(allSorted.slice(0, 5));
    } catch (e: any) {
      console.error('Failed to fetch bridge feed:', e);
      setError(e.message);
    }
  }, [limit]);

  useEffect(() => {
    setIsLoading(true);
    refresh().finally(() => setIsLoading(false));

    const startPolling = () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(refresh, POLL_INTERVAL);
    };

    const stopPolling = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        refresh();
        startPolling();
      }
    };

    startPolling();
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [refresh]);

  const getUserRank = (address: string | undefined): TopBridger | null => {
    if (!address) return null;
    const found = allBridgersRanked.find(
      b => b.wallet_address.toLowerCase() === address.toLowerCase()
    );
    return found || null;
  };

  return {
    transactions,
    stats,
    topBridgers,
    allBridgersRanked,
    getUserRank,
    isLoading,
    error,
    refresh,
  };
};
