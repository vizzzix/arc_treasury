import { useAccount, useReadContracts } from 'wagmi';
import { defineChain } from 'viem';
import { TREASURY_CONTRACTS } from '@/lib/constants';

// Arc Testnet chain definition
const arcTestnet = defineChain({
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'Ethereum', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.testnet.arc.network'] },
  },
  blockExplorers: {
    default: { name: 'Arc Explorer', url: 'https://testnet.arcscan.app' },
  },
  testnet: true,
}) as const;

// V8 Treasury Vault ABI for points
const TREASURY_VAULT_V8_ABI = [
  {
    inputs: [{ name: 'user', type: 'address' }],
    name: 'getUserPoints',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'user', type: 'address' }],
    name: 'getPointsBreakdown',
    outputs: [
      { name: 'permanentPoints', type: 'uint256' },
      { name: 'pendingTimePoints', type: 'uint256' },
      { name: 'referralPoints', type: 'uint256' },
      { name: 'totalPoints', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

export interface PointsBreakdown {
  permanentPoints: number;
  pendingTimePoints: number;
  referralPoints: number;
  totalPoints: number;
}

export const useUserPoints = () => {
  const account = useAccount();
  const address = account?.address;
  const isConnected = account?.isConnected ?? false;
  const chainId = account?.chainId;
  const isArcTestnet = chainId === 5042002;

  // Multicall for both getUserPoints and getPointsBreakdown
  const { data: pointsData, isLoading } = useReadContracts({
    contracts: [
      {
        address: TREASURY_CONTRACTS.TreasuryVault,
        abi: TREASURY_VAULT_V8_ABI,
        functionName: 'getUserPoints',
        args: address ? [address] : undefined,
        chainId: arcTestnet.id,
      },
      {
        address: TREASURY_CONTRACTS.TreasuryVault,
        abi: TREASURY_VAULT_V8_ABI,
        functionName: 'getPointsBreakdown',
        args: address ? [address] : undefined,
        chainId: arcTestnet.id,
      },
    ],
    query: {
      enabled: isConnected && isArcTestnet && !!address,
      refetchInterval: 60000, // Auto-refresh every 60 seconds
    },
  });

  // V8 points are whole numbers (not scaled)
  const points = pointsData?.[0]?.result as bigint | undefined;
  const breakdown = pointsData?.[1]?.result as [bigint, bigint, bigint, bigint] | undefined;

  const pointsValue = points ? Number(points) : 0;
  const formattedPoints = pointsValue.toLocaleString('en-US', { maximumFractionDigits: 0 });

  const pointsBreakdown: PointsBreakdown | null = breakdown ? {
    permanentPoints: Number(breakdown[0]),
    pendingTimePoints: Number(breakdown[1]),
    referralPoints: Number(breakdown[2]),
    totalPoints: Number(breakdown[3]),
  } : null;

  return {
    points: pointsValue,
    formattedPoints,
    breakdown: pointsBreakdown,
    isLoading,
  };
};
