import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export interface LeaderboardEntry {
  address: string;
  totalPoints: number;
  formattedAmount: string;
  rank: number;
  bridgeVolume: number;
  vaultVolume: number;
  swapVolume: number;
  liquidityVolume: number;
}

interface UseLeaderboardReturn {
  leaderboard: LeaderboardEntry[];
  isLoading: boolean;
  error: string | null;
  userRank: number | null;
  userEntry: LeaderboardEntry | null;
  totalDepositors: number;
}

// Cache for leaderboard data (2 min TTL)
let cachedData: { leaderboard: LeaderboardEntry[]; totalUsers: number; timestamp: number } | null = null;
const CACHE_TTL = 2 * 60 * 1000; // 2 minutes

// Get unique site users count from site_bridges
async function getSiteUsersCount(): Promise<number> {
  if (!supabase) return 0;
  try {
    const { data, error } = await supabase
      .from('site_bridges')
      .select('wallet_address');
    if (error) throw error;
    const uniqueAddresses = new Set((data || []).map(d => d.wallet_address.toLowerCase()));
    return uniqueAddresses.size;
  } catch {
    return 0;
  }
}

export function useLeaderboard(userAddress?: string): UseLeaderboardReturn {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(
    cachedData?.leaderboard || []
  );
  const [totalUsers, setTotalUsers] = useState(cachedData?.totalUsers || 0);
  const [isLoading, setIsLoading] = useState(!cachedData);
  const [error, setError] = useState<string | null>(null);
  const [userEntry, setUserEntry] = useState<LeaderboardEntry | null>(null);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      // Check cache first
      if (cachedData && Date.now() - cachedData.timestamp < CACHE_TTL) {
        setLeaderboard(cachedData.leaderboard);
        setTotalUsers(cachedData.totalUsers);
        setIsLoading(false);
        return;
      }

      if (!supabase) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        // Fetch top 50 users by total_points and count of real site users
        const [leaderboardResult, siteUsersCount] = await Promise.all([
          supabase
            .from('user_points')
            .select('*')
            .gt('total_points', 0)
            .order('total_points', { ascending: false })
            .limit(50),
          getSiteUsersCount()
        ]);

        if (leaderboardResult.error) throw leaderboardResult.error;

        const entries: LeaderboardEntry[] = (leaderboardResult.data || []).map((row, index) => ({
          address: row.wallet_address,
          totalPoints: row.total_points || 0,
          formattedAmount: (row.total_points || 0).toLocaleString('en-US', { maximumFractionDigits: 0 }),
          rank: index + 1,
          bridgeVolume: row.bridge_volume || 0,
          vaultVolume: row.vault_volume || 0,
          swapVolume: row.swap_volume || 0,
          liquidityVolume: row.liquidity_volume || 0,
        }));

        cachedData = { leaderboard: entries, totalUsers: siteUsersCount, timestamp: Date.now() };
        setLeaderboard(entries);
        setTotalUsers(siteUsersCount);
      } catch (err) {
        console.error('Error fetching leaderboard:', err);
        setError('Failed to load leaderboard');
      } finally {
        setIsLoading(false);
      }
    };

    fetchLeaderboard();
  }, []);

  // Fetch user's position if not in top 50
  useEffect(() => {
    if (!userAddress) {
      setUserEntry(null);
      return;
    }

    const fetchUserRank = async () => {
      // Check if user is in cached leaderboard
      const inLeaderboard = leaderboard.find(
        e => e.address.toLowerCase() === userAddress.toLowerCase()
      );

      if (inLeaderboard) {
        setUserEntry(inLeaderboard);
        return;
      }

      if (!supabase) return;

      try {
        // Fetch user's data
        const { data: userData, error: userError } = await supabase
          .from('user_points')
          .select('*')
          .eq('wallet_address', userAddress.toLowerCase())
          .single();

        if (userError && userError.code !== 'PGRST116') {
          console.error('Error fetching user rank:', userError);
          return;
        }

        if (!userData || userData.total_points <= 0) {
          setUserEntry(null);
          return;
        }

        // Get user's rank by counting users with more points
        const { count, error: countError } = await supabase
          .from('user_points')
          .select('*', { count: 'exact', head: true })
          .gt('total_points', userData.total_points);

        if (countError) {
          console.error('Error counting rank:', countError);
          return;
        }

        const rank = (count || 0) + 1;

        setUserEntry({
          address: userData.wallet_address,
          totalPoints: userData.total_points || 0,
          formattedAmount: (userData.total_points || 0).toLocaleString('en-US', { maximumFractionDigits: 0 }),
          rank,
          bridgeVolume: userData.bridge_volume || 0,
          vaultVolume: userData.vault_volume || 0,
          swapVolume: userData.swap_volume || 0,
          liquidityVolume: userData.liquidity_volume || 0,
        });
      } catch (err) {
        console.error('Error fetching user rank:', err);
      }
    };

    fetchUserRank();
  }, [userAddress, leaderboard]);

  const userRank = userEntry?.rank || null;

  return {
    leaderboard,
    isLoading,
    error,
    userRank,
    userEntry,
    totalDepositors: totalUsers,
  };
}
