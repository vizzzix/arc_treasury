import { useAccount } from 'wagmi';
import { useMemo, useEffect, useState, useRef } from 'react';
import { formatUnits, createPublicClient, http } from 'viem';
import { SUPPORTED_NETWORKS } from '@/lib/constants';
import { sepolia } from 'viem/chains';
import { defineChain } from 'viem';

// USDC contract addresses for different networks
const USDC_ADDRESSES: Record<string, `0x${string}`> = {
  // Testnet
  ethereumSepolia: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' as `0x${string}`, // USDC on Sepolia
  arcTestnet: '0x3600000000000000000000000000000000000000' as `0x${string}`, // USDC on Arc Testnet (native currency)
};

// ERC20 ABI for balanceOf
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

// Arc Testnet chain definition
const arcTestnet = defineChain({
  id: 5042002, // Correct Arc Testnet chain ID
  name: 'Arc Testnet',
  nativeCurrency: { name: 'Ethereum', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.testnet.arc.network'] }, // Correct RPC URL
  },
  blockExplorers: {
    default: { name: 'Arc Explorer', url: 'https://testnet.arcscan.app' },
  },
  testnet: true,
}) as const;

export const useUSDCBalance = (networkKey: keyof typeof SUPPORTED_NETWORKS) => {
  const account = useAccount();
  const address = account?.address;
  const isConnected = account?.isConnected ?? false;
  const network = SUPPORTED_NETWORKS[networkKey];
  const usdcAddress = USDC_ADDRESSES[networkKey];
  const [balance, setBalance] = useState<bigint | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const silentRefetchRef = useRef(false);

  // Function to manually refresh balance (silent = don't show loading state)
  const refetch = (silent = false) => {
    silentRefetchRef.current = silent;
    setRefreshKey(prev => prev + 1);
  };

  useEffect(() => {
    // For Arc Testnet, we don't need usdcAddress since USDC is native
    if (!isConnected || !address || !network) {
      console.log(`[useUSDCBalance] Skipping fetch:`, { isConnected, address, network: network?.name });
      setBalance(null);
      setIsLoading(false);
      return;
    }
    
    // For other networks, we need usdcAddress
    if (networkKey !== 'arcTestnet' && !usdcAddress) {
      console.log(`[useUSDCBalance] Skipping fetch: missing usdcAddress for ${network.name}`);
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
      // Only show loading state if not a silent refetch
      if (!silentRefetchRef.current) {
        setIsLoading(true);
      }
      setError(null);
      
      // Create new AbortController for this request
      const abortController = new AbortController();
      abortControllerRef.current = abortController;
      
      console.log(`[useUSDCBalance] Fetching balance for ${network.name}:`, {
        address,
        usdcAddress,
        chainId: network.chainId,
      });
      
      // Timeout wrapper function with abort support
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
        let publicClient;
        
        // Create appropriate public client for the chain
        switch (network.chainId) {
          case sepolia.id:
            // Use more reliable RPC endpoint
            publicClient = createPublicClient({ 
              chain: sepolia, 
              transport: http('https://ethereum-sepolia-rpc.publicnode.com', { 
                timeout: 5000,
                retryCount: 1,
              }) 
            });
            break;
          case arcTestnet.id:
            publicClient = createPublicClient({ 
              chain: arcTestnet, 
              transport: http('https://rpc.testnet.arc.network', {
                timeout: 5000,
                retryCount: 1,
              }) 
            });
            console.log(`[useUSDCBalance] Created Arc Testnet client with RPC: https://rpc.testnet.arc.network`);
            break;
          default:
            // Fallback for other chains
            publicClient = createPublicClient({
              chain: { id: network.chainId } as any,
              transport: http(undefined, {
                timeout: 5000,
                retryCount: 1,
              }),
            });
        }

        let result: bigint;
        
        // Arc Testnet uses USDC as native currency, not as ERC20 token
        if (networkKey === 'arcTestnet') {
          console.log(`[useUSDCBalance] Getting native USDC balance for Arc Testnet...`);
          result = await withTimeout(
            publicClient.getBalance({
              address: address as `0x${string}`,
            }),
            5000
          );
        } else {
          console.log(`[useUSDCBalance] Calling readContract for ${network.name}...`);
          
          // Try to read balance directly
          try {
            result = await withTimeout(
              publicClient.readContract({
                address: usdcAddress,
                abi: ERC20_ABI,
                functionName: 'balanceOf',
                args: [address as `0x${string}`],
              }) as Promise<bigint>,
              5000
            );
          } catch (contractErr: any) {
            // If balanceOf fails, return 0 balance
            console.warn(`[useUSDCBalance] readContract failed:`, contractErr);
            result = 0n;
            setError(new Error(`Unable to fetch balance: ${contractErr?.message || 'Contract read failed'}`));
          }
        }

        // Check if request was aborted
        if (abortController.signal.aborted) {
          console.log(`[useUSDCBalance] Request was aborted`);
          return;
        }

        console.log(`[useUSDCBalance] Balance result for ${network.name}:`, result);
        setBalance(result);
      } catch (err: any) {
        // Don't set error if request was aborted
        if (err?.name === 'AbortError' || abortController.signal.aborted) {
          console.log(`[useUSDCBalance] Request was aborted`);
          return;
        }
        
        // Handle 429 (Too Many Requests) errors - rate limiter already handled it
        if (err?.status === 429 || err?.message?.includes('429') || err?.message?.includes('Too Many Requests')) {
          console.warn(`[useUSDCBalance] Rate limited (429). Rate limiter will handle retry.`);
          setError(new Error('Rate limited. Please wait a moment.'));
          // Don't set balance to 0, keep previous value
          return;
        }
        
        console.error(`[useUSDCBalance] Error fetching USDC balance for ${network.name}:`, err);
        setError(err as Error);
        // Set balance to 0 instead of null to show "0.00" instead of "Loading..."
        setBalance(0n);
      } finally {
        // Clear timeout
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        // Always set loading to false when request completes (even if aborted)
        setIsLoading(false);
        // Reset silent refetch flag
        silentRefetchRef.current = false;
      }
    };

    fetchBalance();

    // Cleanup function
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
  }, [isConnected, address, networkKey, network, usdcAddress, refreshKey]);

  const formattedBalance = useMemo(() => {
    if (!isConnected) return '0.00';
    // Handle both null and 0n cases - always return formatted number, not "Loading..."
    if (balance === null || balance === undefined) {
      return '0.00';
    }
    try {
      // USDC decimals: 6 for most chains, but 18 for Arc Testnet
      const decimals = networkKey === 'arcTestnet' ? 18 : 6;
      return parseFloat(formatUnits(balance, decimals)).toFixed(2);
    } catch {
      return '0.00';
    }
  }, [balance, isConnected, networkKey]);

  return {
    balance: formattedBalance,
    rawBalance: balance,
    isLoading,
    error,
    hasBalance: parseFloat(formattedBalance) > 0,
    refetch,
  };
};

// Hook to get balances for all testnet networks
export const useAllUSDCBalances = () => {
  const account = useAccount();
  const address = account?.address;
  const isConnected = account?.isConnected ?? false;
  
  const testnetNetworks = useMemo(() => {
    return Object.entries(SUPPORTED_NETWORKS)
      .filter(([key, network]) => key !== 'arcTestnet' && network.isTestnet)
      .map(([key]) => key as keyof typeof SUPPORTED_NETWORKS);
  }, []);

  const balances: Record<string, { balance: string; isLoading: boolean; error: any }> = {};

  // We'll fetch balances using individual hooks in the component
  // This is a helper to get the list of networks
  return {
    networks: testnetNetworks,
    isConnected,
    address,
  };
};

