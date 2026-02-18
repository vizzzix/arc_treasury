import { useEffect, useState } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits, formatUnits, createPublicClient, http } from 'viem';
import { TREASURY_CONTRACTS, TOKEN_ADDRESSES } from '@/lib/constants';
import TreasuryVaultABI from '@/lib/abis/TreasuryVault.json';
import { useUSYCPrice } from './useUSYCPrice';
import { arcTestnet, ARC_RPC_URL } from '@/lib/wagmi';
import { ERC20_ABI } from '@/lib/abis/erc20';
import { useUnifiedWallet } from './useUnifiedWallet';
import { useCircleWallet } from '@/providers/CircleWalletProvider';
import { useServerVault } from './useServerVault';

// Create public client for waiting on receipts
const client = createPublicClient({
  chain: arcTestnet,
  transport: http(ARC_RPC_URL),
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
    chainId: arcTestnet.id,
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
  const account = useAccount();
  const unifiedWallet = useUnifiedWallet();
  const circleWallet = useCircleWallet();
  const serverVault = useServerVault();
  const address = account?.address || (unifiedWallet.address as `0x${string}` | undefined);
  const isCircle = unifiedWallet.walletType === 'circle';
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
    chainId: arcTestnet.id,
    query: {
      enabled: !!address,
    },
  });

  const depositLockedUSDC = async (amount: string, lockPeriodMonths: 1 | 3 | 12) => {
    // Circle wallet path — server-side execution
    if (isCircle) {
      const arcWalletId = circleWallet.arcWalletId;
      if (!arcWalletId) throw new Error('Arc wallet not found');
      const txHash = await serverVault.depositLocked(arcWalletId, amount, 'USDC', lockPeriodMonths, address);
      if (!txHash) throw new Error('Locked deposit failed');
      return txHash as `0x${string}`;
    }

    if (!writeContractAsync) {
      throw new Error('Write function not available');
    }

    // For Native USDC on Arc Testnet, both amount and msg.value must use 18 decimals
    const amountWei = parseUnits(amount, 18);

    const txHash = await writeContractAsync({
      address: TREASURY_CONTRACTS.TreasuryVault,
      abi: TreasuryVaultABI.abi,
      functionName: 'depositLockedUSDC',
      args: [amountWei, lockPeriodMonths],
      value: amountWei,
    });

    return txHash;
  };

  const depositLockedEURC = async (amount: string, lockPeriodMonths: 1 | 3 | 12) => {
    // Circle wallet path — server-side execution
    if (isCircle) {
      const arcWalletId = circleWallet.arcWalletId;
      if (!arcWalletId) throw new Error('Arc wallet not found');
      const txHash = await serverVault.depositLocked(arcWalletId, amount, 'EURC', lockPeriodMonths, address);
      if (!txHash) throw new Error('Locked deposit failed');
      return txHash as `0x${string}`;
    }

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
    isPending: isCircle ? serverVault.isProcessing : isPending,
    isConfirming: isCircle ? serverVault.isProcessing : isConfirming,
    isSuccess: isCircle ? serverVault.isComplete : isSuccess,
    error: isCircle ? (serverVault.error ? new Error(serverVault.error) : null) : error,
    hash: isCircle ? (serverVault.txHash as `0x${string}` | undefined) : hash,
  };
}

/**
 * Hook to withdraw locked position
 */
export function useWithdrawLocked() {
  const unifiedWallet = useUnifiedWallet();
  const circleWallet = useCircleWallet();
  const serverVault = useServerVault();
  const isCircle = unifiedWallet.walletType === 'circle';
  const { data: hash, writeContractAsync, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const withdrawLocked = async (positionIndex: number) => {
    if (isCircle) {
      const arcWalletId = circleWallet.arcWalletId;
      if (!arcWalletId) throw new Error('Arc wallet not found');
      const txHash = await serverVault.withdrawLocked(arcWalletId, positionIndex, unifiedWallet.address);
      if (!txHash) throw new Error('Withdraw locked failed');
      return txHash as `0x${string}`;
    }

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
    isPending: isCircle ? serverVault.isProcessing : isPending,
    isConfirming: isCircle ? serverVault.isProcessing : isConfirming,
    isSuccess: isCircle ? serverVault.isComplete : isSuccess,
    error: isCircle ? (serverVault.error ? new Error(serverVault.error) : null) : error,
    hash: isCircle ? (serverVault.txHash as `0x${string}` | undefined) : hash,
  };
}

/**
 * Hook to early withdraw with penalty
 */
export function useEarlyWithdrawLocked() {
  const unifiedWallet = useUnifiedWallet();
  const circleWallet = useCircleWallet();
  const serverVault = useServerVault();
  const isCircle = unifiedWallet.walletType === 'circle';
  const { data: hash, writeContractAsync, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const earlyWithdrawLocked = async (positionIndex: number) => {
    if (isCircle) {
      const arcWalletId = circleWallet.arcWalletId;
      if (!arcWalletId) throw new Error('Arc wallet not found');
      const txHash = await serverVault.earlyWithdrawLocked(arcWalletId, positionIndex, unifiedWallet.address);
      if (!txHash) throw new Error('Early withdraw failed');
      return txHash as `0x${string}`;
    }

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
    isPending: isCircle ? serverVault.isProcessing : isPending,
    isConfirming: isCircle ? serverVault.isProcessing : isConfirming,
    isSuccess: isCircle ? serverVault.isComplete : isSuccess,
    error: isCircle ? (serverVault.error ? new Error(serverVault.error) : null) : error,
    hash: isCircle ? (serverVault.txHash as `0x${string}` | undefined) : hash,
  };
}

/**
 * Hook to claim yield from locked position
 */
export function useClaimLockedYield() {
  const unifiedWallet = useUnifiedWallet();
  const circleWallet = useCircleWallet();
  const serverVault = useServerVault();
  const isCircle = unifiedWallet.walletType === 'circle';
  const { data: hash, writeContract, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const claimYield = async (positionIndex: number) => {
    if (isCircle) {
      const arcWalletId = circleWallet.arcWalletId;
      if (!arcWalletId) throw new Error('Arc wallet not found');
      const txHash = await serverVault.claimLockedYield(arcWalletId, positionIndex, unifiedWallet.address);
      if (!txHash) throw new Error('Claim yield failed');
      return txHash as `0x${string}`;
    }

    writeContract({
      address: TREASURY_CONTRACTS.TreasuryVault,
      abi: TreasuryVaultABI.abi,
      functionName: 'claimLockedYield',
      args: [BigInt(positionIndex)],
    });
  };

  return {
    claimYield,
    isPending: isCircle ? serverVault.isProcessing : isPending,
    isConfirming: isCircle ? serverVault.isProcessing : isConfirming,
    isSuccess: isCircle ? serverVault.isComplete : isSuccess,
    error: isCircle ? (serverVault.error ? new Error(serverVault.error) : null) : error,
    hash: isCircle ? (serverVault.txHash as `0x${string}` | undefined) : hash,
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
    chainId: arcTestnet.id,
    query: {
      enabled: !!address && positionIndex !== undefined,
    },
  });

  return {
    yieldAmount: yieldAmount ? Number(formatUnits(yieldAmount as bigint, 6)) : 0,
  };
}
