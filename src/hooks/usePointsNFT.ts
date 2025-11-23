import { useAccount, useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { useMemo, useRef, useEffect } from 'react';
import { TREASURY_CONTRACTS } from '@/lib/constants';
import { arcTestnet } from '@/lib/wagmi';

// NFT Contract ABI
const NFT_ABI = [
  {
    inputs: [],
    name: 'mint',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalSupply',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'MAX_SUPPLY',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'owner', type: 'address' }],
    name: 'hasMinted',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

export const usePointsNFT = (nftAddress?: `0x${string}`) => {
  const account = useAccount();
  const address = account?.address;
  const isConnected = account?.isConnected ?? false;
  const chainId = account?.chainId;

  const isArcTestnet = chainId === 5042002;

  // Debounce refetch to avoid rate limiting
  const refetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Use multicall to batch all reads into a single RPC call - 4x faster!
  const { data: nftData, refetch: refetchNFTData, isLoading: isLoadingNFT, error: nftError } = useReadContracts({
    contracts: [
      {
        address: nftAddress,
        abi: NFT_ABI,
        functionName: 'totalSupply',
        chainId: arcTestnet.id,
      },
      {
        address: nftAddress,
        abi: NFT_ABI,
        functionName: 'MAX_SUPPLY',
        chainId: arcTestnet.id,
      },
      {
        address: nftAddress,
        abi: NFT_ABI,
        functionName: 'balanceOf',
        args: address ? [address] : undefined,
        chainId: arcTestnet.id,
      },
      {
        address: nftAddress,
        abi: NFT_ABI,
        functionName: 'hasMinted',
        args: address ? [address] : undefined,
        chainId: arcTestnet.id,
      },
    ],
    query: {
      enabled: isConnected && isArcTestnet && !!nftAddress && !!address,
      refetchInterval: 60000, // Auto-refresh every 60 seconds (was 10s - reduced 429 errors)
      retry: (failureCount, error: any) => {
        if (error?.status === 429 || error?.message?.includes('429') || error?.message?.includes('Too Many Requests')) {
          return false;
        }
        return failureCount < 2;
      },
      retryDelay: 3000,
    },
  });

  // Extract data from multicall result
  const totalSupply = nftData?.[0]?.result as bigint | undefined;
  const maxSupply = nftData?.[1]?.result as bigint | undefined;
  const userBalance = nftData?.[2]?.result as bigint | undefined;
  const hasMinted = nftData?.[3]?.result as boolean | undefined;

  // DEBUG: Log NFT query results after mount
  useEffect(() => {
    console.log('[usePointsNFT] Connection state:', {
      isConnected,
      chainId,
      isArcTestnet,
      address: address || 'not connected',
      nftAddress: nftAddress || 'not provided',
    });
    console.log('[usePointsNFT] NFT query results:', {
      enabled: isConnected && isArcTestnet && !!nftAddress && !!address,
      isLoading: isLoadingNFT,
      totalSupply: totalSupply?.toString() || 'undefined',
      maxSupply: maxSupply?.toString() || 'undefined',
      userBalance: userBalance?.toString() || 'undefined',
      hasMinted: hasMinted !== undefined ? hasMinted.toString() : 'undefined',
      error: nftError?.message || 'none',
      rawData: nftData ? JSON.stringify(nftData.map(d => ({ status: d.status, result: d.result?.toString() }))) : 'undefined',
    });
  }, [isConnected, chainId, isArcTestnet, address, nftAddress, isLoadingNFT, totalSupply, maxSupply, userBalance, hasMinted, nftError, nftData]);

  // Mint function
  const { writeContract: mintNFT, data: mintHash, isPending: isMinting, error: mintError } = useWriteContract();
  const { isLoading: isConfirmingMint, isSuccess: isMintConfirmed } = useWaitForTransactionReceipt({
    hash: mintHash,
  });

  const mint = async () => {
    if (!isConnected || !address || !isArcTestnet || !nftAddress) {
      throw new Error('Please connect your wallet to Arc Testnet');
    }

    mintNFT({
      address: nftAddress,
      abi: NFT_ABI,
      functionName: 'mint',
      chainId: arcTestnet.id,
    });
  };

  // Refetch after successful mint with debouncing
  const refetchAll = () => {
    // Clear any pending refetch
    if (refetchTimeoutRef.current) {
      clearTimeout(refetchTimeoutRef.current);
    }

    // Debounce refetch to avoid rate limiting - now using multicall
    refetchTimeoutRef.current = setTimeout(() => {
      refetchNFTData();
      refetchTimeoutRef.current = null;
    }, 3000); // Wait 3 seconds before refetching
  };
  
  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (refetchTimeoutRef.current) {
        clearTimeout(refetchTimeoutRef.current);
      }
    };
  }, []);

  return {
    totalSupply: totalSupply ? Number(totalSupply) : 0,
    maxSupply: maxSupply ? Number(maxSupply) : 2000,
    userBalance: userBalance ? Number(userBalance) : 0,
    hasMinted: hasMinted || false,
    mint,
    isMinting: isMinting || isConfirmingMint,
    isMintConfirmed,
    mintHash,
    mintError,
    refetchAll,
    isLoadingNFT,
  };
};

