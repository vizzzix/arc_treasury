import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, usePublicClient } from 'wagmi';
import { useMemo, useRef, useEffect } from 'react';
import { formatUnits, parseUnits, maxUint256, createPublicClient, http } from 'viem';
import { TREASURY_CONTRACTS, TOKEN_ADDRESSES } from '@/lib/constants';
import { arcTestnet } from '@/lib/wagmi';

// ERC20 ABI for approve
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

// TreasuryVault ABI (simplified for main functions)
const TREASURY_VAULT_ABI = [
  {
    inputs: [],
    name: 'getTotalPoolValue',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'user', type: 'address' }],
    name: 'getUserShareValue',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getPricePerShare',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalShares',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalUSDC',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalUSYC',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: '', type: 'address' }],
    name: 'userShares',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'amount', type: 'uint256' }],
    name: 'deposit',
    outputs: [{ name: 'shares', type: 'uint256' }],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [{ name: 'sharesToWithdraw', type: 'uint256' }],
    name: 'withdraw',
    outputs: [{ name: 'usdcAmount', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'amount', type: 'uint256' }],
    name: 'depositEURC',
    outputs: [{ name: 'shares', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'sharesToWithdraw', type: 'uint256' }],
    name: 'withdrawEURC',
    outputs: [{ name: 'eurcAmount', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalEURC',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalEURCShares',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: '', type: 'address' }],
    name: 'userEURCShares',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getEURCPricePerShare',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

/**
 * Hook for interacting with TreasuryVault contract
 */
