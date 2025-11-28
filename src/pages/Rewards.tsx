import { useAccount, useReadContract, useSwitchChain } from "wagmi";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { WalletConnect } from "@/components/WalletConnect";
import { UserMenu } from "@/components/UserMenu";
import { ArrowLeft, Copy, Check, Twitter, Send, Loader2 } from "lucide-react";
import { useUserPoints } from "@/hooks/useUserPoints";
import { useReferral } from "@/hooks/useReferral";
import { useUSYCPrice } from "@/hooks/useUSYCPrice";
import { TREASURY_CONTRACTS } from "@/lib/constants";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import confetti from "canvas-confetti";
import earlyBadgeImg from "@/assets/early1_small.webp";

const ARC_TESTNET_CHAIN_ID = 5042002;

const BADGE_ABI = [
  { name: 'totalSupply', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'MAX_SUPPLY', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'mint', type: 'function', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
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
  confetti({
    particleCount: 100,
    spread: 70,
    origin: { y: 0.6 },
    colors: ['#22c55e', '#10b981', '#6366f1', '#8b5cf6'],
  });
};

const Rewards = () => {
  const navigate = useNavigate();
  const account = useAccount();
  const { toast } = useToast();
  const { formattedPoints, isLoading: isLoadingPoints } = useUserPoints();
  const { referralUrl, stats, isLoading: isLoadingReferral, error: referralError } = useReferral();
  const { apy } = useUSYCPrice();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const isConnected = account?.isConnected ?? false;
  const address = account?.address;
  const isArcTestnet = account?.chainId === ARC_TESTNET_CHAIN_ID;
  const [copied, setCopied] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Badge data
  const { data: totalSupply } = useReadContract({
    address: TREASURY_CONTRACTS.EarlySupporterBadge,
    abi: BADGE_ABI,
    functionName: 'totalSupply',
  });

  const { data: maxSupply } = useReadContract({
    address: TREASURY_CONTRACTS.EarlySupporterBadge,
    abi: BADGE_ABI,
    functionName: 'MAX_SUPPLY',
  });

  const { data: badgeBalance, refetch: refetchBalance } = useReadContract({
    address: TREASURY_CONTRACTS.EarlySupporterBadge,
    abi: BADGE_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { data: mintingEnabled } = useReadContract({
    address: TREASURY_CONTRACTS.EarlySupporterBadge,
    abi: BADGE_ABI,
    functionName: 'mintingEnabled',
  });

  const { data: userShareValue } = useReadContract({
    address: TREASURY_CONTRACTS.TreasuryVault,
    abi: VAULT_ABI,
    functionName: 'getUserShareValue',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { writeContract, data: mintTxHash, isPending: isMinting } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isMinted } = useWaitForTransactionReceipt({ hash: mintTxHash });

  const MIN_DEPOSIT = 10_000_000n; // $10 with 6 decimals
  const userBalance = userShareValue ?? 0n;
  const hasDeposit = userBalance >= MIN_DEPOSIT;
  const alreadyOwns = badgeBalance !== undefined && badgeBalance > 0n;
  const canMint = hasDeposit && !alreadyOwns && mintingEnabled;

  const totalReferrals = stats?.totalReferrals || 0;
  const bonusPoints = stats?.totalBonusPoints || 0;

  const copyToClipboard = () => {
    if (!referralUrl) return;
    navigator.clipboard.writeText(referralUrl);
    setCopied(true);
    toast({ title: "Copied!", description: "Referral link copied" });
    setTimeout(() => setCopied(false), 2000);
  };

  const shareOnTwitter = () => {
    const text = encodeURIComponent(`🏦 Earning real yield backed by US Treasury Bills on @ArcTreasury\n\n💰 Deposit stablecoins → Earn ~${apy.toFixed(1)}% APY\n🎁 Early supporters get FREE NFT badge\n\nJoin the future of DeFi 👇`);
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${encodeURIComponent(referralUrl || '')}`, "_blank");
  };

  const shareOnTelegram = () => {
    const text = encodeURIComponent(`🏦 Earning real yield backed by US Treasury Bills on Arc Treasury!\n\n💰 Deposit stablecoins → Earn ~${apy.toFixed(1)}% APY\n🎁 Early supporters get FREE NFT badge\n\nJoin the future of DeFi 👇`);
    window.open(`https://t.me/share/url?url=${encodeURIComponent(referralUrl || '')}&text=${text}`, "_blank");
  };

  const handleMint = () => {
    if (!canMint) return;
    writeContract({
      address: TREASURY_CONTRACTS.EarlySupporterBadge,
      abi: BADGE_ABI,
      functionName: 'mint',
    });
  };

  useEffect(() => {
    if (isMinted) {
      toast({ title: "Badge Minted!", description: "Welcome to the Early Supporters!" });
      fireConfetti();
      setShowSuccess(true);
      setTimeout(() => refetchBalance(), 2000);
    }
  }, [isMinted, toast, refetchBalance]);

  return (
    <div className="min-h-screen bg-background">
      {/* Animated gradient background */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-primary/5 via-transparent to-transparent rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-purple-500/5 via-transparent to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      {/* Header */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/20 bg-background/60 backdrop-blur-xl">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button onClick={() => navigate("/dashboard")} variant="ghost" size="sm" className="gap-2 hover:bg-white/5">
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Back</span>
              </Button>
              <div className="h-4 w-px bg-border/30" />
              <h1 className="text-lg font-semibold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">Rewards</h1>
            </div>
            {isConnected ? <UserMenu /> : <WalletConnect />}
          </div>
        </div>
      </nav>

      <div className="pt-24 pb-20 container mx-auto px-6 max-w-4xl">
        {/* Wrong Network */}
        {isConnected && !isArcTestnet && (
          <div className="mb-8 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 backdrop-blur-sm">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-red-400">Switch to Arc Testnet to continue</p>
              <Button onClick={() => switchChain?.({ chainId: ARC_TESTNET_CHAIN_ID })} disabled={isSwitching} size="sm" className="bg-red-500 hover:bg-red-600">
                {isSwitching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Switch'}
              </Button>
            </div>
          </div>
        )}

        {/* Hero Section */}
        <div className="relative mb-12">
          <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-16">
            {/* Badge Preview */}
            <div className="relative group">
              <img src={earlyBadgeImg} alt="Early Supporter Badge" className="w-44 lg:w-56 drop-shadow-2xl transition-transform group-hover:scale-105" />
            </div>

            {/* Info */}
            <div className="flex-1 text-center lg:text-left">
              <h2 className="text-3xl lg:text-4xl font-bold mb-3">
                Early Supporter <span className="bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">Badge</span>
              </h2>
              <p className="text-muted-foreground mb-6 max-w-md">
                Free NFT badge for early depositors. Deposit $10+ USDC/EURC to claim yours.
              </p>

              {/* Stats */}
              <div className="inline-flex items-center gap-6 px-6 py-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
                <div className="text-center">
                  <p className="text-2xl font-bold">{totalSupply?.toString() ?? '0'}</p>
                  <p className="text-xs text-muted-foreground">Minted</p>
                </div>
                <div className="w-px h-8 bg-white/10" />
                <div className="text-center">
                  <p className="text-2xl font-bold">{maxSupply ? (Number(maxSupply) - Number(totalSupply || 0)).toLocaleString() : '5,000'}</p>
                  <p className="text-xs text-muted-foreground">Left</p>
                </div>
                <div className="w-px h-8 bg-white/10" />
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-400">FREE</p>
                  <p className="text-xs text-muted-foreground">Mint</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        {!isConnected ? (
          <div className="flex flex-col items-center gap-6 py-12">
            <p className="text-muted-foreground">Connect wallet to view your rewards</p>
            <WalletConnect />
          </div>
        ) : isArcTestnet && (
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Points Card */}
            <div className="p-6 rounded-3xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Your Points</h3>
                <div className="px-2 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                  +10% referrals
                </div>
              </div>
              <p className="text-5xl font-bold mb-2 bg-gradient-to-r from-foreground to-foreground/50 bg-clip-text text-transparent">
                {isLoadingPoints ? "..." : formattedPoints}
              </p>
              <p className="text-sm text-muted-foreground">1 point per $10/day deposited</p>
            </div>

            {/* Badge Mint Card */}
            <div className="p-6 rounded-3xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Badge Status</h3>
                {hasDeposit && (
                  <div className="px-2 py-1 rounded-full bg-green-500/10 text-green-400 text-xs font-medium">
                    Eligible
                  </div>
                )}
              </div>

              {alreadyOwns || showSuccess ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-lg font-semibold text-green-400">1.2x Multiplier Active</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Your points earn 20% bonus!</p>
                  <Button
                    onClick={shareOnTwitter}
                    variant="outline"
                    className="w-full gap-3 rounded-xl h-12"
                  >
                    <Twitter className="w-5 h-5" />
                    Share on Twitter
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 text-sm">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${hasDeposit ? 'bg-green-500 text-white' : 'bg-white/10 text-muted-foreground'}`}>
                      {hasDeposit ? '✓' : '1'}
                    </div>
                    <span className={hasDeposit ? 'text-green-400' : ''}>Deposit $10+ USDC/EURC</span>
                  </div>
                  <Button
                    onClick={hasDeposit ? handleMint : () => navigate('/dashboard')}
                    disabled={hasDeposit && (isMinting || isConfirming || !canMint)}
                    className="w-full rounded-xl h-11"
                  >
                    {isMinting || isConfirming ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : hasDeposit ? (
                      'Mint Badge'
                    ) : (
                      'Go to Deposit'
                    )}
                  </Button>
                </div>
              )}
            </div>

            {/* Referral Card - Full Width */}
            <div className="lg:col-span-2 p-6 rounded-3xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Referral Program</h3>
                <div className="flex items-center gap-4 text-sm">
                  <div className="text-center">
                    <span className="font-bold">{totalReferrals}</span>
                    <span className="text-muted-foreground ml-1">refs</span>
                  </div>
                  <div className="text-center">
                    <span className="font-bold text-green-400">+{bonusPoints.toLocaleString()}</span>
                    <span className="text-muted-foreground ml-1">pts</span>
                  </div>
                </div>
              </div>

              {/* Referral Link */}
              <div className="flex gap-2 mb-4">
                <div className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 font-mono text-sm truncate flex items-center">
                  {isLoadingReferral ? (
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading...
                    </span>
                  ) : referralUrl ? (
                    referralUrl
                  ) : referralError ? (
                    <span className="text-amber-400 text-xs">API unavailable (localhost)</span>
                  ) : (
                    <span className="text-muted-foreground">Generating link...</span>
                  )}
                </div>
                <Button onClick={copyToClipboard} variant="outline" size="icon" className="shrink-0 rounded-xl" disabled={!referralUrl || isLoadingReferral}>
                  {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>

              {/* Share Buttons */}
              <div className="flex gap-3">
                <Button
                  onClick={shareOnTwitter}
                  variant="outline"
                  disabled={!referralUrl || isLoadingReferral}
                  className="flex-1 gap-2 rounded-xl h-11"
                >
                  <Twitter className="w-4 h-4" />
                  Twitter
                </Button>
                <Button
                  onClick={shareOnTelegram}
                  variant="outline"
                  disabled={!referralUrl || isLoadingReferral}
                  className="flex-1 gap-2 rounded-xl h-11"
                >
                  <Send className="w-4 h-4" />
                  Telegram
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Rewards;
