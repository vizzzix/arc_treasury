import { useEffect, useState } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits, formatUnits, createPublicClient, http } from 'viem';
import { TREASURY_CONTRACTS, TOKEN_ADDRESSES } from '@/lib/constants';
import TreasuryVaultABI from '@/lib/abis/TreasuryVault.json';
import { useUSYCPrice } from './useUSYCPrice';
import { arcTestnet } from '@/lib/wagmi';

// ERC20 ABI for approve and allowance
const ERC20_ABI = [
  {
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

// Create public client for waiting on receipts
const client = createPublicClient({
  chain: arcTestnet,
  transport: http('https://rpc.testnet.arc.network'),
});

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

        // APY is the same for all lock periods (new business model)
        // Lock bonus is only Points multiplier, not APY boost
        const currentAPY = baseAPY;

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
  const { address } = useAccount();
  const { data: hash, writeContractAsync, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  // Check EURC allowance
  const { data: eurcAllowance, refetch: refetchEURCAllowance } = useReadContract({
    address: TOKEN_ADDRESSES.arcTestnet.EURC,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address ? [address, TREASURY_CONTRACTS.TreasuryVault] : undefined,
    query: {
      enabled: !!address,
    },
  });

  const depositLockedUSDC = async (amount: string, lockPeriodMonths: 1 | 3 | 12) => {
    if (!writeContractAsync) {
      throw new Error('Write function not available');
    }

    // For Native USDC on Arc Testnet, both amount and msg.value must use 18 decimals
    const amountWei = parseUnits(amount, 18); // Convert to 18 decimals for Native USDC

    const txHash = await writeContractAsync({
      address: TREASURY_CONTRACTS.TreasuryVault,
      abi: TreasuryVaultABI.abi,
      functionName: 'depositLockedUSDC',
      args: [amountWei, lockPeriodMonths],
      value: amountWei, // Must equal amount for Native USDC (both 18 decimals)
    });

    // Don't wait for confirmation - let wagmi's useWaitForTransactionReceipt handle it
    // This allows the modal to close immediately after tx is submitted
    return txHash;
  };

  const depositLockedEURC = async (amount: string, lockPeriodMonths: 1 | 3 | 12) => {
    if (!writeContractAsync) {
      throw new Error('Write function not available');
    }

    const eurcAddress = TOKEN_ADDRESSES.arcTestnet.EURC;
    const amountWei = parseUnits(amount, 6);

    // Check EURC allowance and approve if needed
    const currentAllowance = eurcAllowance || 0n;

    if (currentAllowance < amountWei) {
      // Approve first
      const approveHash = await writeContractAsync({
        address: eurcAddress,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [TREASURY_CONTRACTS.TreasuryVault, amountWei],
        chainId: arcTestnet.id,
      });

      // Wait for approval confirmation
      const approveReceipt = await client.waitForTransactionReceipt({
        hash: approveHash,
        timeout: 120000,
      });

      if (approveReceipt.status === 'reverted') {
        throw new Error('EURC approval failed');
      }

      // Refetch allowance
      await refetchEURCAllowance();
    }

    // Now deposit
    const txHash = await writeContractAsync({
      address: TREASURY_CONTRACTS.TreasuryVault,
      abi: TreasuryVaultABI.abi,
      functionName: 'depositLockedEURC',
      args: [amountWei, lockPeriodMonths],
      chainId: arcTestnet.id,
    });

    return txHash;
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
  const { data: hash, writeContractAsync, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const withdrawLocked = async (positionIndex: number) => {
    const txHash = await writeContractAsync({
      address: TREASURY_CONTRACTS.TreasuryVault,
      abi: TreasuryVaultABI.abi,
      functionName: 'withdrawLocked',
      args: [BigInt(positionIndex)],
    });
    return txHash;
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
  const { data: hash, writeContractAsync, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const earlyWithdrawLocked = async (positionIndex: number) => {
    const txHash = await writeContractAsync({
      address: TREASURY_CONTRACTS.TreasuryVault,
      abi: TreasuryVaultABI.abi,
      functionName: 'earlyWithdrawLocked',
      args: [BigInt(positionIndex)],
    });
    return txHash;
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
