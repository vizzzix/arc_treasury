import { useReadContract } from 'wagmi';
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

export function useTVL(): UseTVLReturn {
  const vaultAddress = TREASURY_CONTRACTS.TreasuryVault;
  const { eurToUsd } = useExchangeRate();

  const { data: totalUSDC, isLoading: isLoadingUSDC } = useReadContract({
    address: vaultAddress,
    abi: VAULT_ABI,
    functionName: 'totalUSDC',
    chainId: arcTestnet.id,
  });

  const { data: totalEURC, isLoading: isLoadingEURC } = useReadContract({
    address: vaultAddress,
    abi: VAULT_ABI,
    functionName: 'totalEURC',
    chainId: arcTestnet.id,
  });

  const { data: totalLockedUSDC, isLoading: isLoadingLockedUSDC } = useReadContract({
    address: vaultAddress,
    abi: VAULT_ABI,
    functionName: 'totalLockedUSDC',
    chainId: arcTestnet.id,
  });

  const { data: totalLockedEURC, isLoading: isLoadingLockedEURC } = useReadContract({
    address: vaultAddress,
    abi: VAULT_ABI,
    functionName: 'totalLockedEURC',
    chainId: arcTestnet.id,
  });

  // USDC on Arc is 18 decimals, EURC is 6 decimals
  const usdcAmount = totalUSDC ? parseFloat(formatUnits(totalUSDC, 18)) : 0;
  const eurcAmount = totalEURC ? parseFloat(formatUnits(totalEURC, 6)) : 0;
  const lockedUsdcAmount = totalLockedUSDC ? parseFloat(formatUnits(totalLockedUSDC, 18)) : 0;
  // Note: totalLockedEURC returns corrupted data from contract storage - skip it for now
  // const lockedEurcAmount = totalLockedEURC ? parseFloat(formatUnits(totalLockedEURC, 6)) : 0;
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
    isLoading: isLoadingUSDC || isLoadingEURC || isLoadingLockedUSDC || isLoadingLockedEURC,
  };
}
