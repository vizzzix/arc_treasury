import { useAccount } from 'wagmi';
import { useReadContracts } from 'wagmi';
import { TREASURY_CONTRACTS } from '@/lib/constants';
import { defineChain } from 'viem';
import { Sparkles, Loader2 } from 'lucide-react';
import nftIcon from '@/assets/nft.png';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { usePointsNFT } from '@/hooks/usePointsNFT';
import { useEffect, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';

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

// Treasury Vault ABI for getUserPoints
const TREASURY_VAULT_ABI = [
  {
    inputs: [{ name: 'user', type: 'address' }],
    name: 'getUserPoints',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'user', type: 'address' }],
    name: 'userInfo',
    outputs: [
      { name: 'firstDepositTime', type: 'uint256' },
      { name: 'lastBalanceUpdate', type: 'uint256' },
      { name: 'balanceAtLastUpdate', type: 'uint256' },
      { name: 'accumulatedPoints', type: 'uint256' },
      { name: 'currentPoints', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

export const PointsDisplay = () => {
  const account = useAccount();
  const address = account?.address;
  const isConnected = account?.isConnected ?? false;
  const chainId = account?.chainId;

  const isArcTestnet = chainId === 5042002;
  const { toast } = useToast();

  // Use multicall to batch getUserPoints and userInfo - 2x faster!
  const { data: vaultData, isLoading: isLoadingPoints, error: vaultError } = useReadContracts({
    contracts: [
      {
        address: TREASURY_CONTRACTS.TreasuryVault,
        abi: TREASURY_VAULT_ABI,
        functionName: 'getUserPoints',
        args: address ? [address] : undefined,
        chainId: arcTestnet.id,
      },
      {
        address: TREASURY_CONTRACTS.TreasuryVault,
        abi: TREASURY_VAULT_ABI,
        functionName: 'userInfo',
        args: address ? [address] : undefined,
        chainId: arcTestnet.id,
      },
    ],
    query: {
      enabled: isConnected && isArcTestnet && !!address,
      refetchInterval: 60000, // Auto-refresh every 60 seconds (was 10s - reduced 429 errors)
    },
  });

  // Extract data from multicall result
  const points = vaultData?.[0]?.result as bigint | undefined;
  const userInfo = vaultData?.[1]?.result as [bigint, bigint, bigint, bigint, bigint] | undefined;

  // NFT minting
  const nftAddress = TREASURY_CONTRACTS.PointsMultiplierNFT;
  const {
    totalSupply,
    maxSupply,
    userBalance,
    hasMinted,
    mint,
    isMinting,
    isMintConfirmed,
    mintHash,
    mintError,
    refetchAll,
    isLoadingNFT,
  } = usePointsNFT(nftAddress);

  // Track last shown mint hash to avoid duplicate toasts
  const lastMintHashRef = useRef<string | undefined>(undefined);

  // Handle mint success
  useEffect(() => {
    if (isMintConfirmed && mintHash && lastMintHashRef.current !== mintHash) {
      lastMintHashRef.current = mintHash;
      toast({
        title: "🎉 NFT Minted Successfully!",
        description: `Your NFT has been minted! You now have 2x points multiplier. Transaction: ${mintHash.slice(0, 10)}...${mintHash.slice(-8)}`,
        variant: "default",
      });
      // Refetch after a delay to avoid rate limiting
      setTimeout(() => {
        refetchAll();
      }, 2000);
    }
  }, [isMintConfirmed, mintHash, toast, refetchAll]);

  // Handle mint error
  useEffect(() => {
    if (mintError) {
      toast({
        title: "Mint Failed",
        description: mintError.message || "Failed to mint NFT",
        variant: "destructive",
      });
    }
  }, [mintError, toast]);

  if (!isConnected || !address) {
    return null;
  }

  const pointsValue = points ? Number(points) : 0;
  const formattedPoints = pointsValue.toLocaleString('en-US', { maximumFractionDigits: 0 });

  // Calculate days since first deposit
  const daysSinceFirstDeposit = userInfo && userInfo[0] > 0
    ? Math.floor((Date.now() / 1000 - Number(userInfo[0])) / 86400)
    : 0;

  // Check mint eligibility requirements
  const MIN_DEPOSIT = 10000n * 1000000n; // $10,000 with 6 decimals
  const MIN_DAYS = 30; // 1 month

  const balanceAtLastUpdate = userInfo?.[2] ?? 0n;
  const hasMinDeposit = balanceAtLastUpdate >= MIN_DEPOSIT;
  const hasMinTime = daysSinceFirstDeposit >= MIN_DAYS;
  const isEligibleToMint = hasMinDeposit && hasMinTime;

  const handleMint = async () => {
    try {
      await mint();
    } catch {
      // Error handled by useEffect
    }
  };

  return (
    <div className="space-y-4">
      {isLoadingNFT ? (
        <div className="space-y-2">
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <>
          {nftAddress && (
            <div className="space-y-4">
              {/* NFT Image and Status */}
              <div className="relative">
                <div className="flex justify-center">
                  <img src={nftIcon} alt="2x Points Multiplier NFT" className="w-full h-auto max-w-[240px] drop-shadow-2xl" />
                </div>
                {userBalance > 0 && (
                  <div className="absolute top-0 right-0 bg-gradient-to-r from-green-500 to-emerald-500 text-white text-xs font-bold px-4 py-2 rounded-full shadow-lg">
                    ✓ 2x Active
                  </div>
                )}
              </div>

              {/* Supply Counter */}
              <div className="text-center">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-muted/50 border border-border/50">
                  <span className="text-xs text-muted-foreground">Supply:</span>
                  <span className="text-sm font-bold">{totalSupply} / {maxSupply}</span>
                </div>
              </div>

              {/* Requirements - Compact */}
              {!hasMinted && userBalance === 0 && totalSupply < maxSupply && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className={`p-3 rounded-lg border ${hasMinDeposit ? 'bg-green-500/10 border-green-500/30 text-green-600 dark:text-green-400' : 'bg-muted/30 border-border/50 text-muted-foreground'}`}>
                      <div className="font-semibold mb-1">{hasMinDeposit ? '✓' : '○'} $10k Deposit</div>
                      <div className="text-[10px] opacity-70">{hasMinDeposit ? 'Met' : 'Required'}</div>
                    </div>
                    <div className={`p-3 rounded-lg border ${hasMinTime ? 'bg-green-500/10 border-green-500/30 text-green-600 dark:text-green-400' : 'bg-muted/30 border-border/50 text-muted-foreground'}`}>
                      <div className="font-semibold mb-1">{hasMinTime ? '✓' : '○'} 30 Days Lock</div>
                      <div className="text-[10px] opacity-70">{daysSinceFirstDeposit} / 30 days</div>
                    </div>
                  </div>

                  <Button
                    onClick={handleMint}
                    disabled={isMinting || !isEligibleToMint}
                    size="lg"
                    className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
                  >
                    {isMinting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Minting...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        Mint 2x NFT
                      </>
                    )}
                  </Button>
                </div>
              )}

              {/* Status Messages */}
              {hasMinted && userBalance === 0 && (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-center">
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Already minted. Transfer NFT to activate 2x multiplier.
                  </p>
                </div>
              )}
              {userBalance > 0 && (
                <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30 text-center">
                  <p className="text-xs text-green-600 dark:text-green-400 font-semibold">
                    ✓ You own {userBalance} NFT{userBalance > 1 ? 's' : ''} - 2x Points Active!
                  </p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};
