import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://tclvgmhluhayiflwvkfq.supabase.co';
const SUPABASE_ANON_KEY = '***REDACTED_SUPABASE_ANON_KEY***';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export interface BridgeTransaction {
  id: number;
  wallet_address: string;
  amount_usd: number;
  direction: 'to_arc' | 'to_sepolia';
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

// Hook for bridge feed data with 24h leaderboard and all-time stats
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

  const fetchTransactions = async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('bridge_transactions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (fetchError) throw fetchError;
      setTransactions(data || []);
    } catch (e: any) {
      console.error('Failed to fetch bridge transactions:', e);
      setError(e.message);
    }
  };

  const fetchStats = async () => {
    try {
      // Use ALL TIME stats function (not 24h) so stats accumulate
      const { data: rpcData, error: rpcError } = await supabase
        .rpc('get_bridge_stats_all_time');

      if (!rpcError && rpcData && rpcData.length > 0) {
        setStats({
          totalVolume24h: Number(rpcData[0].total_volume) || 0,
          transactionCount24h: Number(rpcData[0].tx_count) || 0,
          uniqueUsers24h: Number(rpcData[0].unique_users) || 0,
        });
        return;
      }

      // Fallback: fetch all transactions (no time filter)
      let allData: { wallet_address: string; amount_usd: number }[] = [];
      let offset = 0;
      const pageSize = 1000;

      for (let i = 0; i < 100; i++) { // Max 100 pages (100k transactions)
        const { data, error: fetchError } = await supabase
          .from('bridge_transactions')
          .select('wallet_address, amount_usd')
          .range(offset, offset + pageSize - 1);

        if (fetchError) throw fetchError;
        if (!data || data.length === 0) break;

        allData = [...allData, ...data];
        if (data.length < pageSize) break;
        offset += pageSize;
      }

      const totalVolume = allData.reduce((sum, tx) => sum + Number(tx.amount_usd), 0);
      const uniqueUsers = new Set(allData.map(tx => tx.wallet_address)).size;

      setStats({
        totalVolume24h: totalVolume,
        transactionCount24h: allData.length,
        uniqueUsers24h: uniqueUsers,
      });
    } catch (e: any) {
      console.error('Failed to fetch bridge stats:', e);
    }
  };

  const fetchTopBridgers = async () => {
    try {
      // Top bridgers are calculated for the last 24 hours only
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      let allData: { wallet_address: string; amount_usd: number }[] = [];
      let offset = 0;
      const pageSize = 1000;

      while (true) {
        const { data, error: fetchError } = await supabase
          .from('bridge_transactions')
          .select('wallet_address, amount_usd')
          .gte('created_at', oneDayAgo)
          .range(offset, offset + pageSize - 1);

        if (fetchError) throw fetchError;
        if (!data || data.length === 0) break;

        allData = [...allData, ...data];
        if (data.length < pageSize) break; // Last page
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
      // Load all data in parallel for faster initial load
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
    // Load top bridgers first so gold status is ready
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