export const useTreasuryVault = () => {
  const account = useAccount();
  const address = account?.address;
  const isConnected = account?.isConnected ?? false;
  const chainId = account?.chainId;

  const publicClient = usePublicClient({ chainId: arcTestnet.id });
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
    chainId: arcTestnet.id,
    pollingInterval: 1000, // Poll every 1 second
    timeout: 120000, // 2 minute timeout
  });
  const refetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Check if connected to Arc Testnet
  const isArcTestnet = chainId === 5042002;

  // Read total pool value
  // Common query options to handle 429 errors
  // Auto-refresh with longer interval to avoid 429 errors
  const commonQueryOptions = {
    refetchInterval: 60000, // Auto-refresh every 60 seconds to avoid 429 errors
    staleTime: 0, // Always consider data stale - refetch on mount
    gcTime: 0, // Don't cache data - always fetch fresh (formerly cacheTime)
    refetchOnMount: true, // Always refetch on component mount
    refetchOnWindowFocus: true, // Refetch when window regains focus
    retry: (failureCount: number, error: any) => {
      // Don't retry on 429 errors
      if (error?.status === 429 || error?.message?.includes('429') || error?.message?.includes('Too Many Requests')) {
        return false;
      }
      // Only retry once for other errors
      return failureCount < 1;
    },
    retryDelay: 10000, // Wait 10 seconds before retry
  };

  const { data: totalPoolValue, refetch: refetchTotalValue } = useReadContract({
    address: TREASURY_CONTRACTS.TreasuryVault,
    abi: TREASURY_VAULT_ABI,
    functionName: 'getTotalPoolValue',
    chainId: arcTestnet.id,
    query: {
      enabled: isArcTestnet,
      ...commonQueryOptions,
    },
  });

  // Read price per share
  const { data: pricePerShare, refetch: refetchPricePerShare } = useReadContract({
    address: TREASURY_CONTRACTS.TreasuryVault,
    abi: TREASURY_VAULT_ABI,
    functionName: 'getPricePerShare',
    chainId: arcTestnet.id,
    query: {
      enabled: isArcTestnet,
      ...commonQueryOptions,
    },
  });

  // Read user shares
  const { data: userShares, refetch: refetchUserShares, error: userSharesError } = useReadContract({
    address: TREASURY_CONTRACTS.TreasuryVault,
    abi: TREASURY_VAULT_ABI,
    functionName: 'userShares',
    args: address ? [address] : undefined,
    chainId: arcTestnet.id,
    query: {
      enabled: isConnected && isArcTestnet && !!address,
      ...commonQueryOptions,
    },
  });

  // Read user share value
  const { data: userShareValue, refetch: refetchUserShareValue } = useReadContract({
    address: TREASURY_CONTRACTS.TreasuryVault,
    abi: TREASURY_VAULT_ABI,
    functionName: 'getUserShareValue',
    args: address ? [address] : undefined,
    chainId: arcTestnet.id,
    query: {
      enabled: isConnected && isArcTestnet && !!address,
      ...commonQueryOptions,
    },
  });

  // Read total shares
  const { data: totalShares } = useReadContract({
    address: TREASURY_CONTRACTS.TreasuryVault,
    abi: TREASURY_VAULT_ABI,
    functionName: 'totalShares',
    chainId: arcTestnet.id,
    query: {
      enabled: isArcTestnet,
      ...commonQueryOptions,
    },
  });

  // Read total USDC
  const { data: totalUSDC, refetch: refetchTotalUSDC, error: totalUSDCError } = useReadContract({
    address: TREASURY_CONTRACTS.TreasuryVault,
    abi: TREASURY_VAULT_ABI,
    functionName: 'totalUSDC',
    chainId: arcTestnet.id,
    query: {
      enabled: isArcTestnet,
      ...commonQueryOptions,
    },
  });

  // DEBUG: Log query results
  useEffect(() => {
    console.log('[useTreasuryVault] QUERY RESULTS:', {
      contract: TREASURY_CONTRACTS.TreasuryVault,
      chainId: arcTestnet.id,
      isArcTestnet,
      totalUSDC: totalUSDC?.toString(),
      totalUSDCError: totalUSDCError?.message,
      userShares: userShares?.toString(),
      userSharesError: userSharesError?.message,
      address,
      isConnected,
    });
  }, [totalUSDC, totalUSDCError, userShares, userSharesError, address, isConnected, isArcTestnet]);

  // Read total USYC
  const { data: totalUSYC, refetch: refetchTotalUSYC } = useReadContract({
    address: TREASURY_CONTRACTS.TreasuryVault,
    abi: TREASURY_VAULT_ABI,
    functionName: 'totalUSYC',
    chainId: arcTestnet.id,
    query: {
      enabled: isArcTestnet,
      ...commonQueryOptions,
    },
  });

  // Read total EURC
  const { data: totalEURC, refetch: refetchTotalEURC, error: totalEURCError } = useReadContract({
    address: TREASURY_CONTRACTS.TreasuryVault,
    abi: TREASURY_VAULT_ABI,
    functionName: 'totalEURC',
    chainId: arcTestnet.id,
    query: {
      enabled: isArcTestnet,
      ...commonQueryOptions,
    },
  });

  // Read EURC price per share
  const { data: eurcPricePerShare, refetch: refetchEURCPricePerShare } = useReadContract({
    address: TREASURY_CONTRACTS.TreasuryVault,
    abi: TREASURY_VAULT_ABI,
    functionName: 'getEURCPricePerShare',
    chainId: arcTestnet.id,
    query: {
      enabled: isArcTestnet,
      ...commonQueryOptions,
    },
  });

  // Read user EURC shares
  const { data: userEURCShares, refetch: refetchUserEURCShares } = useReadContract({
    address: TREASURY_CONTRACTS.TreasuryVault,
    abi: TREASURY_VAULT_ABI,
    functionName: 'userEURCShares',
    args: address ? [address] : undefined,
    chainId: arcTestnet.id,
    query: {
      enabled: isConnected && isArcTestnet && !!address,
      ...commonQueryOptions,
    },
  });

  // Formatted values
  const formattedTotalPoolValue = useMemo(() => {
    if (!totalPoolValue) return '0.00';
    return parseFloat(formatUnits(totalPoolValue, 6)).toFixed(2);
  }, [totalPoolValue]);

  const formattedPricePerShare = useMemo(() => {
    if (!pricePerShare) return '1.00';
    // Price per share uses PRECISION (1e18) in calculation, but returns value with 6 decimals
    // However, since totalUSDC is stored with 18 decimals, pricePerShare also has 18 decimals
    // Need to read with 18 decimals for native USDC
    return parseFloat(formatUnits(pricePerShare, 18)).toFixed(4);
  }, [pricePerShare]);

  const formattedUserShares = useMemo(() => {
    if (!userShares) return '0';
    // Shares are stored as raw bigint values matching the USDC amount (for first deposit 1:1)
    // Since totalUSDC is stored with 18 decimals, shares are also in 18 decimals format
    // For display, we need to divide by 1e18 to get the actual share count in USDC terms
    const sharesValue = parseFloat(formatUnits(userShares, 18));
    return sharesValue.toLocaleString('en-US', { maximumFractionDigits: 4 });
  }, [userShares]);

  const formattedUserShareValue = useMemo(() => {
    if (!userShareValue) return '0.00';
    // Contract returns getUserShareValue in 6 decimals (USDC format)
    // See TreasuryVault.sol line 217: return shareValue18 / 1e12;
    return parseFloat(formatUnits(userShareValue, 6)).toFixed(2);
  }, [userShareValue]);

  // EURC formatted values
  const formattedEURCPricePerShare = useMemo(() => {
    if (!eurcPricePerShare) return '1.00';
    // EURC price per share uses PRECISION (1e18) in calculation
    return parseFloat(formatUnits(eurcPricePerShare, 18)).toFixed(4);
  }, [eurcPricePerShare]);

  const formattedUserEURCShares = useMemo(() => {
    if (!userEURCShares) return '0';
    // EURC shares are stored with 18 decimals (PRECISION)
    const sharesValue = parseFloat(formatUnits(userEURCShares, 18));
    return sharesValue.toLocaleString('en-US', { maximumFractionDigits: 4 });
  }, [userEURCShares]);

  const formattedUserEURCShareValue = useMemo(() => {
    if (!userEURCShares || !eurcPricePerShare) return '0.00';
    // Calculate: shares * pricePerShare (both in 18 decimals)
    const sharesValue = parseFloat(formatUnits(userEURCShares, 18));
    const priceValue = parseFloat(formatUnits(eurcPricePerShare, 18));
    return (sharesValue * priceValue).toFixed(2);
  }, [userEURCShares, eurcPricePerShare]);

  // DEBUG: Log queries after mount
  useEffect(() => {
    console.log('[useTreasuryVault] Connection state:', {
      isConnected,
      chainId,
      isArcTestnet,
      address: address || 'not connected',
    });
    console.log('[useTreasuryVault] Query results:', {
      totalUSDC: totalUSDC?.toString() || 'undefined',
      totalEURC: totalEURC?.toString() || 'undefined',
      userShares: userShares?.toString() || 'undefined',
      userShareValue: userShareValue?.toString() || 'undefined',
      pricePerShare: pricePerShare?.toString() || 'undefined',
      formattedUserShareValue: formattedUserShareValue,
      formattedUserShares: formattedUserShares,
      formattedPricePerShare: formattedPricePerShare,
      totalUSDCError: totalUSDCError?.message || 'none',
      totalEURCError: totalEURCError?.message || 'none',
      userSharesError: userSharesError?.message || 'none',
    });
  }, [isConnected, chainId, isArcTestnet, address, totalUSDC, totalEURC, userShares, userShareValue, pricePerShare, formattedUserShareValue, formattedUserShares, formattedPricePerShare, totalUSDCError, totalEURCError, userSharesError]);

  // Check USDC allowance
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: TOKEN_ADDRESSES.arcTestnet.USDC,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address && isArcTestnet ? [address, TREASURY_CONTRACTS.TreasuryVault] : undefined,
    chainId: arcTestnet.id,
    query: {
      enabled: isConnected && isArcTestnet && !!address,
      ...commonQueryOptions,
    },
  });

  // Separate hooks for approve transactions
  const { writeContractAsync: writeApproveAsync } = useWriteContract();

  // Check EURC allowance
  const { data: eurcAllowance, refetch: refetchEURCAllowance } = useReadContract({
    address: TOKEN_ADDRESSES.arcTestnet.EURC,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address && isArcTestnet ? [address, TREASURY_CONTRACTS.TreasuryVault] : undefined,
    chainId: arcTestnet.id,
    query: {
      enabled: isConnected && isArcTestnet && !!address,
      ...commonQueryOptions,
    },
  });

  // Deposit function
  const deposit = async (amount: string, currency: "USDC" | "EURC" = "USDC") => {
    if (!isConnected || !address || !isArcTestnet) {
      throw new Error('Please connect your wallet to Arc Testnet');
    }

    // Get public client from hook or create fallback
    const client = publicClient || createPublicClient({
      chain: arcTestnet,
      transport: http('https://rpc.testnet.arc.network'),
    });

    if (!client) {
      throw new Error('Public client not available');
    }

    if (currency === "EURC") {
      // Handle EURC deposit
      const eurcAddress = TOKEN_ADDRESSES.arcTestnet.EURC;
      const amountWei = parseUnits(amount, 6); // EURC uses 6 decimals
      
      // Check EURC allowance
      const currentEURCAllowance = eurcAllowance || 0n;
      
      if (currentEURCAllowance < amountWei) {
        // Approve first using writeContractAsync
        if (!writeApproveAsync) {
          throw new Error('Approve function not available');
        }
        
        const approveHash = await writeApproveAsync({
          address: eurcAddress,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [TREASURY_CONTRACTS.TreasuryVault, maxUint256],
          chainId: arcTestnet.id,
        });
        
        // Wait for approval confirmation
        await client.waitForTransactionReceipt({
          hash: approveHash,
          timeout: 120000, // 2 minutes timeout
        });
        
        // Refetch allowance to ensure it's updated
        await refetchEURCAllowance();
      }

      // Deposit EURC - use writeContractAsync if available, otherwise use writeContract
      let depositHash: `0x${string}`;
      if (writeApproveAsync && typeof (writeApproveAsync as any).writeContractAsync === 'function') {
        depositHash = await (writeApproveAsync as any).writeContractAsync({
          address: TREASURY_CONTRACTS.TreasuryVault,
          abi: TREASURY_VAULT_ABI,
          functionName: 'depositEURC',
          args: [amountWei],
          chainId: arcTestnet.id,
        });
      } else {
        // Fallback: use writeContract and return the hash from the hook state
        writeContract({
          address: TREASURY_CONTRACTS.TreasuryVault,
          abi: TREASURY_VAULT_ABI,
          functionName: 'depositEURC',
          args: [amountWei],
          chainId: arcTestnet.id,
        });
        // Note: hash will be available through the hook's data property
        return undefined as any; // Will be handled by hook state
      }
      
      return depositHash;
    }

    // Handle USDC deposit
    // Check if USDC is native currency (Arc Testnet)
    const usdcAddress = TOKEN_ADDRESSES.arcTestnet.USDC;
    const isNative = usdcAddress === '0x3600000000000000000000000000000000000000';
    
    // IMPORTANT: For native USDC on Arc Testnet, contract stores totalUSDC with 18 decimals
    // Contract requires msg.value == amount, so both should be in 18 decimals for native USDC
    const amountWei = isNative 
      ? parseUnits(amount, 18) // Native USDC uses 18 decimals
      : parseUnits(amount, 6);  // ERC20 USDC uses 6 decimals
    
    // For ERC20 USDC, check and approve if needed
    if (!isNative) {
      const currentAllowance = allowance || 0n;
      
      if (currentAllowance < amountWei) {
        // Approve first using writeContractAsync
        if (!writeApproveAsync) {
          throw new Error('Approve function not available');
        }
        
        const approveHash = await writeApproveAsync({
          address: usdcAddress,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [TREASURY_CONTRACTS.TreasuryVault, maxUint256],
          chainId: arcTestnet.id,
        });
        
        // Wait for approval confirmation
        await client.waitForTransactionReceipt({
          hash: approveHash,
          timeout: 120000, // 2 minutes timeout
        });
        
        // Refetch allowance to ensure it's updated
        await refetchAllowance();
      }
    }

    // Deposit - use writeContractAsync if available, otherwise use writeContract
    let depositHash: `0x${string}`;
    if (writeApproveAsync && typeof (writeApproveAsync as any).writeContractAsync === 'function') {
      depositHash = await (writeApproveAsync as any).writeContractAsync({
        address: TREASURY_CONTRACTS.TreasuryVault,
        abi: TREASURY_VAULT_ABI,
        functionName: 'deposit',
        args: [amountWei], // 18 decimals for native, 6 decimals for ERC20
        value: isNative ? amountWei : undefined, // Must equal amount for native USDC
        chainId: arcTestnet.id,
      });
    } else {
      // Fallback: use writeContract and return the hash from the hook state
      writeContract({
        address: TREASURY_CONTRACTS.TreasuryVault,
        abi: TREASURY_VAULT_ABI,
        functionName: 'deposit',
        args: [amountWei], // 18 decimals for native, 6 decimals for ERC20
        value: isNative ? amountWei : undefined, // Must equal amount for native USDC
        chainId: arcTestnet.id,
      });
      // Note: hash will be available through the hook's data property
      return undefined as any; // Will be handled by hook state
    }
    
    return depositHash;
  };

  // Withdraw function
  const withdraw = async (shares: string, currency: "USDC" | "EURC" = "USDC") => {
    if (!isConnected || !address || !isArcTestnet) {
      throw new Error('Please connect your wallet to Arc Testnet');
    }

    // Shares are stored as raw bigint values in the contract with 18 decimals (PRECISION)
    // The input shares string is formatted for display (e.g., "2.0" for 2e18)
    // We need to convert it back to bigint with 18 decimals
    const sharesBigInt = parseUnits(shares, 18);
    
    console.log('[withdraw] Input shares string:', shares);
    console.log('[withdraw] Currency:', currency);
    console.log('[withdraw] Shares bigint:', sharesBigInt.toString());

    if (currency === "EURC") {
      writeContract({
        address: TREASURY_CONTRACTS.TreasuryVault,
        abi: TREASURY_VAULT_ABI,
        functionName: 'withdrawEURC',
        args: [sharesBigInt],
        chainId: arcTestnet.id,
      });
    } else {
      writeContract({
        address: TREASURY_CONTRACTS.TreasuryVault,
        abi: TREASURY_VAULT_ABI,
        functionName: 'withdraw',
        args: [sharesBigInt],
        chainId: arcTestnet.id,
      });
    }
  };

  // Refetch all data with debouncing to avoid rate limiting
  const refetchAll = () => {
    // Clear any pending refetch
    if (refetchTimeoutRef.current) {
      clearTimeout(refetchTimeoutRef.current);
    }
    
    // Debounce refetch calls to avoid rate limiting
    // Increased delay to prevent 429 errors
    refetchTimeoutRef.current = setTimeout(() => {
      // Stagger the refetch calls to avoid overwhelming the RPC
      // Increased delays between each call to prevent rate limiting
      refetchTotalValue();
      refetchTotalUSDC(); // Add refetch for totalUSDC
      refetchTotalUSYC(); // Add refetch for totalUSYC
      setTimeout(() => refetchPricePerShare(), 500);
      setTimeout(() => refetchUserShares(), 1000);
      setTimeout(() => refetchUserShareValue(), 1500);
      if (refetchTotalEURC) {
        setTimeout(() => refetchTotalEURC(), 2000);
      }
      if (refetchEURCPricePerShare) {
        setTimeout(() => refetchEURCPricePerShare(), 2500);
      }
      if (refetchUserEURCShares) {
        setTimeout(() => refetchUserEURCShares(), 3000);
      }
      refetchTimeoutRef.current = null;
    }, 2000); // Reduced to 2 seconds for faster update
  };

  return {
    // Read data
    totalPoolValue: formattedTotalPoolValue,
    pricePerShare: formattedPricePerShare,
    userShares: formattedUserShares,
    userShareValue: formattedUserShareValue,
    totalShares: totalShares?.toString() || '0',
    // For native USDC on Arc Testnet, totalUSDC is stored with 18 decimals (native currency)
    // But contract was designed for 6 decimals. Need to check actual storage format
    // For now, try reading with 18 decimals for native USDC
    totalUSDC: totalUSDC ? formatUnits(totalUSDC, 18) : '0', // Use 18 decimals for native USDC
    totalEURC: totalEURC ? formatUnits(totalEURC, 6) : '0', // EURC uses 6 decimals
    totalUSYC: totalUSYC ? formatUnits(totalUSYC, 6) : '0',
    
    // EURC data
    eurcPricePerShare: formattedEURCPricePerShare,
    userEURCShares: formattedUserEURCShares,
    userEURCShareValue: formattedUserEURCShareValue,
    
    // Write functions
    deposit,
    withdraw,
    
    // Transaction state
    isPending,
    isConfirming,
    isConfirmed,
    hash,
    error,
    reset,

    // Utils
    refetchAll,
    isArcTestnet,
  };
};


