import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { supabase } from '@/lib/supabase';

export interface PointsBreakdown {
  bridgePoints: number;
  swapPoints: number;
  liquidityPoints: number;
  vaultPoints: number;
  referralPoints: number;
  totalPoints: number;
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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isConnected || !address) {
      setPointsData(null);
      setIsLoading(false);
      return;
    }

    const fetchPoints = async () => {
      if (!supabase) return;
      setIsLoading(true);
      setError(null);

      try {
        // Fetch user points - total_points is PERMANENT and CUMULATIVE
        const { data, error: fetchError } = await supabase
          .from('user_points')
          .select('*')
          .eq('wallet_address', address.toLowerCase())
          .single();

        if (fetchError && fetchError.code !== 'PGRST116') {
          throw fetchError;
        }
        setPointsData(data || null);

      } catch (e: any) {
        console.error('Failed to fetch user points:', e);
        setError(e.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPoints();

    const interval = setInterval(fetchPoints, 60000);
    return () => clearInterval(interval);
  }, [address, isConnected]);

  // Points breakdown from permanent points_earned (no dynamic boost)
  // total_points from DB is already the sum of all points_earned
  const pointsBreakdown: PointsBreakdown | null = pointsData ? {
    bridgePoints: (pointsData.bridge_volume / 100) * 1.0,
    swapPoints: (pointsData.swap_volume / 100) * 0.5,
    liquidityPoints: (pointsData.liquidity_volume / 100) * 2.0,
    vaultPoints: (pointsData.vault_volume / 100) * 1.0,
    referralPoints: pointsData.referral_count * 50,
    totalPoints: pointsData.total_points, // Use DB total directly - permanent!
  } : null;

  const pointsValue = pointsData?.total_points || 0;
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
    isLoading,
    error,
  };
};
