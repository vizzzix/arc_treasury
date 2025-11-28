import { useAccount, useWriteContract, useReadContract, useWaitForTransactionReceipt } from "wagmi";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, Sparkles, Twitter } from "lucide-react";
import { TREASURY_CONTRACTS } from "@/lib/constants";
import { useToast } from "@/hooks/use-toast";
import { useReferral } from "@/hooks/useReferral";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import confetti from "canvas-confetti";
import earlyBadgeImg from "@/assets/earlylogo_small.png";

const BADGE_ABI = [
  { name: 'mint', type: 'function', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'totalSupply', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'MAX_SUPPLY', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'mintingEnabled', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'bool' }] },
] as const;

const VAULT_ABI = [
  {
    inputs: [{ name: 'user', type: 'address' }],
    name: 'getUserShareValue',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

const fireConfetti = () => {
  const duration = 3000;
  const end = Date.now() + duration;

  const frame = () => {
    confetti({
      particleCount: 3,
      angle: 60,
      spread: 55,
      origin: { x: 0 },
      colors: ['#22c55e', '#10b981', '#059669', '#6ee7b7'],
    });
    confetti({
      particleCount: 3,
      angle: 120,
      spread: 55,
      origin: { x: 1 },
      colors: ['#22c55e', '#10b981', '#059669', '#6ee7b7'],
    });

    if (Date.now() < end) {
      requestAnimationFrame(frame);
    }
  };

  frame();

  // Big burst in the middle
  confetti({
    particleCount: 100,
    spread: 70,
    origin: { y: 0.6 },
    colors: ['#22c55e', '#10b981', '#059669', '#6ee7b7', '#fbbf24', '#f59e0b'],
  });
};


export const EarlyBadgeSection = () => {
  const account = useAccount();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { referralUrl } = useReferral();
  const address = account?.address;
  const [showSuccess, setShowSuccess] = useState(false);

  const shareOnTwitter = () => {
    const shareUrl = referralUrl || 'https://arctreasury.biz/rewards';
    const text = `I just minted my Early Supporter Badge on @ArcTreasury!

Arc Treasury is a DeFi vault that earns real yield from US Treasury Bills via USYC.

Deposit $10+ USDC/EURC on testnet to claim your badge:`;
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`;
    window.open(twitterUrl, '_blank');
  };

  const isContractDeployed = TREASURY_CONTRACTS.EarlySupporterBadge !== '0x0000000000000000000000000000000000000000';

  // Badge contract reads
  const { data: badgeBalance, isLoading: isLoadingBalance, refetch: refetchBalance } = useReadContract({
    address: TREASURY_CONTRACTS.EarlySupporterBadge,
    abi: BADGE_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address && isContractDeployed },
  });

  const { data: totalSupply, isLoading: isLoadingSupply } = useReadContract({
    address: TREASURY_CONTRACTS.EarlySupporterBadge,
    abi: BADGE_ABI,
    functionName: 'totalSupply',
    query: { enabled: isContractDeployed },
  });

  const { data: maxSupply } = useReadContract({
    address: TREASURY_CONTRACTS.EarlySupporterBadge,
    abi: BADGE_ABI,
    functionName: 'MAX_SUPPLY',
    query: { enabled: isContractDeployed },
  });

  const { data: mintingEnabled } = useReadContract({
    address: TREASURY_CONTRACTS.EarlySupporterBadge,
    abi: BADGE_ABI,
    functionName: 'mintingEnabled',
    query: { enabled: isContractDeployed },
  });

  // Vault deposit check - $10 minimum
  const { data: userShareValue } = useReadContract({
    address: TREASURY_CONTRACTS.TreasuryVault,
    abi: VAULT_ABI,
    functionName: 'getUserShareValue',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { writeContract, data: mintTxHash, isPending: isMinting } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isMinted } = useWaitForTransactionReceipt({ hash: mintTxHash });

  // Check if user has deposited at least $10
  const MIN_DEPOSIT = 10_000_000n; // $10 with 6 decimals
  const userBalance = userShareValue ?? 0n;
  const hasDeposit = userBalance >= MIN_DEPOSIT;

  const alreadyOwns = badgeBalance !== undefined && badgeBalance > 0n;
  const canMint = hasDeposit && !alreadyOwns && mintingEnabled;

  const handleMint = () => {
    if (!canMint) return;

    writeContract({
      address: TREASURY_CONTRACTS.EarlySupporterBadge,
      abi: BADGE_ABI,
      functionName: 'mint',
    }, {
      onSuccess: () => {
        toast({ title: "Minting...", description: "Your Early Supporter Badge is being minted!" });
      },
      onError: (error) => {
        toast({ title: "Mint Failed", description: error.message, variant: "destructive" });
      },
    });
  };

  useEffect(() => {
    if (isMinted) {
      toast({ title: "Badge Minted!", description: "You are now an Early Supporter!" });
      fireConfetti();
      setShowSuccess(true);
      // Refetch balance to update UI
      setTimeout(() => refetchBalance(), 2000);
    }
  }, [isMinted, toast, refetchBalance]);

  const isLoading = isLoadingBalance || isLoadingSupply;

  if (!isContractDeployed) {
    return (
      <div className="text-center text-muted-foreground py-4">
        Coming soon...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <>
          {/* NFT Image and Status */}
          <div className="relative">
            <div className="flex justify-center">
              <img src={earlyBadgeImg} alt="Early Supporter Badge" className="w-full h-auto max-w-[240px]" />
            </div>
            {(alreadyOwns || showSuccess) && (
              <div className="absolute top-0 right-0 bg-gradient-to-r from-green-500 to-emerald-500 text-white text-xs font-bold px-4 py-2 rounded-full shadow-lg">
                ✓ Owned
              </div>
            )}
          </div>

          {/* Supply Counter */}
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-muted/50 border border-border/50">
              <span className="text-xs text-muted-foreground">Supply:</span>
              <span className="text-sm font-bold">{totalSupply?.toString() ?? '0'} / {maxSupply?.toString() ?? '5000'}</span>
            </div>
          </div>

          {/* Success state after minting */}
          {showSuccess && (
            <div className="space-y-3">
              <div className="p-4 rounded-lg bg-gradient-to-br from-green-500/20 to-emerald-500/10 border border-green-500/30 text-center space-y-3">
                <div className="text-2xl">🎉</div>
                <p className="text-sm text-green-600 dark:text-green-400 font-bold">
                  Congratulations!
                </p>
                <p className="text-xs text-green-600/80 dark:text-green-400/80">
                  You are now an Early Supporter of Arc Treasury!
                </p>
              </div>
              <Button
                onClick={shareOnTwitter}
                size="lg"
                className="w-full bg-[#1DA1F2] hover:bg-[#1a8cd8] text-white"
              >
                <Twitter className="w-4 h-4 mr-2" />
                Share on Twitter
              </Button>
            </div>
          )}

          {/* Requirements - only show if not success and not already owns */}
          {!alreadyOwns && !showSuccess && mintingEnabled && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className={`p-3 rounded-lg border ${hasDeposit ? 'bg-green-500/10 border-green-500/30 text-green-600 dark:text-green-400' : 'bg-muted/30 border-border/50 text-muted-foreground'}`}>
                  <div className="font-semibold mb-1">{hasDeposit ? '✓' : '○'} Deposit $10+</div>
                  <div className="text-[10px] opacity-70">{hasDeposit ? 'Requirement met' : 'In Arc Vault'}</div>
                </div>
                <div className="p-3 rounded-lg border bg-muted/30 border-border/50 text-muted-foreground">
                  <div className="font-semibold mb-1">Your NFTs</div>
                  <div className="text-[10px] opacity-70">You own: 0</div>
                </div>
              </div>

              {/* Help section when not eligible */}
              {!hasDeposit && (
                <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30 space-y-2">
                  <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                    How to get this badge:
                  </p>
                  <ol className="text-[11px] text-blue-600/80 dark:text-blue-400/80 space-y-1 list-decimal list-inside">
                    <li>Connect to Arc Testnet network</li>
                    <li>Deposit at least $10 USDC/EURC in the Vault</li>
                    <li>Return here to mint your badge</li>
                  </ol>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs h-8 mt-2"
                    onClick={() => navigate('/dashboard')}
                  >
                    Go to Dashboard
                  </Button>
                </div>
              )}

              <Button
                onClick={handleMint}
                disabled={!canMint || isMinting || isConfirming}
                size="lg"
                className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
              >
                {isMinting || isConfirming ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Minting...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Mint Badge (Free)
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Status Messages - for returning users who already own */}
          {alreadyOwns && !showSuccess && (
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30 text-center">
                <p className="text-xs text-green-600 dark:text-green-400 font-semibold">
                  ✓ 1.2x Multiplier Active
                </p>
                <p className="text-[10px] text-green-600/70 dark:text-green-400/70 mt-1">
                  Your points earn 20% bonus!
                </p>
              </div>
              <Button
                onClick={shareOnTwitter}
                variant="outline"
                size="sm"
                className="w-full"
              >
                <Twitter className="w-4 h-4 mr-2" />
                Share on Twitter
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
