import { useState, useEffect } from 'react';
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

// Hook for bridge feed data - only from site_bridges (our site's transactions)
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

  // Fetch recent transactions from site_bridges only
  const fetchTransactions = async () => {
    if (!supabase) return;
    try {
      const { data, error: fetchError } = await supabase
        .from('site_bridges')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (fetchError) throw fetchError;

      const txs: BridgeTransaction[] = (data || []).map((tx: any, idx: number) => ({
        id: idx,
        wallet_address: tx.wallet_address,
        amount_usd: tx.amount_usd,
        direction: tx.direction,
        tx_hash: tx.tx_hash,
        created_at: tx.created_at,
      }));

      setTransactions(txs);
    } catch (e: any) {
      console.error('Failed to fetch bridge transactions:', e);
      setError(e.message);
    }
  };

  // Fetch all-time stats from site_bridges only
  const fetchStats = async () => {
    if (!supabase) return;
    try {
      let allData: { wallet_address: string; amount_usd: number }[] = [];
      let offset = 0;
      const pageSize = 1000;

      // Paginate through all site_bridges
      for (let i = 0; i < 100; i++) {
        const { data, error: fetchError } = await supabase
          .from('site_bridges')
          .select('wallet_address, amount_usd')
          .range(offset, offset + pageSize - 1);

        if (fetchError) throw fetchError;
        if (!data || data.length === 0) break;

        allData = [...allData, ...data];
        if (data.length < pageSize) break;
        offset += pageSize;
      }

      const totalVolume = allData.reduce((sum, tx) => sum + Number(tx.amount_usd), 0);
      const uniqueUsers = new Set(allData.map(tx => tx.wallet_address.toLowerCase())).size;

      setStats({
        totalVolume24h: totalVolume,
        transactionCount24h: allData.length,
        uniqueUsers24h: uniqueUsers,
      });
    } catch (e: any) {
      console.error('Failed to fetch bridge stats:', e);
    }
  };

  // Fetch top bridgers (24h) from site_bridges only
  const fetchTopBridgers = async () => {
    if (!supabase) return;
    try {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      let allData: { wallet_address: string; amount_usd: number }[] = [];
      let offset = 0;
      const pageSize = 1000;

      // Fetch 24h data from site_bridges
      while (true) {
        const { data, error: fetchError } = await supabase
          .from('site_bridges')
          .select('wallet_address, amount_usd')
          .gte('created_at', oneDayAgo)
          .range(offset, offset + pageSize - 1);

        if (fetchError) throw fetchError;
        if (!data || data.length === 0) break;

        allData = [...allData, ...data];
        if (data.length < pageSize) break;
        offset += pageSize;
      }

      // Aggregate by wallet
      const volumeByWallet = allData.reduce((acc, tx) => {
        const addr = tx.wallet_address.toLowerCase();
        acc[addr] = (acc[addr] || 0) + Number(tx.amount_usd);
        return acc;
      }, {} as Record<string, number>);

      // Sort all and add ranks
      const allSorted = Object.entries(volumeByWallet)
        .map(([wallet_address, total_volume]) => ({ wallet_address, total_volume }))
        .sort((a, b) => b.total_volume - a.total_volume)
        .map((b, i) => ({ ...b, rank: i + 1 }));

      setAllBridgersRanked(allSorted);
      setTopBridgers(allSorted.slice(0, 5));
    } catch (e: any) {
      console.error('Failed to fetch top bridgers:', e);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      setIsLoading(true);
      await Promise.all([fetchTopBridgers(), fetchTransactions(), fetchStats()]);
      if (isMounted) setIsLoading(false);
    };

    load();

    // Refresh every 30 seconds
    const interval = setInterval(() => {
      if (isMounted) {
        fetchTransactions();
        fetchStats();
        fetchTopBridgers();
      }
    }, 30000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const refresh = async () => {
    await fetchTopBridgers();
    await Promise.all([fetchTransactions(), fetchStats()]);
  };

  // Get user rank by address
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
