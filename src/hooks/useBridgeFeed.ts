import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://tclvgmhluhayiflwvkfq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRjbHZnbWhsdWhheWlmbHd2a2ZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzNTEyNTIsImV4cCI6MjA3ODkyNzI1Mn0.oiLvKlLj-vvD7wRT70RLiBrCvJQYosDPIGDyV6NzXuU';

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
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      // Supabase default limit is 1000, need to fetch all with pagination
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
      // Supabase default limit is 1000, need to fetch all with pagination
      let allData: { wallet_address: string; amount_usd: number }[] = [];
      let offset = 0;
      const pageSize = 1000;

      while (true) {
        const { data, error: fetchError } = await supabase
          .from('bridge_transactions')
          .select('wallet_address, amount_usd')
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
      await Promise.all([fetchTransactions(), fetchStats(), fetchTopBridgers()]);
      if (isMounted) setIsLoading(false);
    };

    load();

    // Refresh every 30 seconds
    const interval = setInterval(() => {
      if (isMounted) {
        fetchTransactions();
        fetchStats();
      }
    }, 30000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const refresh = async () => {
    await Promise.all([fetchTransactions(), fetchStats(), fetchTopBridgers()]);
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
