import { useReadContracts } from 'wagmi';
import { formatUnits } from 'viem';
import { TREASURY_CONTRACTS } from '@/lib/constants';
import { arcTestnet } from '@/lib/wagmi';
import { useExchangeRate } from './useExchangeRate';

const VAULT_ABI = [
  { name: 'totalUSDC', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'totalEURC', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'totalLockedUSDC', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'totalLockedEURC', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
] as const;

interface UseTVLReturn {
  tvl: number;
  totalUSDC: number;
  totalEURC: number;
  totalLockedUSDC: number;
  totalLockedEURC: number;
  isLoading: boolean;
}

const vaultContract = {
  address: TREASURY_CONTRACTS.TreasuryVault,
  abi: VAULT_ABI,
  chainId: arcTestnet.id,
} as const;

export function useTVL(): UseTVLReturn {
  const { eurToUsd } = useExchangeRate();

  const { data, isLoading } = useReadContracts({
    contracts: [
      { ...vaultContract, functionName: 'totalUSDC' },
      { ...vaultContract, functionName: 'totalEURC' },
      { ...vaultContract, functionName: 'totalLockedUSDC' },
      { ...vaultContract, functionName: 'totalLockedEURC' },
    ],
  });

  const totalUSDCRaw = data?.[0]?.result as bigint | undefined;
  const totalEURCRaw = data?.[1]?.result as bigint | undefined;
  const totalLockedUSDCRaw = data?.[2]?.result as bigint | undefined;

  // USDC on Arc is 18 decimals, EURC is 6 decimals
  const usdcAmount = totalUSDCRaw ? parseFloat(formatUnits(totalUSDCRaw, 18)) : 0;
  const eurcAmount = totalEURCRaw ? parseFloat(formatUnits(totalEURCRaw, 6)) : 0;
  const lockedUsdcAmount = totalLockedUSDCRaw ? parseFloat(formatUnits(totalLockedUSDCRaw, 18)) : 0;
  // Note: totalLockedEURC returns corrupted data from contract storage - skip it for now
  const lockedEurcAmount = 0;

  // Convert EURC to USD using live exchange rate
  const eurcInUsd = (eurcAmount + lockedEurcAmount) * eurToUsd;
  const tvl = usdcAmount + eurcInUsd + lockedUsdcAmount;

  return {
    tvl,
    totalUSDC: usdcAmount + lockedUsdcAmount,
    totalEURC: eurcAmount + lockedEurcAmount,
    totalLockedUSDC: lockedUsdcAmount,
    totalLockedEURC: lockedEurcAmount,
    isLoading,
  };
}
