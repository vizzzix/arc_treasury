/**
 * useSwapPool - Hook for interacting with StablecoinSwap contract
 */

import { useState, useEffect, useCallback } from 'react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { formatEther, formatUnits, parseEther, parseUnits } from 'viem';
import { TREASURY_CONTRACTS } from '@/lib/constants';
import { toast } from 'sonner';
import { useExchangeRate } from './useExchangeRate';

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
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { eurToUsd: liveRate } = useExchangeRate();

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
      const eurcVal = Number(formatUnits(eurcReserve, 6)) * liveRate; // Use live rate from Fixer.io
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
  }, [publicClient, address, swapAddress, eurcAddress, liveRate]);

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
    if (!walletClient || !address) {
      toast.error('Please connect wallet');
      return false;
    }

    setIsSwapping(true);
    setLastSwap(null);

    try {
      const amountWei = parseEther(amount);
      const minOutputWei = parseUnits(
        (parseFloat(minOutput) * (1 - slippagePercent / 100)).toFixed(6),
        6
      );

      toast.info('Swapping USDC for EURC...');

      const hash = await walletClient.writeContract({
        address: swapAddress,
        abi: SWAP_ABI,
        functionName: 'swapUsdcForEurc',
        args: [minOutputWei],
        value: amountWei,
      });

      // Set pending transaction
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

      // Update to success
      setLastSwap(prev => prev ? { ...prev, status: 'success' } : null);
      toast.success('Swap completed!');
      await fetchPoolStats();
      return true;
    } catch (error: any) {
      console.error('Swap failed:', error);
      setLastSwap(prev => prev ? { ...prev, status: 'failed' } : null);
      toast.error(error?.shortMessage || 'Swap failed');
      return false;
    } finally {
      setIsSwapping(false);
    }
  }, [walletClient, address, publicClient, swapAddress, fetchPoolStats]);

  // Swap EURC for USDC
  const swapEurcForUsdc = useCallback(async (
    amount: string,
    minOutput: string,
    slippagePercent: number = 0.5
  ) => {
    if (!walletClient || !address || !publicClient) {
      toast.error('Please connect wallet');
      return false;
    }

    setIsSwapping(true);
    setLastSwap(null);

    try {
      const amountWei = parseUnits(amount, 6);
      const minOutputWei = parseEther(
        (parseFloat(minOutput) * (1 - slippagePercent / 100)).toFixed(18)
      );

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
          args: [swapAddress, amountWei],
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

      // Set pending transaction
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

      // Update to success
      setLastSwap(prev => prev ? { ...prev, status: 'success' } : null);
      toast.success('Swap completed!');
      await fetchPoolStats();
      return true;
    } catch (error: any) {
      console.error('Swap failed:', error);
      setLastSwap(prev => prev ? { ...prev, status: 'failed' } : null);
      toast.error(error?.shortMessage || 'Swap failed');
      return false;
    } finally {
      setIsSwapping(false);
    }
  }, [walletClient, address, publicClient, swapAddress, eurcAddress, fetchPoolStats]);

  // Add liquidity
  const addLiquidity = useCallback(async (
    usdcAmount: string,
    eurcAmount: string
  ) => {
    if (!walletClient || !address || !publicClient) {
      toast.error('Please connect wallet');
      return false;
    }

    setIsLoading(true);
    try {
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
          args: [swapAddress, eurcWei],
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
  }, [walletClient, address, publicClient, swapAddress, eurcAddress, fetchPoolStats]);

  // Remove liquidity
  const removeLiquidity = useCallback(async (lpAmount: string) => {
    if (!walletClient || !address || !publicClient) {
      toast.error('Please connect wallet');
      return false;
    }

    setIsLoading(true);
    try {
      const lpWei = parseEther(lpAmount);

      toast.info('Removing liquidity...');

      const hash = await walletClient.writeContract({
        address: swapAddress,
        abi: SWAP_ABI,
        functionName: 'removeLiquidity',
        args: [lpWei, 0n, 0n],
      });

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
  }, [walletClient, address, publicClient, swapAddress, fetchPoolStats]);

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
