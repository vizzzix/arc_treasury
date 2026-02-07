import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, usePublicClient } from 'wagmi';
import { useMemo, useRef, useEffect } from 'react';
import { useUnifiedWallet } from './useUnifiedWallet';
import { useCircleWallet } from '@/providers/CircleWalletProvider';
import { useServerVault } from './useServerVault';
import { formatUnits, parseUnits, maxUint256, createPublicClient, http } from 'viem';
import { TREASURY_CONTRACTS, TOKEN_ADDRESSES } from '@/lib/constants';
import { arcTestnet } from '@/lib/wagmi';
import { ERC20_ABI } from '@/lib/abis/erc20';

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
    inputs: [{ name: '', type: 'address' }],
    name: 'userInfo',
    outputs: [
      { name: 'permanentPoints', type: 'uint256' },
      { name: 'lastPointsUpdate', type: 'uint256' },
      { name: 'totalDeposited', type: 'uint256' },
      { name: 'referrer', type: 'address' },
      { name: 'referralPoints', type: 'uint256' },
    ],
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
    inputs: [],
    name: 'eurc',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
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
] as const;

/**
 * Hook for interacting with TreasuryVault contract
 */
export const useTreasuryVault = () => {
  const account = useAccount();
  const unifiedWallet = useUnifiedWallet();
  const circleWallet = useCircleWallet();
  const serverVault = useServerVault();
  const address = account?.address || (unifiedWallet.address as `0x${string}` | undefined);
  const isConnected = (account?.isConnected ?? false) || unifiedWallet.isConnected;
  const isCircle = unifiedWallet.walletType === 'circle';
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

  // Check if connected to Arc Testnet (Circle wallets are always on Arc)
  const isArcTestnet = isCircle || chainId === 5042002;

  // Read total pool value
  // Common query options to handle 429 errors
  // Auto-refresh with longer interval to avoid 429 errors
  const commonQueryOptions = {
    refetchInterval: 60000, // Auto-refresh every 60 seconds
    staleTime: 30000, // Data considered fresh for 30s (avoids redundant refetches)
    gcTime: 300000, // Keep cache for 5 minutes (instant back-navigation)
    refetchOnMount: true,
    refetchOnWindowFocus: false, // Avoid burst refetches on tab switch
    retry: (failureCount: number, error: any) => {
      if (error?.status === 429 || error?.message?.includes('429') || error?.message?.includes('Too Many Requests')) {
        return false;
      }
      return failureCount < 1;
    },
    retryDelay: 10000,
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

  // Read total EURC shares (needed for calculating EURC price per share)
  const { data: totalEURCShares, refetch: refetchTotalEURCShares } = useReadContract({
    address: TREASURY_CONTRACTS.TreasuryVault,
    abi: TREASURY_VAULT_ABI,
    functionName: 'totalEURCShares',
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

  // Read user info (for totalDeposited to calculate flexible yield)
  const { data: userInfoData, refetch: refetchUserInfo } = useReadContract({
    address: TREASURY_CONTRACTS.TreasuryVault,
    abi: TREASURY_VAULT_ABI,
    functionName: 'userInfo',
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
    // Use floor rounding to avoid withdrawing more shares than available
    // toFixed() uses standard rounding which can round UP, causing "Insufficient shares" errors
    const floored = Math.floor(sharesValue * 1e6) / 1e6;
    return floored.toFixed(6);
  }, [userShares]);

  const formattedUserShareValue = useMemo(() => {
    if (!userShareValue) return '0.00';
    // Contract returns getUserShareValue in 6 decimals (USDC format)
    // See TreasuryVault.sol line 217: return shareValue18 / 1e12;
    return parseFloat(formatUnits(userShareValue, 6)).toFixed(2);
  }, [userShareValue]);

  // EURC formatted values
  // Calculate EURC price per share from totalEURC / totalEURCShares
  // Contract formula: pricePerShare = (totalEURC * 1e12 * PRECISION) / totalEURCShares
  const formattedEURCPricePerShare = useMemo(() => {
    if (!totalEURC || !totalEURCShares || totalEURCShares === 0n) return '1.00';
    // totalEURC is 6 decimals, totalEURCShares is 18 decimals
    // Price = (totalEURC * 1e12 * 1e18) / totalEURCShares - result in 18 decimals
    const price = (totalEURC * BigInt(1e12) * BigInt(1e18)) / totalEURCShares;
    return parseFloat(formatUnits(price, 18)).toFixed(4);
  }, [totalEURC, totalEURCShares]);

  const formattedUserEURCShares = useMemo(() => {
    if (!userEURCShares) return '0';
    // EURC shares are stored with 18 decimals (PRECISION)
    const sharesValue = parseFloat(formatUnits(userEURCShares, 18));
    // Use floor rounding to avoid withdrawing more shares than available
    const floored = Math.floor(sharesValue * 1e6) / 1e6;
    return floored.toFixed(6);
  }, [userEURCShares]);

  const formattedUserEURCShareValue = useMemo(() => {
    if (!userEURCShares || !totalEURC || !totalEURCShares || totalEURCShares === 0n) return '0.00';
    // Calculate: (userShares * totalEURC) / totalShares
    // userShares in 18 decimals, totalEURC in 6 decimals, totalShares in 18 decimals
    // Result is in 6 decimals (EURC)
    const value = (userEURCShares * totalEURC) / totalEURCShares;
    return parseFloat(formatUnits(value, 6)).toFixed(2);
  }, [userEURCShares, totalEURC, totalEURCShares]);

  // Calculate flexible yield from totalDeposited vs current share value
  // userInfoData: [permanentPoints, lastPointsUpdate, totalDeposited, referrer, referralPoints]
  const flexibleYield = useMemo(() => {
    if (!userInfoData || !userShareValue) return 0;
    // totalDeposited is stored in 6 decimals in the contract
    const totalDeposited = userInfoData[2] as bigint;
    const depositedNum = parseFloat(formatUnits(totalDeposited, 6));
    // userShareValue is already in 6 decimals from getUserShareValue
    const currentValue = parseFloat(formatUnits(userShareValue, 6));
    // Yield = current value - total deposited (can be negative if withdrawn more than deposited)
    const yield_ = currentValue - depositedNum;
    return yield_ > 0 ? yield_ : 0;
  }, [userInfoData, userShareValue]);


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

  // Separate hooks for approve transactions - use writeContractAsync for proper error handling
  const { writeContractAsync } = useWriteContract();

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

    // Circle wallet path — server-side execution
    if (isCircle) {
      const arcWalletId = circleWallet.arcWalletId;
      if (!arcWalletId) throw new Error('Arc wallet not found');
      const txHash = await serverVault.deposit(arcWalletId, amount, currency, address);
      if (!txHash) throw new Error('Deposit failed');
      // Refetch after short delay
      setTimeout(() => refetchAll(), 3000);
      return txHash as `0x${string}`;
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
      // Read the vault's actual EURC address (may differ from TOKEN_ADDRESSES)
      let eurcAddress: `0x${string}`;
      try {
        const vaultEurc = await client.readContract({
          address: TREASURY_CONTRACTS.TreasuryVault,
          abi: TREASURY_VAULT_ABI,
          functionName: 'eurc',
        }) as `0x${string}`;
        eurcAddress = vaultEurc;
        } catch {
        eurcAddress = TOKEN_ADDRESSES.arcTestnet.EURC;
        }
      const amountWei = parseUnits(amount, 6); // EURC uses 6 decimals

      // Check EURC allowance on the vault's actual EURC token
      const currentEURCAllowance = await client.readContract({
        address: eurcAddress,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [address, TREASURY_CONTRACTS.TreasuryVault],
      }) as bigint;

      if (currentEURCAllowance < amountWei) {
        // Approve first using writeContractAsync
        if (!writeContractAsync) {
          throw new Error('Approve function not available');
        }

        const approveHash = await writeContractAsync({
          address: eurcAddress,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [TREASURY_CONTRACTS.TreasuryVault, amountWei * 10n],
          chainId: arcTestnet.id,
        });

        // Wait for approval confirmation and check status
        const approveReceipt = await client.waitForTransactionReceipt({
          hash: approveHash,
          timeout: 120000, // 2 minutes timeout
        });

        if (approveReceipt.status === 'reverted') {
          throw new Error('EURC approval failed');
        }

        // Refetch allowance to ensure it's updated
        await refetchEURCAllowance();
      }

      // Deposit EURC using writeContractAsync - throws error if user rejects
      if (!writeContractAsync) {
        throw new Error('Write function not available');
      }

      const depositHash = await writeContractAsync({
        address: TREASURY_CONTRACTS.TreasuryVault,
        abi: TREASURY_VAULT_ABI,
        functionName: 'depositEURC',
        args: [amountWei],
        chainId: arcTestnet.id,
      });

      const receipt = await client.waitForTransactionReceipt({
        hash: depositHash,
        timeout: 120000,
      });

      if (receipt.status === 'reverted') {
        throw new Error('Transaction failed on blockchain');
      }

      // Trigger immediate refetch of balances after confirmed transaction

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
        if (!writeContractAsync) {
          throw new Error('Approve function not available');
        }

        const approveHash = await writeContractAsync({
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

    // Deposit using writeContractAsync - throws error if user rejects
    if (!writeContractAsync) {
      throw new Error('Write function not available');
    }

    const depositHash = await writeContractAsync({
      address: TREASURY_CONTRACTS.TreasuryVault,
      abi: TREASURY_VAULT_ABI,
      functionName: 'deposit',
      args: [amountWei], // 18 decimals for native, 6 decimals for ERC20
      value: isNative ? amountWei : undefined, // Must equal amount for native USDC
      chainId: arcTestnet.id,
    });

    // Wait for transaction receipt and check status
    const receipt = await client.waitForTransactionReceipt({
      hash: depositHash,
      timeout: 120000,
    });

    if (receipt.status === 'reverted') {
      throw new Error('Transaction failed on blockchain');
    }

    return depositHash;
  };

  // Withdraw function - accepts string (formatted) or bigint (raw) shares
  const withdraw = async (shares: string | bigint, currency: "USDC" | "EURC" = "USDC"): Promise<`0x${string}`> => {
    if (!isConnected || !address || !isArcTestnet) {
      throw new Error('Please connect your wallet to Arc Testnet');
    }

    // Circle wallet path — server-side execution
    if (isCircle) {
      const arcWalletId = circleWallet.arcWalletId;
      if (!arcWalletId) throw new Error('Arc wallet not found');
      // Convert shares to raw string (18 decimals)
      const sharesStr = typeof shares === 'bigint' ? shares.toString() : parseUnits(shares, 18).toString();
      const txHash = await serverVault.withdraw(arcWalletId, sharesStr, currency, address);
      if (!txHash) throw new Error('Withdraw failed');
      setTimeout(() => refetchAll(), 3000);
      return txHash as `0x${string}`;
    }

    if (!writeContractAsync) {
      throw new Error('Write function not available');
    }

    // Get public client from hook or create fallback
    const client = publicClient || createPublicClient({
      chain: arcTestnet,
      transport: http('https://rpc.testnet.arc.network'),
    });

    // Accept either string (formatted) or bigint (raw) shares
    // If bigint is passed, use it directly for precision with small amounts
    // If string is passed, convert to bigint with 18 decimals
    const sharesBigInt = typeof shares === 'bigint' ? shares : parseUnits(shares, 18);



    // Validate shares > 0
    if (sharesBigInt === 0n) {
      throw new Error('Cannot withdraw 0 shares');
    }

    let txHash: `0x${string}`;

    if (currency === "EURC") {
      txHash = await writeContractAsync({
        address: TREASURY_CONTRACTS.TreasuryVault,
        abi: TREASURY_VAULT_ABI,
        functionName: 'withdrawEURC',
        args: [sharesBigInt],
        chainId: arcTestnet.id,
      });
    } else {
      txHash = await writeContractAsync({
        address: TREASURY_CONTRACTS.TreasuryVault,
        abi: TREASURY_VAULT_ABI,
        functionName: 'withdraw',
        args: [sharesBigInt],
        chainId: arcTestnet.id,
      });
    }

    // Wait for transaction receipt and check status
    if (!client) {
      throw new Error('Public client not available');
    }

    const receipt = await client.waitForTransactionReceipt({
      hash: txHash,
      timeout: 120000,
    });

    if (receipt.status === 'reverted') {
      throw new Error('Transaction failed on blockchain');
    }

    return txHash;
  };

  // Refetch all data with debouncing to avoid rate limiting
  const refetchAll = () => {
    // Clear any pending refetch
    if (refetchTimeoutRef.current) {
      clearTimeout(refetchTimeoutRef.current);
    }

    // Start refetch immediately, stagger subsequent calls to avoid rate limiting
    refetchTimeoutRef.current = setTimeout(() => {
      // Stagger the refetch calls to avoid overwhelming the RPC
      refetchTotalValue();
      refetchTotalUSDC();
      refetchTotalUSYC();
      setTimeout(() => refetchPricePerShare(), 200);
      setTimeout(() => refetchUserShares(), 400);
      setTimeout(() => refetchUserShareValue(), 600);
      if (refetchTotalEURC) {
        setTimeout(() => refetchTotalEURC(), 800);
      }
      if (refetchTotalEURCShares) {
        setTimeout(() => refetchTotalEURCShares(), 1000);
      }
      if (refetchUserEURCShares) {
        setTimeout(() => refetchUserEURCShares(), 1200);
      }
      if (refetchUserInfo) {
        setTimeout(() => refetchUserInfo(), 1400);
      }
      refetchTimeoutRef.current = null;
    }, 500); // Reduced to 500ms for faster update after transaction
  };

  // Read fresh user shares directly from contract (bypasses cache)
  // Use this before MAX withdrawal to avoid race conditions
  const getFreshUserShares = async (currency: "USDC" | "EURC" = "USDC"): Promise<bigint> => {
    if (!address) {
      return 0n;
    }

    try {
      // Create a fresh client to bypass any caching
      const freshClient = createPublicClient({
        chain: arcTestnet,
        transport: http('https://rpc.testnet.arc.network'),
      });

      const shares = await freshClient.readContract({
        address: TREASURY_CONTRACTS.TreasuryVault,
        abi: TREASURY_VAULT_ABI,
        functionName: currency === "USDC" ? 'userShares' : 'userEURCShares',
        args: [address],
      });
      return shares as bigint || 0n;
    } catch (error) {
      console.error('[getFreshUserShares] Error reading shares:', error);
      return currency === "USDC" ? (userShares || 0n) : (userEURCShares || 0n);
    }
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

    // Flexible yield (yield earned from flexible deposits)
    flexibleYield,

    // Raw shares for full withdrawal (avoid rounding to 0)
    userSharesRaw: userShares || 0n,
    userEURCSharesRaw: userEURCShares || 0n,

    // Write functions
    deposit,
    withdraw,

    // Transaction state (merged: wagmi for external, serverVault for Circle)
    isPending: isCircle ? serverVault.isProcessing : isPending,
    isConfirming: isCircle ? serverVault.isProcessing : isConfirming,
    isConfirmed: isCircle ? serverVault.isComplete : isConfirmed,
    hash: isCircle ? (serverVault.txHash as `0x${string}` | undefined) : hash,
    error: isCircle ? (serverVault.error ? new Error(serverVault.error) : null) : error,
    reset: isCircle ? serverVault.reset : reset,

    // Utils
    refetchAll,
    getFreshUserShares,
    isArcTestnet,
  };
};


