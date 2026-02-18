/**
 * useSwapPool - Hook for interacting with StablecoinSwap contract
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { formatEther, formatUnits, parseEther, parseUnits } from 'viem';
import { TREASURY_CONTRACTS } from '@/lib/constants';
import { arcTestnet } from '@/lib/wagmi';
import { toast } from 'sonner';
import { useExchangeRate } from './useExchangeRate';
import { trackTransaction, updateTransactionStatus, trackSiteSwap, trackSiteLiquidity } from '@/lib/trackTransaction';
import { useUnifiedWallet } from './useUnifiedWallet';
import { useCircleWallet } from '@/providers/CircleWalletProvider';
import { useServerVault } from './useServerVault';

// StablecoinSwap ABI (minimal)
const SWAP_ABI = [
  {
    inputs: [],
    name: 'getReserves',
    outputs: [
      { name: '_usdcReserve', type: 'uint256' },
      { name: 'eurcReserve', type: 'uint256' }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'exchangeRate',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ name: 'usdcIn', type: 'uint256' }],
    name: 'getEurcOut',
    outputs: [
      { name: 'eurcOut', type: 'uint256' },
      { name: 'fee', type: 'uint256' }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ name: 'eurcIn', type: 'uint256' }],
    name: 'getUsdcOut',
    outputs: [
      { name: 'usdcOut', type: 'uint256' },
      { name: 'fee', type: 'uint256' }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ name: 'minEurcOut', type: 'uint256' }],
    name: 'swapUsdcForEurc',
    outputs: [{ name: 'eurcOut', type: 'uint256' }],
    stateMutability: 'payable',
    type: 'function'
  },
  {
    inputs: [
      { name: 'eurcIn', type: 'uint256' },
      { name: 'minUsdcOut', type: 'uint256' }
    ],
    name: 'swapEurcForUsdc',
    outputs: [{ name: 'usdcOut', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      { name: 'eurcAmount', type: 'uint256' },
      { name: 'minLpTokens', type: 'uint256' }
    ],
    name: 'addLiquidity',
    outputs: [{ name: 'lpTokens', type: 'uint256' }],
    stateMutability: 'payable',
    type: 'function'
  },
  {
    inputs: [
      { name: 'lpTokens', type: 'uint256' },
      { name: 'minUsdcOut', type: 'uint256' },
      { name: 'minEurcOut', type: 'uint256' }
    ],
    name: 'removeLiquidity',
    outputs: [
      { name: 'usdcOut', type: 'uint256' },
      { name: 'eurcOut', type: 'uint256' }
    ],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [{ name: 'user', type: 'address' }],
    name: 'getUserShare',
    outputs: [
      { name: 'usdcShare', type: 'uint256' },
      { name: 'eurcShare', type: 'uint256' },
      { name: 'sharePercent', type: 'uint256' }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'totalSupply',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  }
] as const;

// EURC ABI (minimal)
const EURC_ABI = [
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' }
    ],
    name: 'allowance',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  }
] as const;

export interface PoolStats {
  usdcReserve: string;
  eurcReserve: string;
  totalLiquidityUsd: string;
  exchangeRate: number;
  userLpTokens: string;
  userUsdcShare: string;
  userEurcShare: string;
  userSharePercent: number;
}

export interface SwapTransaction {
  hash: string;
  status: 'pending' | 'success' | 'failed';
  type: 'swap' | 'approve' | 'addLiquidity' | 'removeLiquidity';
  fromToken: string;
  toToken: string;
  amountIn: string;
  amountOut: string;
  explorerUrl: string;
}

export function useSwapPool() {
  const account = useAccount();
  const unifiedWallet = useUnifiedWallet();
  const circleWallet = useCircleWallet();
  const serverVault = useServerVault();
  const address = account?.address || (unifiedWallet.address as `0x${string}` | undefined);
  const isConnected = (account?.isConnected ?? false) || unifiedWallet.isConnected;
  const isCircle = unifiedWallet.walletType === 'circle';
  const publicClient = usePublicClient({ chainId: arcTestnet.id });
  const { data: walletClient } = useWalletClient();
  const { eurToUsd: liveRate } = useExchangeRate();
  const liveRateRef = useRef(liveRate);
  liveRateRef.current = liveRate;

  const [poolStats, setPoolStats] = useState<PoolStats>({
    usdcReserve: '0',
    eurcReserve: '0',
    totalLiquidityUsd: '0',
    exchangeRate: 1.08,
    userLpTokens: '0',
    userUsdcShare: '0',
    userEurcShare: '0',
    userSharePercent: 0,
  });
  const [userEurcBalance, setUserEurcBalance] = useState('0');
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  const [lastSwap, setLastSwap] = useState<SwapTransaction | null>(null);

  const swapAddress = TREASURY_CONTRACTS.StablecoinSwap;
  const eurcAddress = TREASURY_CONTRACTS.SwapEURC;

  // Fetch pool stats
  const fetchPoolStats = useCallback(async () => {
    if (!publicClient) return;

    setIsRefreshing(true);
    try {
      const [reserves, rate, totalSupply] = await Promise.all([
        publicClient.readContract({
          address: swapAddress,
          abi: SWAP_ABI,
          functionName: 'getReserves',
        }),
        publicClient.readContract({
          address: swapAddress,
          abi: SWAP_ABI,
          functionName: 'exchangeRate',
        }),
        publicClient.readContract({
          address: swapAddress,
          abi: SWAP_ABI,
          functionName: 'totalSupply',
        }),
      ]);

      const [usdcReserve, eurcReserve] = reserves;
      const rateNum = Number(rate) / 1e6;

      // Calculate total liquidity in USD using live EUR/USD rate
      const usdcVal = Number(formatEther(usdcReserve));
      const eurcVal = Number(formatUnits(eurcReserve, 6)) * liveRateRef.current;
      const totalUsd = usdcVal + eurcVal;

      let userStats = {
        lpTokens: '0',
        usdcShare: '0',
        eurcShare: '0',
        sharePercent: 0,
      };

      if (address) {
        const [lpBalance, userShare, eurcBalance] = await Promise.all([
          publicClient.readContract({
            address: swapAddress,
            abi: SWAP_ABI,
            functionName: 'balanceOf',
            args: [address],
          }),
          publicClient.readContract({
            address: swapAddress,
            abi: SWAP_ABI,
            functionName: 'getUserShare',
            args: [address],
          }),
          publicClient.readContract({
            address: eurcAddress,
            abi: EURC_ABI,
            functionName: 'balanceOf',
            args: [address],
          }),
        ]);

        const [usdcShare, eurcShare, sharePercent] = userShare;

        userStats = {
          lpTokens: formatEther(lpBalance),
          usdcShare: formatEther(usdcShare),
          eurcShare: formatUnits(eurcShare, 6),
          sharePercent: Number(sharePercent) / 100, // Convert from basis points
        };

        setUserEurcBalance(formatUnits(eurcBalance, 6));
      }

      setPoolStats({
        usdcReserve: formatEther(usdcReserve),
        eurcReserve: formatUnits(eurcReserve, 6),
        totalLiquidityUsd: totalUsd.toFixed(2),
        exchangeRate: rateNum,
        userLpTokens: userStats.lpTokens,
        userUsdcShare: userStats.usdcShare,
        userEurcShare: userStats.eurcShare,
        userSharePercent: userStats.sharePercent,
      });
    } catch (error) {
      console.error('Failed to fetch pool stats:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [publicClient, address, swapAddress, eurcAddress]);

  // Get swap quote
  const getSwapQuote = useCallback(async (
    fromToken: 'USDC' | 'EURC',
    amount: string
  ): Promise<{ output: string; fee: string } | null> => {
    if (!publicClient || !amount || parseFloat(amount) <= 0) return null;

    try {
      if (fromToken === 'USDC') {
        const amountWei = parseEther(amount);
        const [eurcOut, fee] = await publicClient.readContract({
          address: swapAddress,
          abi: SWAP_ABI,
          functionName: 'getEurcOut',
          args: [amountWei],
        });
        return {
          output: formatUnits(eurcOut, 6),
          fee: formatUnits(fee, 6),
        };
      } else {
        const amountWei = parseUnits(amount, 6);
        const [usdcOut, fee] = await publicClient.readContract({
          address: swapAddress,
          abi: SWAP_ABI,
          functionName: 'getUsdcOut',
          args: [amountWei],
        });
        return {
          output: formatEther(usdcOut),
          fee: formatEther(fee),
        };
      }
    } catch (error) {
      console.error('Failed to get swap quote:', error);
      return null;
    }
  }, [publicClient, swapAddress]);

  // Swap USDC for EURC
  const swapUsdcForEurc = useCallback(async (
    amount: string,
    minOutput: string,
    slippagePercent: number = 0.5
  ) => {
    if (!isConnected || !address) {
      toast.error('Please connect wallet');
      return false;
    }

    setIsSwapping(true);
    setLastSwap(null);

    try {
      // BigInt slippage: avoid floating-point precision loss
      const outputUnits = parseUnits(minOutput, 6);
      const slippageBps = BigInt(Math.round(slippagePercent * 100));
      const minOutputWei = outputUnits - (outputUnits * slippageBps / 10000n);
      const minOutputAdjusted = formatUnits(minOutputWei, 6);

      // Circle wallet path — server-side execution
      if (isCircle) {
        const arcWalletId = circleWallet.arcWalletId;
        if (!arcWalletId) throw new Error('Arc wallet not found');
        const txHash = await serverVault.swapUsdcForEurc(arcWalletId, amount, minOutputAdjusted, address);
        if (!txHash) throw new Error('Swap failed');
        trackSiteSwap(txHash, address, parseFloat(amount), 'USDC', 'EURC');
        setLastSwap({
          hash: txHash,
          status: 'success',
          type: 'swap',
          fromToken: 'USDC',
          toToken: 'EURC',
          amountIn: amount,
          amountOut: minOutput,
          explorerUrl: `https://testnet.arcscan.app/tx/${txHash}`,
        });
        await fetchPoolStats();
        return true;
      }

      // External wallet path
      if (!walletClient) {
        toast.error('Please connect wallet');
        return false;
      }

      const amountWei = parseEther(amount);

      toast.info('Swapping USDC for EURC...');

      const hash = await walletClient.writeContract({
        address: swapAddress,
        abi: SWAP_ABI,
        functionName: 'swapUsdcForEurc',
        args: [minOutputWei],
        value: amountWei,
      });

      trackTransaction({ txHash: hash, txType: 'swap-usdc-eurc', walletAddress: address, amount, currency: 'USDC' });

      setLastSwap({
        hash,
        status: 'pending',
        type: 'swap',
        fromToken: 'USDC',
        toToken: 'EURC',
        amountIn: amount,
        amountOut: minOutput,
        explorerUrl: `https://testnet.arcscan.app/tx/${hash}`,
      });

      toast.info('Waiting for confirmation...');
      await publicClient?.waitForTransactionReceipt({ hash });

      updateTransactionStatus(hash, 'COMPLETE');
      trackSiteSwap(hash, address, parseFloat(amount), 'USDC', 'EURC');
      setLastSwap(prev => prev ? { ...prev, status: 'success' } : null);
      toast.success('Swap completed!');
      await fetchPoolStats();
      return true;
    } catch (error: any) {
      console.error('Swap failed:', error);
      setLastSwap(prev => prev ? { ...prev, status: 'failed' } : null);
      toast.error(error?.shortMessage || error?.message || 'Swap failed');
      return false;
    } finally {
      setIsSwapping(false);
    }
  }, [walletClient, address, publicClient, swapAddress, fetchPoolStats, isCircle, circleWallet.arcWalletId, serverVault, isConnected]);

  // Swap EURC for USDC
  const swapEurcForUsdc = useCallback(async (
    amount: string,
    minOutput: string,
    slippagePercent: number = 0.5
  ) => {
    if (!isConnected || !address) {
      toast.error('Please connect wallet');
      return false;
    }

    setIsSwapping(true);
    setLastSwap(null);

    try {
      // BigInt slippage: avoid floating-point precision loss
      const outputWei = parseEther(minOutput);
      const slippageBps = BigInt(Math.round(slippagePercent * 100));
      const minOutputWei = outputWei - (outputWei * slippageBps / 10000n);
      const minOutputAdjusted = formatEther(minOutputWei);

      // Circle wallet path — server-side execution (approve + swap handled on server)
      if (isCircle) {
        const arcWalletId = circleWallet.arcWalletId;
        if (!arcWalletId) throw new Error('Arc wallet not found');
        const txHash = await serverVault.swapEurcForUsdc(arcWalletId, amount, minOutputAdjusted, address);
        if (!txHash) throw new Error('Swap failed');
        trackSiteSwap(txHash, address, parseFloat(amount) * liveRateRef.current, 'EURC', 'USDC');
        setLastSwap({
          hash: txHash,
          status: 'success',
          type: 'swap',
          fromToken: 'EURC',
          toToken: 'USDC',
          amountIn: amount,
          amountOut: minOutput,
          explorerUrl: `https://testnet.arcscan.app/tx/${txHash}`,
        });
        await fetchPoolStats();
        return true;
      }

      // External wallet path
      if (!walletClient || !publicClient) {
        toast.error('Please connect wallet');
        return false;
      }

      const amountWei = parseUnits(amount, 6);

      // Check allowance
      const allowance = await publicClient.readContract({
        address: eurcAddress,
        abi: EURC_ABI,
        functionName: 'allowance',
        args: [address, swapAddress],
      });

      if (allowance < amountWei) {
        toast.info('Approving EURC...');
        const approveHash = await walletClient.writeContract({
          address: eurcAddress,
          abi: EURC_ABI,
          functionName: 'approve',
          args: [swapAddress, amountWei * 10n],
        });
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
      }

      toast.info('Swapping EURC for USDC...');

      const hash = await walletClient.writeContract({
        address: swapAddress,
        abi: SWAP_ABI,
        functionName: 'swapEurcForUsdc',
        args: [amountWei, minOutputWei],
      });

      trackTransaction({ txHash: hash, txType: 'swap-eurc-usdc', walletAddress: address, amount, currency: 'EURC' });

      setLastSwap({
        hash,
        status: 'pending',
        type: 'swap',
        fromToken: 'EURC',
        toToken: 'USDC',
        amountIn: amount,
        amountOut: minOutput,
        explorerUrl: `https://testnet.arcscan.app/tx/${hash}`,
      });

      toast.info('Waiting for confirmation...');
      await publicClient.waitForTransactionReceipt({ hash });

      updateTransactionStatus(hash, 'COMPLETE');
      trackSiteSwap(hash, address, parseFloat(amount) * liveRateRef.current, 'EURC', 'USDC');
      setLastSwap(prev => prev ? { ...prev, status: 'success' } : null);
      toast.success('Swap completed!');
      await fetchPoolStats();
      return true;
    } catch (error: any) {
      console.error('Swap failed:', error);
      setLastSwap(prev => prev ? { ...prev, status: 'failed' } : null);
      toast.error(error?.shortMessage || error?.message || 'Swap failed');
      return false;
    } finally {
      setIsSwapping(false);
    }
  }, [walletClient, address, publicClient, swapAddress, eurcAddress, fetchPoolStats, isCircle, circleWallet.arcWalletId, serverVault, isConnected]);

  // Add liquidity
  const addLiquidity = useCallback(async (
    usdcAmount: string,
    eurcAmount: string
  ) => {
    if (!isConnected || !address) {
      toast.error('Please connect wallet');
      return false;
    }

    setIsLoading(true);
    try {
      // Circle wallet path — server-side execution
      if (isCircle) {
        const arcWalletId = circleWallet.arcWalletId;
        if (!arcWalletId) throw new Error('Arc wallet not found');
        const txHash = await serverVault.addLiquidity(arcWalletId, usdcAmount, eurcAmount, address);
        if (!txHash) throw new Error('Add liquidity failed');
        trackSiteLiquidity(txHash, address, parseFloat(usdcAmount) + parseFloat(eurcAmount) * liveRateRef.current, 'add');
        setLastSwap({
          hash: txHash,
          status: 'success',
          type: 'addLiquidity',
          fromToken: 'USDC + EURC',
          toToken: 'LP',
          amountIn: `${usdcAmount} + ${eurcAmount}`,
          amountOut: '?',
          explorerUrl: `https://testnet.arcscan.app/tx/${txHash}`,
        });
        await fetchPoolStats();
        return true;
      }

      // External wallet path
      if (!walletClient || !publicClient) {
        toast.error('Please connect wallet');
        return false;
      }

      const usdcWei = parseEther(usdcAmount);
      const eurcWei = parseUnits(eurcAmount, 6);

      // Check EURC allowance
      const allowance = await publicClient.readContract({
        address: eurcAddress,
        abi: EURC_ABI,
        functionName: 'allowance',
        args: [address, swapAddress],
      });

      if (allowance < eurcWei) {
        toast.info('Approving EURC...');
        const approveHash = await walletClient.writeContract({
          address: eurcAddress,
          abi: EURC_ABI,
          functionName: 'approve',
          args: [swapAddress, eurcWei * 10n],
        });
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
      }

      toast.info('Adding liquidity...');

      const hash = await walletClient.writeContract({
        address: swapAddress,
        abi: SWAP_ABI,
        functionName: 'addLiquidity',
        args: [eurcWei, 0n],
        value: usdcWei,
      });

      trackTransaction({ txHash: hash, txType: 'add-liquidity', walletAddress: address, amount: usdcAmount, currency: 'USDC' });

      // Set pending transaction
      setLastSwap({
        hash,
        status: 'pending',
        type: 'addLiquidity',
        fromToken: 'USDC + EURC',
        toToken: 'LP',
        amountIn: `${usdcAmount} + ${eurcAmount}`,
        amountOut: '?',
        explorerUrl: `https://testnet.arcscan.app/tx/${hash}`,
      });

      toast.info('Waiting for confirmation...');
      await publicClient.waitForTransactionReceipt({ hash });

      updateTransactionStatus(hash, 'COMPLETE');
      trackSiteLiquidity(hash, address, parseFloat(usdcAmount) + parseFloat(eurcAmount) * liveRateRef.current, 'add');
      // Update to success
      setLastSwap(prev => prev ? { ...prev, status: 'success' } : null);
      toast.success('Liquidity added!');
      await fetchPoolStats();
      return true;
    } catch (error: any) {
      console.error('Add liquidity failed:', error);
      setLastSwap(prev => prev ? { ...prev, status: 'failed' } : null);
      toast.error(error?.shortMessage || 'Failed to add liquidity');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [walletClient, address, publicClient, swapAddress, eurcAddress, fetchPoolStats, isCircle, circleWallet.arcWalletId, serverVault, isConnected]);

  // Remove liquidity
  const removeLiquidity = useCallback(async (lpAmount: string) => {
    if (!isConnected || !address) {
      toast.error('Please connect wallet');
      return false;
    }

    setIsLoading(true);
    try {
      // Calculate min outputs with 1% slippage protection
      const userLp = parseFloat(poolStats.userLpTokens);
      const ratio = userLp > 0 ? Math.min(parseFloat(lpAmount) / userLp, 1.0) : 0;
      const expectedUsdc = parseFloat(poolStats.userUsdcShare) * ratio;
      const expectedEurc = parseFloat(poolStats.userEurcShare) * ratio;
      const minUsdcOut = parseEther((expectedUsdc * 0.99).toFixed(18));
      const minEurcOut = parseUnits((expectedEurc * 0.99).toFixed(6), 6);

      // Circle wallet path — server-side execution
      if (isCircle) {
        const arcWalletId = circleWallet.arcWalletId;
        if (!arcWalletId) throw new Error('Arc wallet not found');
        const txHash = await serverVault.removeLiquidity(arcWalletId, lpAmount, address);
        if (!txHash) throw new Error('Remove liquidity failed');
        trackSiteLiquidity(txHash, address, expectedUsdc + expectedEurc * liveRateRef.current, 'remove');
        setLastSwap({
          hash: txHash,
          status: 'success',
          type: 'removeLiquidity',
          fromToken: 'LP',
          toToken: 'USDC + EURC',
          amountIn: lpAmount,
          amountOut: '?',
          explorerUrl: `https://testnet.arcscan.app/tx/${txHash}`,
        });
        await fetchPoolStats();
        return true;
      }

      // External wallet path
      if (!walletClient || !publicClient) {
        toast.error('Please connect wallet');
        return false;
      }

      const lpWei = parseEther(lpAmount);

      toast.info('Removing liquidity...');

      const hash = await walletClient.writeContract({
        address: swapAddress,
        abi: SWAP_ABI,
        functionName: 'removeLiquidity',
        args: [lpWei, minUsdcOut, minEurcOut],
      });

      trackTransaction({ txHash: hash, txType: 'remove-liquidity', walletAddress: address, amount: lpAmount, currency: 'LP' });

      // Set pending transaction
      setLastSwap({
        hash,
        status: 'pending',
        type: 'removeLiquidity',
        fromToken: 'LP',
        toToken: 'USDC + EURC',
        amountIn: lpAmount,
        amountOut: '?',
        explorerUrl: `https://testnet.arcscan.app/tx/${hash}`,
      });

      toast.info('Waiting for confirmation...');
      await publicClient.waitForTransactionReceipt({ hash });

      updateTransactionStatus(hash, 'COMPLETE');
      trackSiteLiquidity(hash, address, expectedUsdc + expectedEurc * liveRateRef.current, 'remove');
      // Update to success
      setLastSwap(prev => prev ? { ...prev, status: 'success' } : null);
      toast.success('Liquidity removed!');
      await fetchPoolStats();
      return true;
    } catch (error: any) {
      console.error('Remove liquidity failed:', error);
      setLastSwap(prev => prev ? { ...prev, status: 'failed' } : null);
      toast.error(error?.shortMessage || 'Failed to remove liquidity');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [walletClient, address, publicClient, swapAddress, fetchPoolStats, isCircle, circleWallet.arcWalletId, serverVault, isConnected, poolStats.userLpTokens, poolStats.userUsdcShare, poolStats.userEurcShare]);

  // Fetch stats on mount and when address changes
  useEffect(() => {
    fetchPoolStats();
  }, [fetchPoolStats]);

  const clearLastSwap = useCallback(() => setLastSwap(null), []);

  return {
    poolStats,
    userEurcBalance,
    isLoading,
    isRefreshing,
    isSwapping,
    lastSwap,
    clearLastSwap,
    fetchPoolStats,
    getSwapQuote,
    swapUsdcForEurc,
    swapEurcForUsdc,
    addLiquidity,
    removeLiquidity,
  };
}
