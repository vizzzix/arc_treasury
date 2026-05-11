import { useAccount } from 'wagmi';
import { useMemo, useEffect, useState, useRef } from 'react';
import { formatUnits, createPublicClient, http } from 'viem';
import { rpcRateLimiter } from '@/lib/rpcRateLimiter';
import { ERC20_ABI } from '@/lib/abis/erc20';
import { arcTestnet, ARC_RPC_URL } from '@/lib/wagmi';
import { useUnifiedWallet } from './useUnifiedWallet';

interface UseTokenBalanceParams {
  tokenAddress: `0x${string}`;
  decimals?: number; // Optional, will be fetched if not provided
  chainId?: number; // Optional, defaults to Arc Testnet
  refreshTrigger?: any; // Optional trigger to force refresh (e.g., transaction success)
}

/**
 * Hook to get ERC20 token balance for Arc Testnet
 * @param tokenAddress - ERC20 token contract address
 * @param decimals - Token decimals (optional, will be fetched if not provided)
 * @param chainId - Chain ID (optional, defaults to Arc Testnet 5042002)
 */
export const useTokenBalance = ({
  tokenAddress,
  decimals: providedDecimals,
  chainId = 5042002,
  refreshTrigger
}: UseTokenBalanceParams) => {
  const account = useAccount();
  const unifiedWallet = useUnifiedWallet();
  const address = account?.address || unifiedWallet.address;
  const isConnected = (account?.isConnected ?? false) || unifiedWallet.isConnected;
  const [balance, setBalance] = useState<bigint | null>(null);
  const [decimals, setDecimals] = useState<number | null>(providedDecimals || null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Skip if not connected, no address, or token address is zero
    if (!isConnected || !address || !tokenAddress || tokenAddress === '0x0000000000000000000000000000000000000000') {
      setBalance(null);
      setIsLoading(false);
      return;
    }

    // Cleanup previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    const fetchBalance = async () => {
      setIsLoading(true);
      setError(null);
      
      const abortController = new AbortController();
      abortControllerRef.current = abortController;
      
      // Timeout wrapper function
      const withTimeout = <T,>(promise: Promise<T>, timeoutMs: number = 5000): Promise<T> => {
        return Promise.race([
          promise,
          new Promise<T>((_, reject) => {
            const timeoutId = setTimeout(() => {
              abortController.abort();
              reject(new Error(`Request timeout after ${timeoutMs}ms`));
            }, timeoutMs);
            timeoutRef.current = timeoutId;
          }),
        ]);
      };
      
      try {
        const publicClient = createPublicClient({
          chain: arcTestnet,
          transport: http(ARC_RPC_URL, {
            timeout: 5000,
            retryCount: 1,
          })
        });

        // Native USDC on Arc Testnet uses msg.value (native currency)
        const isNativeUSDC = tokenAddress === '0x3600000000000000000000000000000000000000';

        let tokenDecimals = providedDecimals;
        let result: bigint;

        if (isNativeUSDC) {
          // For Native USDC, use eth_getBalance (returns wei with 18 decimals)
          tokenDecimals = 18; // Native balance is always in wei (18 decimals)
          setDecimals(18);

          result = await rpcRateLimiter.execute(() =>
            withTimeout(
              publicClient.getBalance({
                address: address as `0x${string}`,
              }),
              5000
            )
          );
        } else {
          // For regular ERC20 tokens, fetch decimals and use balanceOf
          try {
            const decimalsResult = await rpcRateLimiter.execute(() =>
              withTimeout(
                publicClient.readContract({
                  address: tokenAddress,
                  abi: ERC20_ABI,
                  functionName: 'decimals',
                }) as Promise<number>,
                5000
              )
            );
            tokenDecimals = decimalsResult;
            setDecimals(tokenDecimals);
          } catch (decimalsErr: any) {
            // Use provided decimals if available, otherwise default to 6
            if (providedDecimals) {
              tokenDecimals = providedDecimals;
              setDecimals(providedDecimals);
            } else {
              tokenDecimals = 6;
              setDecimals(6);
            }
          }

          // Get balance with rate limiting
          result = await rpcRateLimiter.execute(() =>
            withTimeout(
              publicClient.readContract({
                address: tokenAddress,
                abi: ERC20_ABI,
                functionName: 'balanceOf',
                args: [address as `0x${string}`],
              }) as Promise<bigint>,
              5000
            )
          );
        }

        if (abortController.signal.aborted) {
          return;
        }

        setBalance(result);
      } catch (err: any) {
        if (err?.name === 'AbortError' || abortController.signal.aborted) {
          return;
        }
        
        // Handle 429 (Too Many Requests) errors - rate limiter already handled it
        if (err?.status === 429 || err?.message?.includes('429') || err?.message?.includes('Too Many Requests')) {
          setError(new Error('Rate limited. Please wait a moment.'));
          // Don't set balance to 0, keep previous value
          return;
        }
        
        setError(err as Error);
        setBalance(0n);
      } finally {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        if (abortControllerRef.current === abortController) {
          setIsLoading(false);
        }
      }
    };

    fetchBalance();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      setIsLoading(false);
    };
  }, [isConnected, address, tokenAddress, providedDecimals, refreshTrigger]);

  const formattedBalance = useMemo(() => {
    if (!isConnected) return '0.00';
    if (balance === null || balance === undefined) {
      return '0.00';
    }
    try {
      const tokenDecimals = decimals || providedDecimals || 18;
      return parseFloat(formatUnits(balance, tokenDecimals)).toFixed(2);
    } catch {
      return '0.00';
    }
  }, [balance, isConnected, decimals, providedDecimals]);

  return {
    balance: formattedBalance,
    rawBalance: balance,
    isLoading,
    error,
    hasBalance: parseFloat(formattedBalance) > 0,
    decimals: decimals || providedDecimals || 18,
  };
};

