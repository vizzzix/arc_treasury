import { useAccount, useReadContract, useSwitchChain } from "wagmi";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { WalletConnect } from "@/components/WalletConnect";
import { UserMenu } from "@/components/UserMenu";
import { ArrowLeft, Copy, Check, Twitter, Send, Loader2, Trophy, Crown, Medal, ChevronDown, ChevronUp } from "lucide-react";
import { useUserPoints } from "@/hooks/useUserPoints";
import { useReferral } from "@/hooks/useReferral";
import { useUSYCPrice } from "@/hooks/useUSYCPrice";
import { useLeaderboard } from "@/hooks/useLeaderboard";
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

const formatAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

const Rewards = () => {
  const navigate = useNavigate();
  const account = useAccount();
  const { toast } = useToast();
  const { formattedPoints, isLoading: isLoadingPoints } = useUserPoints();
  const { referralUrl, stats, isLoading: isLoadingReferral, error: referralError } = useReferral();
  const { apy } = useUSYCPrice();
  const { leaderboard, isLoading: isLoadingLeaderboard, userRank, totalDepositors } = useLeaderboard(account?.address);
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const isConnected = account?.isConnected ?? false;
  const address = account?.address;
  const isArcTestnet = account?.chainId === ARC_TESTNET_CHAIN_ID;
  const [copied, setCopied] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showAllLeaderboard, setShowAllLeaderboard] = useState(false);

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
        <div className="container mx-auto px-4 sm:px-6 py-4">
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

      <div className="pt-24 pb-20 container mx-auto px-4 sm:px-6 max-w-4xl overflow-x-hidden">
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
              <div className="inline-flex items-center gap-3 sm:gap-6 px-4 sm:px-6 py-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
                <div className="text-center">
                  <p className="text-xl sm:text-2xl font-bold">{totalSupply?.toString() ?? '0'}</p>
                  <p className="text-xs text-muted-foreground">Minted</p>
                </div>
                <div className="w-px h-8 bg-white/10" />
                <div className="text-center">
                  <p className="text-xl sm:text-2xl font-bold">{maxSupply ? (Number(maxSupply) - Number(totalSupply || 0)).toLocaleString() : '5,000'}</p>
                  <p className="text-xs text-muted-foreground">Left</p>
                </div>
                <div className="w-px h-8 bg-white/10" />
                <div className="text-center">
                  <p className="text-xl sm:text-2xl font-bold text-green-400">FREE</p>
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
          <div className="space-y-4">
            {/* Top Row: Points + Badge + Referral Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Points Card - Compact */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 backdrop-blur-sm">
                <p className="text-xs text-muted-foreground mb-1">Your Points</p>
                <p className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/50 bg-clip-text text-transparent">
                  {isLoadingPoints ? "..." : formattedPoints}
                </p>
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">1pt / $10/day</p>
              </div>

              {/* Badge Status - Compact */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 backdrop-blur-sm">
                <p className="text-xs text-muted-foreground mb-1">Badge</p>
                {alreadyOwns || showSuccess ? (
                  <>
                    <p className="text-2xl sm:text-3xl font-bold text-green-400">1.2x</p>
                    <p className="text-[10px] sm:text-xs text-green-400/80 mt-1">Active</p>
                  </>
                ) : (
                  <>
                    <p className="text-2xl sm:text-3xl font-bold text-muted-foreground">{hasDeposit ? '✓' : '—'}</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">{hasDeposit ? 'Eligible' : 'Need $10+'}</p>
                  </>
                )}
              </div>

              {/* Referrals Count - Compact */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 backdrop-blur-sm">
                <p className="text-xs text-muted-foreground mb-1">Referrals</p>
                <p className="text-2xl sm:text-3xl font-bold">{totalReferrals}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">+10% bonus</p>
              </div>

              {/* Your Rank - Compact */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 backdrop-blur-sm">
                <p className="text-xs text-muted-foreground mb-1">Your Rank</p>
                <p className="text-2xl sm:text-3xl font-bold">
                  {userRank ? `#${userRank}` : '—'}
                </p>
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
                  {userRank ? `of ${totalDepositors}` : 'Deposit to rank'}
                </p>
              </div>
            </div>

            {/* Badge Mint Action (if not owned) */}
            {!alreadyOwns && !showSuccess && (
              <div className="p-4 rounded-2xl bg-gradient-to-br from-primary/5 to-purple-500/5 border border-primary/20 backdrop-blur-sm">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-sm">Claim Early Supporter Badge</p>
                    <p className="text-xs text-muted-foreground">Get 1.2x points multiplier</p>
                  </div>
                  <Button
                    onClick={hasDeposit ? handleMint : () => navigate('/dashboard')}
                    disabled={hasDeposit && (isMinting || isConfirming || !canMint)}
                    size="sm"
                    className="rounded-xl"
                  >
                    {isMinting || isConfirming ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : hasDeposit ? (
                      'Mint Badge'
                    ) : (
                      'Deposit First'
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Referral Section - Compact */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 backdrop-blur-sm">
              <p className="text-xs text-muted-foreground mb-3">Share & Earn</p>
              <div className="flex gap-2">
                <div className="flex-1 min-w-0 px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 font-mono text-xs truncate flex items-center">
                  {isLoadingReferral ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : referralUrl ? (
                    referralUrl
                  ) : referralError ? (
                    <span className="text-amber-400">Unavailable</span>
                  ) : (
                    '...'
                  )}
                </div>
                <Button onClick={copyToClipboard} variant="outline" size="icon" className="shrink-0 rounded-xl h-10 w-10" disabled={!referralUrl}>
                  {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </Button>
                <Button onClick={shareOnTwitter} variant="outline" size="icon" className="shrink-0 rounded-xl h-10 w-10" disabled={!referralUrl}>
                  <Twitter className="w-4 h-4" />
                </Button>
                <Button onClick={shareOnTelegram} variant="outline" size="icon" className="shrink-0 rounded-xl h-10 w-10" disabled={!referralUrl}>
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Leaderboard */}
            <div className="p-4 sm:p-6 rounded-2xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-yellow-500" />
                  <h3 className="font-semibold">Leaderboard</h3>
                </div>
                <span className="text-xs text-muted-foreground">{totalDepositors} depositors</span>
              </div>

              {isLoadingLeaderboard ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : leaderboard.length === 0 ? (
                <p className="text-center text-muted-foreground py-8 text-sm">No deposits yet</p>
              ) : (
                <div className="space-y-2">
                  {leaderboard.slice(0, showAllLeaderboard ? 15 : 5).map((entry) => {
                    const isCurrentUser = address?.toLowerCase() === entry.address.toLowerCase();
                    return (
                      <div
                        key={entry.address}
                        className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
                          isCurrentUser
                            ? 'bg-primary/10 border border-primary/30'
                            : 'bg-white/[0.02] hover:bg-white/[0.04]'
                        }`}
                      >
                        {/* Rank */}
                        <div className="w-8 flex justify-center">
                          {entry.rank === 1 ? (
                            <Crown className="w-5 h-5 text-yellow-500" />
                          ) : entry.rank === 2 ? (
                            <Medal className="w-5 h-5 text-gray-400" />
                          ) : entry.rank === 3 ? (
                            <Medal className="w-5 h-5 text-amber-600" />
                          ) : (
                            <span className="text-sm font-medium text-muted-foreground">#{entry.rank}</span>
                          )}
                        </div>

                        {/* Address */}
                        <div className="flex-1 min-w-0">
                          <span className={`font-mono text-sm ${isCurrentUser ? 'text-primary font-semibold' : ''}`}>
                            {isCurrentUser ? 'You' : formatAddress(entry.address)}
                          </span>
                        </div>

                        {/* Amount */}
                        <div className="text-right">
                          <span className="font-semibold text-sm">
                            ${parseFloat(entry.formattedAmount).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                          </span>
                        </div>
                      </div>
                    );
                  })}

                  {/* Show user's position if not in visible list */}
                  {userRank && userRank > (showAllLeaderboard ? 15 : 5) && (
                    <>
                      <div className="text-center text-muted-foreground text-xs py-1">• • •</div>
                      {leaderboard.filter(e => e.address.toLowerCase() === address?.toLowerCase()).map((entry) => (
                        <div
                          key={entry.address}
                          className="flex items-center gap-3 p-3 rounded-xl bg-primary/10 border border-primary/30"
                        >
                          <div className="w-8 flex justify-center">
                            <span className="text-sm font-medium">#{entry.rank}</span>
                          </div>
                          <div className="flex-1">
                            <span className="font-mono text-sm text-primary font-semibold">You</span>
                          </div>
                          <div className="text-right">
                            <span className="font-semibold text-sm">
                              ${parseFloat(entry.formattedAmount).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                            </span>
                          </div>
                        </div>
                      ))}
                    </>
                  )}

                  {/* Expand/Collapse button */}
                  {leaderboard.length > 5 && (
                    <button
                      onClick={() => setShowAllLeaderboard(!showAllLeaderboard)}
                      className="w-full flex items-center justify-center gap-2 py-3 mt-2 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-xl hover:bg-white/[0.02]"
                    >
                      {showAllLeaderboard ? (
                        <>
                          <ChevronUp className="w-4 h-4" />
                          Show less
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-4 h-4" />
                          Show all ({leaderboard.length})
                        </>
                      )}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Rewards;
