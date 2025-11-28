import { useAccount } from 'wagmi';
import { useMemo, useEffect, useState, useRef } from 'react';
import { formatUnits, createPublicClient, http } from 'viem';
import { defineChain } from 'viem';
import { rpcRateLimiter } from '@/lib/rpcRateLimiter';

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

// ERC20 ABI for balanceOf and decimals
const ERC20_ABI = [
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

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
  const address = account?.address;
  const isConnected = account?.isConnected ?? false;
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
          transport: http('https://rpc.testnet.arc.network', {
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
          console.log(`[useTokenBalance] Fetching Native USDC balance using getBalance() for address ${address}`);
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
            console.log(`[useTokenBalance] Fetching decimals for token ${tokenAddress}...`);
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
            console.log(`[useTokenBalance] Token decimals from contract:`, tokenDecimals);
          } catch (decimalsErr: any) {
            console.warn(`[useTokenBalance] Failed to fetch decimals for ${tokenAddress}:`, decimalsErr);
            // Use provided decimals if available, otherwise default to 6
            if (providedDecimals) {
              tokenDecimals = providedDecimals;
              setDecimals(providedDecimals);
              console.log(`[useTokenBalance] Using provided decimals:`, providedDecimals);
            } else {
              console.warn(`[useTokenBalance] No provided decimals, using default 6`);
              tokenDecimals = 6;
              setDecimals(6);
            }
          }

          // Get balance with rate limiting
          console.log(`[useTokenBalance] Fetching balance for token ${tokenAddress} on Arc Testnet for address ${address}`);
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

        console.log(`[useTokenBalance] Balance result:`, result, `decimals:`, tokenDecimals);
        setBalance(result);
      } catch (err: any) {
        if (err?.name === 'AbortError' || abortController.signal.aborted) {
          return;
        }
        
        // Handle 429 (Too Many Requests) errors - rate limiter already handled it
        if (err?.status === 429 || err?.message?.includes('429') || err?.message?.includes('Too Many Requests')) {
          console.warn(`[useTokenBalance] Rate limited (429). Rate limiter will handle retry.`);
          setError(new Error('Rate limited. Please wait a moment.'));
          // Don't set balance to 0, keep previous value
          return;
        }
        
        console.error(`[useTokenBalance] Error fetching token balance for ${tokenAddress}:`, err);
        console.error(`[useTokenBalance] Error details:`, {
          message: err?.message,
          code: err?.code,
          name: err?.name,
          shortMessage: err?.shortMessage,
        });
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

