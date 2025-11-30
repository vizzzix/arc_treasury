import { useEffect, useState } from 'react';
import { formatUnits } from 'viem';
import { TREASURY_CONTRACTS } from '@/lib/constants';

interface LeaderboardEntry {
  address: string;
  totalDeposited: bigint;
  formattedAmount: string;
  rank: number;
}

interface UseLeaderboardReturn {
  leaderboard: LeaderboardEntry[];
  isLoading: boolean;
  error: string | null;
  userRank: number | null;
  totalDepositors: number;
}

// Cache for leaderboard data (10 min TTL)
let cachedData: { leaderboard: LeaderboardEntry[]; timestamp: number } | null = null;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

interface ArcscanLogItem {
  block_number?: number;
  topics: (string | null)[];
  decoded?: {
    method_call: string;
    parameters: Array<{
      name: string;
      value: string;
      type: string;
    }>;
  };
}

// Process logs into leaderboard entries using peak balance (prevents wash trading)
function processLogs(logs: ArcscanLogItem[]): LeaderboardEntry[] {
  const balanceMap = new Map<string, bigint>();
  const peakMap = new Map<string, bigint>();

  // Sort logs by block number (oldest first) to process chronologically
  const sortedLogs = [...logs].sort((a, b) => (a.block_number || 0) - (b.block_number || 0));

  for (const log of sortedLogs) {
    if (!log.decoded?.method_call) continue;

    const method = log.decoded.method_call;
    const params = log.decoded.parameters;

    const userParam = params.find(p => p.name === 'user');
    const amountParam = params.find(p => p.name === 'amount' || p.name === 'arcUSDCAmount');

    if (!userParam || !amountParam) continue;

    const user = userParam.value.toLowerCase();
    const amount = BigInt(amountParam.value);

    const isFlexDeposit = method.startsWith('Deposit(') || method.startsWith('DepositEURC(');
    const isLockedDeposit = method.startsWith('DepositLocked(');
    const isFlexWithdraw = method.startsWith('Withdraw(') || method.startsWith('WithdrawEURC(');
    const isLockedWithdraw = method.startsWith('LockedPositionWithdrawn(');

    const tokenParam = params.find(p => p.name === 'token');
    const isUsdc = !tokenParam || tokenParam.value.toLowerCase() === '0x3600000000000000000000000000000000000000';
    const isEurcMethod = method.includes('EURC');
    const amount6Dec = (isUsdc && !isEurcMethod) ? amount / 10n ** 12n : amount;

    const currentBalance = balanceMap.get(user) || 0n;

    if (isFlexDeposit || isLockedDeposit) {
      const newBalance = currentBalance + amount6Dec;
      balanceMap.set(user, newBalance);
      const currentPeak = peakMap.get(user) || 0n;
      if (newBalance > currentPeak) {
        peakMap.set(user, newBalance);
      }
    } else if (isFlexWithdraw || isLockedWithdraw) {
      const newBalance = currentBalance - amount6Dec;
      balanceMap.set(user, newBalance > 0n ? newBalance : 0n);
    }
  }

  // Use peak balance for ranking (prevents wash trading)
  return Array.from(peakMap.entries())
    .map(([address, totalDeposited]) => ({
      address,
      totalDeposited,
      formattedAmount: formatUnits(totalDeposited, 6),
      rank: 0,
    }))
    .filter(entry => entry.totalDeposited > 0n)
    .sort((a, b) => (b.totalDeposited > a.totalDeposited ? 1 : -1))
    .slice(0, 15)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

// Fetch all logs via Arcscan API with pagination
async function fetchAllLogs(address: string): Promise<ArcscanLogItem[]> {
  const allLogs: ArcscanLogItem[] = [];
  let nextPage: { block_number: number; index: number; items_count: number } | null = null;

  try {
    for (let i = 0; i < 4; i++) {
      let url = `https://testnet.arcscan.app/api/v2/addresses/${address}/logs`;
      if (nextPage) {
        url += `?block_number=${nextPage.block_number}&index=${nextPage.index}&items_count=${nextPage.items_count}`;
      }

      const response = await fetch(url);
      if (!response.ok) break;

      const data = await response.json();
      if (!data.items || data.items.length === 0) break;

      allLogs.push(...data.items);
      nextPage = data.next_page_params;
      if (!nextPage) break;
    }
  } catch (err) {
    console.warn('Arcscan API failed:', err);
  }

  return allLogs;
}

export function useLeaderboard(userAddress?: string): UseLeaderboardReturn {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(
    cachedData?.leaderboard || []
  );
  const [isLoading, setIsLoading] = useState(!cachedData);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      // Check cache first
      if (cachedData && Date.now() - cachedData.timestamp < CACHE_TTL) {
        setLeaderboard(cachedData.leaderboard);
        setIsLoading(false);
        return;
      }

      if (cachedData) {
        setLeaderboard(cachedData.leaderboard);
      }

      try {
        setIsLoading(true);
        setError(null);

        const vaultAddress = TREASURY_CONTRACTS.TreasuryVault;
        const allLogs = await fetchAllLogs(vaultAddress);
        const sorted = processLogs(allLogs);

        cachedData = { leaderboard: sorted, timestamp: Date.now() };
        setLeaderboard(sorted);
      } catch (err) {
        console.error('Error fetching leaderboard:', err);
        setError('Failed to load leaderboard');
      } finally {
        setIsLoading(false);
      }
    };

    fetchLeaderboard();
  }, []);

  const userRank = userAddress
    ? leaderboard.findIndex(e => e.address.toLowerCase() === userAddress.toLowerCase()) + 1 || null
    : null;

  return {
    leaderboard,
    isLoading,
    error,
    userRank: userRank === 0 ? null : userRank,
    totalDepositors: leaderboard.length,
  };
}
