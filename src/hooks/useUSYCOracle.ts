import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { formatUnits } from 'viem';
import { TREASURY_CONTRACTS } from '@/lib/constants';
import { arcTestnet } from '@/lib/wagmi';

// USYCOracle ABI
const USYC_ORACLE_ABI = [
  {
    inputs: [],
    name: 'getUSYCPriceInfo',
    outputs: [
      { name: 'price', type: 'uint256' },
      { name: 'lastUpdated', type: 'uint256' },
      { name: 'isPaused', type: 'bool' },
      { name: 'isStale', type: 'bool' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

// TreasuryVault ABI for refreshUserPoints
const TREASURY_VAULT_ABI = [
  {
    inputs: [],
    name: 'refreshUserPoints',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

export const useUSYCOracle = () => {
  const { data: priceInfo, isLoading, refetch } = useReadContract({
    address: TREASURY_CONTRACTS.USYCOracle,
    abi: USYC_ORACLE_ABI,
    functionName: 'getUSYCPriceInfo',
    chainId: arcTestnet.id,
    query: {
      enabled: true,
      refetchInterval: false,
      retry: (failureCount, error: any) => {
        if (error?.status === 429 || error?.message?.includes('429')) {
          return false;
        }
        return failureCount < 1;
      },
      retryDelay: 5000,
    },
  });

  const price = priceInfo ? parseFloat(formatUnits(priceInfo[0], 6)) : 0;
  const lastUpdated = priceInfo ? Number(priceInfo[1]) : 0;
  const isPaused = priceInfo ? priceInfo[2] : false;
  const isStale = priceInfo ? priceInfo[3] : false;

  // Format last updated time
  const getTimeAgo = (timestamp: number): string => {
    if (!timestamp) return 'Never';
    const seconds = Math.floor(Date.now() / 1000 - timestamp);
    if (seconds < 60) return `${seconds} seconds ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    return `${Math.floor(seconds / 86400)} days ago`;
  };

  return {
    price,
    lastUpdated,
    isPaused,
    isStale,
    timeAgo: getTimeAgo(lastUpdated),
    isLoading,
    refetch,
  };
};

export const useRefreshUserPoints = () => {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  });

  const refreshPoints = async () => {
    writeContract({
      address: TREASURY_CONTRACTS.TreasuryVault,
      abi: TREASURY_VAULT_ABI,
      functionName: 'refreshUserPoints',
      chainId: arcTestnet.id,
    });
  };

  return {
    refreshPoints,
    isPending: isPending || isConfirming,
    isConfirmed,
    hash,
    error,
  };
};

