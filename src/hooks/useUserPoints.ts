import { useAccount, useReadContract } from 'wagmi';
import { defineChain, formatUnits } from 'viem';
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

// Treasury Vault ABI for getUserPoints
const TREASURY_VAULT_ABI = [
  {
    inputs: [{ name: 'user', type: 'address' }],
    name: 'getUserPoints',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

export const useUserPoints = () => {
  const account = useAccount();
  const address = account?.address;
  const isConnected = account?.isConnected ?? false;
  const chainId = account?.chainId;
  const isArcTestnet = chainId === 5042002;

  const { data: points, isLoading } = useReadContract({
    address: TREASURY_CONTRACTS.TreasuryVault,
    abi: TREASURY_VAULT_ABI,
    functionName: 'getUserPoints',
    args: address ? [address] : undefined,
    chainId: arcTestnet.id,
    query: {
      enabled: isConnected && isArcTestnet && !!address,
      refetchInterval: 60000, // Auto-refresh every 60 seconds
    },
  });

  // Points are calculated from wei amounts (18 decimals) divided by 10000
  // This results in points scaled by 10^15, so we need to use formatUnits with 15 decimals
  const pointsValue = points ? Number(formatUnits(points, 15)) : 0;
  const formattedPoints = pointsValue.toLocaleString('en-US', { maximumFractionDigits: 0 });

  return {
    points: pointsValue,
    formattedPoints,
    isLoading,
  };
};
