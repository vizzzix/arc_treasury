import { useEffect, useRef, useState } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useSendTransaction } from 'wagmi';
import { parseUnits, formatUnits, createPublicClient, http, encodeFunctionData } from 'viem';
import { TREASURY_CONTRACTS, TOKEN_ADDRESSES } from '@/lib/constants';
import TreasuryVaultABI from '@/lib/abis/TreasuryVault.json';
import { MULTICALL3_FROM_ADDRESS, buildCall3, encodeAggregate3 } from '@/lib/batchCall';
import { useUSYCPrice } from './useUSYCPrice';
import { arcTestnet, ARC_RPC_URL } from '@/lib/wagmi';
import { ERC20_ABI } from '@/lib/abis/erc20';
import { useUnifiedWallet } from './useUnifiedWallet';
import { trackTransaction, updateTransactionStatus } from '@/lib/trackTransaction';
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

const NATIVE_USDC = '0x3600000000000000000000000000000000000000';

export function calculateEarnedYield(amount: number, apyPercent: number, depositTime: Date, now: number = Date.now()): number {
  const timeElapsed = now - depositTime.getTime();
  const yearsElapsed = timeElapsed / (365 * 24 * 60 * 60 * 1000);
  return amount * (apyPercent / 100) * yearsElapsed;
}

export function mapLockedPosition(
  pos: LockedPosition,
  arrayIndex: number,
  baseAPY: number,
  now: number = Date.now()
): LockedPositionDisplay | null {
  if (pos.withdrawn) return null;

  const isNativeUSDC = pos.token === NATIVE_USDC;
  const tokenDecimals = isNativeUSDC ? 18 : 6;
  const amount = Number(formatUnits(pos.amount, tokenDecimals));

  const depositTime = new Date(Number(pos.depositTime) * 1000);
  const unlockTime = new Date(Number(pos.unlockTime) * 1000);
  const isUnlocked = now >= unlockTime.getTime();

  const currentAPY = baseAPY;
  const earnedYield = calculateEarnedYield(amount, currentAPY, depositTime, now);

  return {
    id: pos.id.toString(),
    arrayIndex,
    amount,
    token: isNativeUSDC ? 'USDC' : 'EURC',
    lockPeriodMonths: pos.lockPeriodMonths as 1 | 3 | 12,
    depositTime,
    unlockTime,
    currentAPY,
    earnedYield,
    isUnlocked,
  };
}

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

    const displayPositions: LockedPositionDisplay[] = rawPositions
      .map((pos: LockedPosition, arrayIndex: number) => mapLockedPosition(pos, arrayIndex, baseAPY))
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
  const { sendTransactionAsync } = useSendTransaction();

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

    if (address) trackTransaction({ txHash, txType: 'deposit-locked-usdc', walletAddress: address, amount, currency: 'USDC' });
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

    // Batch EURC approve + depositLockedEURC into one atomic tx via Multicall3From
    const approveCallData = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [TREASURY_CONTRACTS.TreasuryVault, amountWei],
    });
    const depositCallData = encodeFunctionData({
      abi: TreasuryVaultABI.abi,
      functionName: 'depositLockedEURC',
      args: [amountWei, lockPeriodMonths],
    });
    const batchData = encodeAggregate3([
      buildCall3(eurcAddress, approveCallData),
      buildCall3(TREASURY_CONTRACTS.TreasuryVault, depositCallData),
    ]);

    const txHash = await sendTransactionAsync({
      to: MULTICALL3_FROM_ADDRESS,
      data: batchData,
      chainId: arcTestnet.id,
    });

    if (address) trackTransaction({ txHash, txType: 'deposit-locked-eurc', walletAddress: address, amount, currency: 'EURC' });
    return txHash;
  };

  useEffect(() => {
    if (isSuccess && hash && !isCircle) {
      updateTransactionStatus(hash, 'COMPLETE');
    }
  }, [isSuccess, hash, isCircle]);

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
    if (unifiedWallet.address) trackTransaction({ txHash, txType: 'withdraw-locked', walletAddress: unifiedWallet.address });
    return txHash;
  };

  useEffect(() => {
    if (isSuccess && hash && !isCircle) {
      updateTransactionStatus(hash, 'COMPLETE');
    }
  }, [isSuccess, hash, isCircle]);

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
    if (unifiedWallet.address) trackTransaction({ txHash, txType: 'early-withdraw-locked', walletAddress: unifiedWallet.address });
    return txHash;
  };

  useEffect(() => {
    if (isSuccess && hash && !isCircle) {
      updateTransactionStatus(hash, 'COMPLETE');
    }
  }, [isSuccess, hash, isCircle]);

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

  useEffect(() => {
    if (hash && !isCircle && unifiedWallet.address) {
      trackTransaction({ txHash: hash, txType: 'claim-locked-yield', walletAddress: unifiedWallet.address });
    }
  }, [hash, isCircle, unifiedWallet.address]);

  useEffect(() => {
    if (isSuccess && hash && !isCircle) {
      updateTransactionStatus(hash, 'COMPLETE');
    }
  }, [isSuccess, hash, isCircle]);

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
