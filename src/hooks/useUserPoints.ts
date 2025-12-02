import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://tclvgmhluhayiflwvkfq.supabase.co';
const SUPABASE_ANON_KEY = '***REDACTED_SUPABASE_ANON_KEY***';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Boost multipliers based on 24h bridge leaderboard rank
const getBoostMultiplier = (rank: number | null): number => {
  if (!rank) return 1.0;
  if (rank === 1) return 3.0;
  if (rank === 2) return 2.5;
  if (rank === 3) return 2.0;
  if (rank <= 5) return 1.5;
  if (rank <= 10) return 1.25;
  return 1.0;
};

export interface PointsBreakdown {
  bridgePoints: number;
  swapPoints: number;
  liquidityPoints: number;
  vaultPoints: number;
  referralPoints: number;
  totalPoints: number;
  bridgeBoost: number;
  bridgeRank: number | null;
}

export interface UserPointsData {
  wallet_address: string;
  bridge_volume: number;
  swap_volume: number;
  liquidity_volume: number;
  vault_volume: number;
  referral_count: number;
  total_points: number;
}

export const useUserPoints = () => {
  const account = useAccount();
  const address = account?.address;
  const isConnected = account?.isConnected ?? false;

  const [pointsData, setPointsData] = useState<UserPointsData | null>(null);
  const [bridgeRank24h, setBridgeRank24h] = useState<number | null>(null);
  const [rankLoaded, setRankLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isConnected || !address) {
      setPointsData(null);
      setBridgeRank24h(null);
      setRankLoaded(false);
      setIsLoading(false);
      return;
    }

    const fetchAllData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Fetch points and rank in parallel
        const [pointsResult, rankResult] = await Promise.all([
          // Fetch user points
          supabase
            .from('user_points')
            .select('*')
            .eq('wallet_address', address.toLowerCase())
            .single(),
          // Fetch 24h bridge transactions for rank calculation
          (async () => {
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
              if (data.length < pageSize) break;
              offset += pageSize;
            }

            // Aggregate by wallet
            const volumeByWallet = allData.reduce((acc, tx) => {
              const addr = tx.wallet_address.toLowerCase();
              acc[addr] = (acc[addr] || 0) + Number(tx.amount_usd);
              return acc;
            }, {} as Record<string, number>);

            // Sort and find rank
            const sorted = Object.entries(volumeByWallet)
              .sort(([, a], [, b]) => b - a);

            const userIndex = sorted.findIndex(([addr]) => addr === address.toLowerCase());
            return userIndex !== -1 ? userIndex + 1 : null;
          })()
        ]);

        // Handle points result
        if (pointsResult.error && pointsResult.error.code !== 'PGRST116') {
          throw pointsResult.error;
        }
        setPointsData(pointsResult.data || null);

        // Handle rank result
        setBridgeRank24h(rankResult);
        setRankLoaded(true);

      } catch (e: any) {
        console.error('Failed to fetch user data:', e);
        setError(e.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllData();

    const interval = setInterval(fetchAllData, 60000);
    return () => clearInterval(interval);
  }, [address, isConnected]);

  // Only apply boost once rank is loaded to avoid visual jumps
  const boostMultiplier = rankLoaded ? getBoostMultiplier(bridgeRank24h) : 1.0;

  // Calculate bridge points with boost applied
  const baseBridgePoints = pointsData ? (pointsData.bridge_volume / 100) * 1.0 : 0;
  const boostedBridgePoints = baseBridgePoints * boostMultiplier;

  const pointsBreakdown: PointsBreakdown | null = pointsData ? {
    bridgePoints: boostedBridgePoints,
    swapPoints: (pointsData.swap_volume / 100) * 0.5,
    liquidityPoints: (pointsData.liquidity_volume / 100) * 2.0,
    vaultPoints: (pointsData.vault_volume / 100) * 1.0,
    referralPoints: pointsData.referral_count * 50,
    totalPoints: boostedBridgePoints +
      (pointsData.swap_volume / 100) * 0.5 +
      (pointsData.liquidity_volume / 100) * 2.0 +
      (pointsData.vault_volume / 100) * 1.0 +
      pointsData.referral_count * 50,
    bridgeBoost: boostMultiplier,
    bridgeRank: bridgeRank24h,
  } : null;

  const pointsValue = pointsBreakdown?.totalPoints || 0;
  const formattedPoints = pointsValue.toLocaleString('en-US', { maximumFractionDigits: 0 });

  return {
    points: pointsValue,
    formattedPoints,
    breakdown: pointsBreakdown,
    volumes: pointsData ? {
      bridge: pointsData.bridge_volume,
      swap: pointsData.swap_volume,
      liquidity: pointsData.liquidity_volume,
      vault: pointsData.vault_volume,
      referrals: pointsData.referral_count,
    } : null,
    bridgeRank: bridgeRank24h,
    bridgeBoost: boostMultiplier,
    rankLoaded,
    isLoading,
    error,
  };
};
