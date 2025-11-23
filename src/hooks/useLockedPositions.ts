import { useEffect, useState } from 'react';
import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { TREASURY_CONTRACTS } from '@/lib/constants';
import TreasuryVaultABI from '@/lib/abis/TreasuryVault.json';
import { useUSYCPrice } from './useUSYCPrice';

export interface LockedPosition {
  id: bigint;
  amount: bigint;
  token: `0x${string}`;
  lockPeriodMonths: number;
  depositTime: bigint;
  unlockTime: bigint;
  lastYieldClaim: bigint;
  withdrawn: boolean;
}

export interface LockedPositionDisplay {
  id: string;
  arrayIndex: number; // Original index in contract's array (for withdraw/claim operations)
  amount: number;
  token: "USDC" | "EURC";
  lockPeriodMonths: 1 | 3 | 12;
  depositTime: Date;
  unlockTime: Date;
  currentAPY: number;
  earnedYield: number;
  isUnlocked: boolean;
}

/**
 * Hook to fetch user's locked positions
 */
export function useLockedPositions(address?: `0x${string}`) {
  const [positions, setPositions] = useState<LockedPositionDisplay[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Get real-time USYC APY for dynamic lock APY calculation
  const { apy: baseAPY } = useUSYCPrice();

  // Get locked positions from contract
  const { data: rawPositions, isLoading: isLoadingPositions, refetch } = useReadContract({
    address: TREASURY_CONTRACTS.TreasuryVault,
    abi: TreasuryVaultABI.abi,
    functionName: 'getUserLockedPositions',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });

  useEffect(() => {
    if (!rawPositions || !Array.isArray(rawPositions)) {
      setPositions([]);
      return;
    }

    setIsLoading(true);

    // Map positions and preserve original array index, filter out withdrawn positions
    const displayPositions: LockedPositionDisplay[] = rawPositions
      .map((pos: LockedPosition, arrayIndex: number) => {
        // Skip withdrawn positions
        if (pos.withdrawn) return null;

        // Check if token is Native USDC (uses 18 decimals) or EURC (uses 6 decimals)
        const isNativeUSDC = pos.token === '0x3600000000000000000000000000000000000000';
        const tokenDecimals = isNativeUSDC ? 18 : 6;
        const amount = Number(formatUnits(pos.amount, tokenDecimals));

        const depositTime = new Date(Number(pos.depositTime) * 1000);
        const unlockTime = new Date(Number(pos.unlockTime) * 1000);
        const isUnlocked = Date.now() >= unlockTime.getTime();

        // Calculate APY based on lock period (base USYC APY × boost multiplier)
        let boostMultiplier = 1.0;
        if (pos.lockPeriodMonths === 1) boostMultiplier = 1.17;   // +17% boost
        else if (pos.lockPeriodMonths === 3) boostMultiplier = 1.35;  // +35% boost
        else if (pos.lockPeriodMonths === 12) boostMultiplier = 1.69; // +69% boost
        const currentAPY = baseAPY * boostMultiplier;

        // Calculate earned yield (simplified - should call contract for accurate value)
        const timeElapsed = Date.now() - depositTime.getTime();
        const yearsElapsed = timeElapsed / (365 * 24 * 60 * 60 * 1000);
        const earnedYield = amount * (currentAPY / 100) * yearsElapsed;

        return {
          id: pos.id.toString(),
          arrayIndex, // Original index in contract's array
          amount,
          token: pos.token === '0x3600000000000000000000000000000000000000' ? 'USDC' : 'EURC',
          lockPeriodMonths: pos.lockPeriodMonths as 1 | 3 | 12,
          depositTime,
          unlockTime,
          currentAPY,
          earnedYield,
          isUnlocked,
        };
      })
      .filter((pos): pos is LockedPositionDisplay => pos !== null);

    setPositions(displayPositions);
    setIsLoading(false);
  }, [rawPositions, baseAPY]);

  return {
    positions,
    isLoading: isLoadingPositions || isLoading,
    refetch,
  };
}

/**
 * Hook to deposit with lock
 */
export function useDepositLocked() {
  const { data: hash, writeContract, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const depositLockedUSDC = async (amount: string, lockPeriodMonths: 1 | 3 | 12) => {
    // For Native USDC on Arc Testnet, both amount and msg.value must use 18 decimals
    const amountWei = parseUnits(amount, 18); // Convert to 18 decimals for Native USDC

    writeContract({
      address: TREASURY_CONTRACTS.TreasuryVault,
      abi: TreasuryVaultABI.abi,
      functionName: 'depositLockedUSDC',
      args: [amountWei, lockPeriodMonths],
      value: amountWei, // Must equal amount for Native USDC (both 18 decimals)
    });
  };

  const depositLockedEURC = async (amount: string, lockPeriodMonths: 1 | 3 | 12) => {
    const amountWei = parseUnits(amount, 6);

    writeContract({
      address: TREASURY_CONTRACTS.TreasuryVault,
      abi: TreasuryVaultABI.abi,
      functionName: 'depositLockedEURC',
      args: [amountWei, lockPeriodMonths],
    });
  };

  return {
    depositLockedUSDC,
    depositLockedEURC,
    isPending,
    isConfirming,
    isSuccess,
    error,
    hash,
  };
}

/**
 * Hook to withdraw locked position
 */
export function useWithdrawLocked() {
  const { data: hash, writeContract, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const withdrawLocked = async (positionIndex: number) => {
    writeContract({
      address: TREASURY_CONTRACTS.TreasuryVault,
      abi: TreasuryVaultABI.abi,
      functionName: 'withdrawLocked',
      args: [BigInt(positionIndex)],
    });
  };

  return {
    withdrawLocked,
    isPending,
    isConfirming,
    isSuccess,
    error,
    hash,
  };
}

/**
 * Hook to early withdraw with penalty
 */
export function useEarlyWithdrawLocked() {
  const { data: hash, writeContract, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const earlyWithdrawLocked = async (positionIndex: number) => {
    writeContract({
      address: TREASURY_CONTRACTS.TreasuryVault,
      abi: TreasuryVaultABI.abi,
      functionName: 'earlyWithdrawLocked',
      args: [BigInt(positionIndex)],
    });
  };

  return {
    earlyWithdrawLocked,
    isPending,
    isConfirming,
    isSuccess,
    error,
    hash,
  };
}

/**
 * Hook to claim yield from locked position
 */
export function useClaimLockedYield() {
  const { data: hash, writeContract, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const claimYield = async (positionIndex: number) => {
    writeContract({
      address: TREASURY_CONTRACTS.TreasuryVault,
      abi: TreasuryVaultABI.abi,
      functionName: 'claimLockedYield',
      args: [BigInt(positionIndex)],
    });
  };

  return {
    claimYield,
    isPending,
    isConfirming,
    isSuccess,
    error,
    hash,
  };
}

/**
 * Hook to get locked position yield
 */
export function useLockedPositionYield(address?: `0x${string}`, positionIndex?: number) {
  const { data: yieldAmount } = useReadContract({
    address: TREASURY_CONTRACTS.TreasuryVault,
    abi: TreasuryVaultABI.abi,
    functionName: 'getLockedPositionYield',
    args: address && positionIndex !== undefined ? [address, BigInt(positionIndex)] : undefined,
    query: {
      enabled: !!address && positionIndex !== undefined,
    },
  });

  return {
    yieldAmount: yieldAmount ? Number(formatUnits(yieldAmount as bigint, 6)) : 0,
  };
}
