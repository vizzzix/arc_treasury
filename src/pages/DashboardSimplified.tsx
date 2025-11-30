import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAccount, useSwitchChain } from "wagmi";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { WalletConnect } from "@/components/WalletConnect";
import { UserMenu } from "@/components/UserMenu";
import { LockedPositionCard } from "@/components/LockedPositionCard";
import { LockPeriod } from "@/components/LockPeriodSelector";
import { DepositModal } from "@/components/DepositModal";
import { WithdrawModal } from "@/components/WithdrawModal";
import { LockPositionModal } from "@/components/LockPositionModal";
import { TrendingUp, Wallet as WalletIcon, Lock, User, ArrowLeft, XCircle, Shield, Trophy, DollarSign, Vault, AlertTriangle, CheckCircle2, ExternalLink, ArrowLeftRight, ArrowDownUp } from "lucide-react";
import { useUSYCPrice } from "@/hooks/useUSYCPrice";
import { useLockedPositions, useWithdrawLocked, useEarlyWithdrawLocked, useClaimLockedYield, useDepositLocked } from "@/hooks/useLockedPositions";
import { useTreasuryVault } from "@/hooks/useTreasuryVault";
import { useUSDCBalance } from "@/hooks/useUSDCBalance";
import { useTokenBalance } from "@/hooks/useTokenBalance";
import { useTVL } from "@/hooks/useTVL";
import { TOKEN_ADDRESSES, TOKEN_DECIMALS, MIGRATION_IN_PROGRESS, SHOW_MIGRATION_SUCCESS, USYC_WHITELIST_PENDING, SUPPORTED_NETWORKS } from "@/lib/constants";
import { useToast } from "@/hooks/use-toast";
import arcLogo from "@/assets/arc-logo.png";

const DashboardSimplified = () => {
  const navigate = useNavigate();
  const account = useAccount();
  const isConnected = account?.isConnected ?? false;
  const chainId = account?.chainId;
  const isArcTestnet = chainId === 5042002;
  const { switchChainAsync } = useSwitchChain();
  const { apy, price: usycPrice, lastUpdated: priceLastUpdated } = useUSYCPrice();
  const { tvl } = useTVL();
  const { toast } = useToast();

  // Get real wallet balances from Arc Testnet
  const { balance: usdcBalance, isLoading: isLoadingUSDC } = useUSDCBalance('arcTestnet');

  // Get EURC balance
  const eurcAddress = TOKEN_ADDRESSES.arcTestnet.EURC;
  const hasEURCAddress = eurcAddress && eurcAddress !== '0x0000000000000000000000000000000000000000';
  const { balance: eurcBalance, isLoading: isLoadingEURC } = useTokenBalance({
    tokenAddress: hasEURCAddress ? eurcAddress : '0x0000000000000000000000000000000000000000' as `0x${string}`,
    decimals: TOKEN_DECIMALS.EURC,
  });

  // Parse real balances
  const realUSDCBalance = parseFloat(usdcBalance) || 0;
  const realEURCBalance = hasEURCAddress && eurcBalance
    ? (parseFloat(eurcBalance) || 0)
    : 0;

  // Handle network switching
  const handleSwitchNetwork = async () => {
    try {
      await switchChainAsync?.({ chainId: 5042002 });
      toast({
        title: "Network switched",
        description: "Successfully switched to Arc Testnet",
        variant: "default",
      });
    } catch (error: any) {
      console.error('[DashboardSimplified] Network switch error:', error);
      toast({
        title: "Failed to switch network",
        description: error?.message || "Please manually switch to Arc Testnet in your wallet",
        variant: "destructive",
      });
    }
  };

  // Modal state
  const [depositModalOpen, setDepositModalOpen] = useState(false);
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
  const [lockPositionModalOpen, setLockPositionModalOpen] = useState(false);

  // Store transaction hashes for toasts
  const [lastWithdrawHash, setLastWithdrawHash] = useState<string | undefined>();
  const [lastEarlyWithdrawHash, setLastEarlyWithdrawHash] = useState<string | undefined>();

  // Fetch real locked positions from contract
  const { positions: lockedPositions, isLoading: isLoadingPositions, refetch: refetchPositions } = useLockedPositions(
    account.address as `0x${string}` | undefined
  );

  // Hooks for deposits, withdraw and claim
  const { depositLockedUSDC, depositLockedEURC, isPending: isDepositing, isSuccess: depositSuccess } = useDepositLocked();
  const { withdrawLocked, isPending: isWithdrawing, isSuccess: withdrawSuccess, hash: withdrawHash } = useWithdrawLocked();
  const { earlyWithdrawLocked, isPending: isEarlyWithdrawing, isSuccess: earlyWithdrawSuccess, hash: earlyWithdrawHash } = useEarlyWithdrawLocked();
  const { claimYield, isPending: isClaiming, isSuccess: claimSuccess } = useClaimLockedYield();

  // Hook for flexible deposits/withdrawals
  const {
    deposit,
    withdraw,
    userShares,
    userShareValue,
    pricePerShare,
    userEURCShares,
    userEURCShareValue,
    eurcPricePerShare,
    userSharesRaw,
    userEURCSharesRaw,
    flexibleYield,
    isPending: isFlexiblePending,
    isConfirming: isFlexibleConfirming,
    refetchAll,
    getFreshUserShares
  } = useTreasuryVault();

  // Handle deposit success (locked) - refetch data when tx is mined
  useEffect(() => {
    if (depositSuccess) {
      refetchPositions();
      refetchAll();
    }
  }, [depositSuccess]);

  // Handle withdraw success
  useEffect(() => {
    if (withdrawSuccess && lastWithdrawHash) {
      const explorerUrl = `${SUPPORTED_NETWORKS.arcTestnet.explorerUrl}/tx/${lastWithdrawHash}`;
      toast({
        title: (
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            <span>Withdrawal Successful</span>
          </div>
        ) as unknown as string,
        description: (
          <div className="space-y-1.5">
            <p>Your locked position has been withdrawn.</p>
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline text-xs"
            >
              View transaction
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        ) as unknown as string,
      });
      refetchPositions();
      setLastWithdrawHash(undefined);
    }
  }, [withdrawSuccess, lastWithdrawHash]);

  // Handle early withdraw success
  useEffect(() => {
    if (earlyWithdrawSuccess && lastEarlyWithdrawHash) {
      const explorerUrl = `${SUPPORTED_NETWORKS.arcTestnet.explorerUrl}/tx/${lastEarlyWithdrawHash}`;
      toast({
        title: (
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-orange-500" />
            <span>Early Withdrawal Successful</span>
          </div>
        ) as unknown as string,
        description: (
          <div className="space-y-1.5">
            <p>Withdrawn with 25% penalty applied.</p>
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline text-xs"
            >
              View transaction
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        ) as unknown as string,
        variant: "default",
      });
      refetchPositions();
      setLastEarlyWithdrawHash(undefined);
    }
  }, [earlyWithdrawSuccess, lastEarlyWithdrawHash]);

  // Handle claim success
  useEffect(() => {
    if (claimSuccess) {
      toast({
        title: "Yield Claimed",
        description: "Your yield has been claimed successfully.",
      });
      refetchPositions();
    }
  }, [claimSuccess]);

  // Modal handlers
  const handleDeposit = async (amount: string, tokenType: "USDC" | "EURC"): Promise<string | undefined> => {
    const txHash = await deposit(amount, tokenType);
    refetchAll();
    return txHash;
  };

  const handleWithdraw = async (amount: string, tokenType: "USDC" | "EURC"): Promise<string | undefined> => {
    // Convert dollar amount to shares
    // The modal passes dollar values but withdraw() expects shares
    const dollarAmount = parseFloat(amount);
    const currentShareValue = tokenType === "USDC" ? userShareValue : userEURCShareValue;
    const currentPrice = tokenType === "USDC" ? pricePerShare : eurcPricePerShare;

    // If withdrawing full balance (MAX button), use raw bigint shares to avoid rounding to 0
    const fullBalance = parseFloat(currentShareValue) || 0;

    if (Math.abs(dollarAmount - fullBalance) < 0.01) {
      // User wants to withdraw everything - read FRESH shares directly from contract
      // This prevents race conditions where cached shares are stale after a recent deposit
      const freshShares = await getFreshUserShares(tokenType);
      console.log('[handleWithdraw] Full withdrawal, using fresh shares from contract:', freshShares.toString());

      if (freshShares === 0n) {
        throw new Error('No shares available to withdraw');
      }

      const txHash = await withdraw(freshShares, tokenType);
      refetchAll();
      return txHash;
    } else {
      // Partial withdrawal - convert dollars to shares
      // Use floor rounding to avoid withdrawing more than available
      const price = parseFloat(currentPrice) || 1;
      const sharesNum = dollarAmount / price;
      const floored = Math.floor(sharesNum * 1e6) / 1e6;
      const sharesToWithdraw = floored.toFixed(6);
      console.log('[handleWithdraw] Partial withdrawal, shares:', sharesToWithdraw);
      const txHash = await withdraw(sharesToWithdraw, tokenType);
      refetchAll();
      return txHash;
    }
  };

  const handleLockPosition = async (amount: string, tokenType: "USDC" | "EURC", lockPeriod: 1 | 3 | 12): Promise<string | undefined> => {
    let txHash: string | undefined;
    if (tokenType === "USDC") {
      txHash = await depositLockedUSDC(amount, lockPeriod);
    } else {
      txHash = await depositLockedEURC(amount, lockPeriod);
    }
    return txHash;
  };

  // Flexible balance from contract
  const flexibleBalance = {
    usdc: parseFloat(userShareValue) || 0,
    eurc: parseFloat(userEURCShareValue) || 0,
  };

  // Calculate totals
  const totalFlexible = flexibleBalance.usdc + flexibleBalance.eurc;
  const totalLocked = lockedPositions.reduce((sum, pos) => sum + pos.amount, 0);
  const lockedYield = lockedPositions.reduce((sum, pos) => sum + pos.earnedYield, 0);
  // Total yield = flexible yield (from share value growth) + locked yield (from locked positions)
  const totalYield = (flexibleYield || 0) + lockedYield;
  const totalBalance = totalFlexible + totalLocked + lockedYield;

  return (
    <div className="min-h-screen bg-background">
      {/* Header with Profile button */}
      <header className="border-b border-border/30 sticky top-0 bg-background/80 backdrop-blur-lg z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Left: Logo & Title */}
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/")}
                className="hover:bg-card"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <img src={arcLogo} alt="Arc Treasury" className="w-8 h-8" />
              <h1 className="text-2xl font-bold">Dashboard</h1>
            </div>

            {/* Right: Navigation & Wallet */}
            <div className="flex items-center gap-2 sm:gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/swap")}
                className="hidden sm:flex gap-2 border-white/10 bg-white/5 hover:bg-white/10"
              >
                <ArrowDownUp className="w-4 h-4" />
                Swap
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/bridge")}
                className="hidden sm:flex gap-2 border-white/10 bg-white/5 hover:bg-white/10"
              >
                <ArrowLeftRight className="w-4 h-4" />
                Bridge
              </Button>
              {isConnected ? (
                <UserMenu />
              ) : (
                <WalletConnect />
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Migration Success Banner */}
      {SHOW_MIGRATION_SUCCESS && (
        <div className="bg-green-500/10 border-b border-green-500/30">
          <div className="container mx-auto px-6 py-4">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 text-green-600 dark:text-green-400 text-center">
              <Shield className="w-5 h-5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold mb-1">
                  Migration Complete! Thank you for testing!
                </p>
                <p className="text-xs text-muted-foreground">
                  All funds from V4 have been returned to your wallets. The new V5 vault is now live with improved features. Thank you for your patience and support!
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* USYC Whitelist Pending Banner */}
      {USYC_WHITELIST_PENDING && (
        <div className="bg-yellow-500/10 border-b border-yellow-500/30">
          <div className="container mx-auto px-6 py-4">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 text-yellow-600 dark:text-yellow-400 text-center">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold mb-1">
                  Awaiting USYC Whitelist Approval
                </p>
                <p className="text-xs text-muted-foreground">
                  V5 vault is deployed but waiting for Circle/Hashnote to add it to the USYC allowlist. Deposits and locks are temporarily disabled. Withdrawals remain available.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="container mx-auto px-6 py-12">
        {/* Wrong Network Warning */}
        {!isArcTestnet && isConnected && (
          <div className="max-w-7xl mx-auto mb-8">
            <Card className="p-4 border-red-500/50 bg-red-500/10 animate-in fade-in slide-in-from-top-2 duration-500">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="flex items-center gap-3 flex-1">
                  <div className="p-2 rounded-lg bg-red-500/20 border border-red-500/30 animate-pulse">
                    <XCircle className="w-5 h-5 text-red-500" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-red-500">Wrong Network</h3>
                    <p className="text-xs text-muted-foreground">
                      Switch to Arc Testnet to use Treasury
                    </p>
                  </div>
                </div>
                <Button
                  onClick={handleSwitchNetwork}
                  className="bg-red-600 hover:bg-red-700 text-white text-sm h-9"
                  size="sm"
                >
                  Switch Network
                </Button>
              </div>
            </Card>
          </div>
        )}


        {!isConnected ? (
          <div className="max-w-4xl mx-auto space-y-8">
            {/* Hero Section */}
            <div className="text-center space-y-4">
              <div className="flex justify-center mb-6">
                <div className="p-6 rounded-full bg-primary/10 border-2 border-primary/30">
                  <Vault className="w-16 h-16 text-primary" />
                </div>
              </div>
              <h2 className="text-4xl font-bold">Treasury Vault</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Earn real yield from US Treasury Bills through USYC. Deposit stablecoins and watch your savings grow.
              </p>
            </div>

            {/* Features Grid */}
            <div className="grid md:grid-cols-3 gap-6">
              <Card className="p-6 text-center border-border/50">
                <div className="p-4 rounded-full bg-green-500/10 w-fit mx-auto mb-4">
                  <DollarSign className="w-8 h-8 text-green-500" />
                </div>
                <h3 className="font-semibold mb-2">Real Yield</h3>
                <p className="text-sm text-muted-foreground">
                  ~{apy.toFixed(1)}% APY from US Treasury Bills via USYC
                </p>
              </Card>

              <Card className="p-6 text-center border-border/50">
                <div className="p-4 rounded-full bg-blue-500/10 w-fit mx-auto mb-4">
                  <Shield className="w-8 h-8 text-blue-500" />
                </div>
                <h3 className="font-semibold mb-2">Secure & Transparent</h3>
                <p className="text-sm text-muted-foreground">
                  Fully on-chain. Withdraw anytime.
                </p>
              </Card>

              <Card className="p-6 text-center border-border/50">
                <div className="p-4 rounded-full bg-purple-500/10 w-fit mx-auto mb-4">
                  <Trophy className="w-8 h-8 text-purple-500" />
                </div>
                <h3 className="font-semibold mb-2">Earn Points</h3>
                <p className="text-sm text-muted-foreground">
                  1 point per $1 deposited per day
                </p>
              </Card>
            </div>

            {/* How it Works */}
            <Card className="p-8 border-border/50">
              <h3 className="text-xl font-semibold mb-6 text-center">How It Works</h3>
              <div className="grid md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="w-10 h-10 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center mx-auto mb-3">1</div>
                  <p className="text-sm font-medium">Bridge USDC</p>
                  <p className="text-xs text-muted-foreground">From Ethereum Sepolia</p>
                </div>
                <div className="text-center">
                  <div className="w-10 h-10 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center mx-auto mb-3">2</div>
                  <p className="text-sm font-medium">Deposit</p>
                  <p className="text-xs text-muted-foreground">Into Treasury Vault</p>
                </div>
                <div className="text-center">
                  <div className="w-10 h-10 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center mx-auto mb-3">3</div>
                  <p className="text-sm font-medium">Earn Yield</p>
                  <p className="text-xs text-muted-foreground">From USYC T-Bills</p>
                </div>
                <div className="text-center">
                  <div className="w-10 h-10 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center mx-auto mb-3">4</div>
                  <p className="text-sm font-medium">Withdraw</p>
                  <p className="text-xs text-muted-foreground">Anytime you want</p>
                </div>
              </div>
            </Card>

            {/* Connect CTA */}
            <Card className="p-8 text-center border-primary/30 bg-gradient-to-br from-primary/10 to-primary/5">
              <WalletIcon className="w-12 h-12 mx-auto mb-4 text-primary" />
              <h3 className="text-xl font-semibold mb-2">Connect to Get Started</h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Connect your wallet to deposit funds and start earning yield from US Treasury Bills.
              </p>
              <WalletConnect />
            </Card>
          </div>
        ) : (
          <div className="max-w-7xl mx-auto space-y-8">
            {/* Quick Stats Banner */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
              <Card className="p-3 sm:p-6 border-border/50 bg-gradient-to-br from-card to-primary/5">
                <div className="flex items-center justify-between mb-1 sm:mb-2">
                  <span className="text-xs sm:text-sm text-muted-foreground">
                    Total Balance
                  </span>
                  <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4 text-primary" />
                </div>
                <p className="text-xl sm:text-3xl font-bold text-primary">
                  ${Math.floor(totalBalance).toLocaleString("en-US")}
                </p>
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 hidden sm:block">
                  Flexible + Locked + Yield
                </p>
              </Card>

              <Card className="p-3 sm:p-6 border-border/50">
                <div className="flex items-center justify-between mb-1 sm:mb-2">
                  <span className="text-xs sm:text-sm text-muted-foreground">
                    Total Yield
                  </span>
                  <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4 text-green-500" />
                </div>
                <p className="text-xl sm:text-3xl font-bold text-green-500">
                  {totalYield >= 0 ? "+" : ""}${Math.abs(totalYield).toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: totalYield > 0 && totalYield < 0.01 ? 4 : 2,
                  })}
                </p>
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 hidden sm:block">
                  Flex + Locked positions
                </p>
              </Card>

              <Card className="p-3 sm:p-6 border-border/50">
                <div className="flex items-center justify-between mb-1 sm:mb-2">
                  <span className="text-xs sm:text-sm text-muted-foreground">
                    Avg APY
                  </span>
                  <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4 text-green-500" />
                </div>
                <p className="text-xl sm:text-3xl font-bold text-green-500">
                  {lockedPositions.length > 0
                    ? (
                        lockedPositions.reduce(
                          (sum, pos) => sum + pos.currentAPY,
                          0
                        ) / lockedPositions.length
                      ).toFixed(2)
                    : apy.toFixed(2)}
                  %
                </p>
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 hidden sm:block">
                  Weighted average
                </p>
              </Card>

              <Card className="p-3 sm:p-6 border-border/50">
                <div className="flex items-center justify-between mb-1 sm:mb-2">
                  <span className="text-xs sm:text-sm text-muted-foreground">
                    Total TVL
                  </span>
                  <Vault className="w-3 h-3 sm:w-4 sm:h-4 text-primary" />
                </div>
                <p className="text-xl sm:text-3xl font-bold">
                  ${Math.floor(tvl).toLocaleString("en-US")}
                </p>
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 hidden sm:block">
                  All depositors
                </p>
              </Card>
            </div>

            {/* Flexible Balance + Bridge CTA Row */}
            <div className="grid md:grid-cols-2 gap-4">
              {/* Flexible Balance */}
              <Card className="p-4 border-border/50">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold">Flexible</h2>
                    <span className="text-[10px] text-green-500 bg-green-500/10 px-1.5 py-0.5 rounded">{apy.toFixed(2)}%</span>
                  </div>
                  <div className="flex gap-1.5">
                    <Button
                      onClick={() => setDepositModalOpen(true)}
                      size="sm"
                      className="h-7 text-xs px-2.5"
                      disabled={MIGRATION_IN_PROGRESS || USYC_WHITELIST_PENDING}
                    >
                      Deposit
                    </Button>
                    <Button
                      onClick={() => setWithdrawModalOpen(true)}
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs px-2.5"
                    >
                      Withdraw
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 rounded bg-background/60 border border-border/40">
                    <span className="text-[10px] text-muted-foreground">USDC</span>
                    <p className="text-lg font-bold">${Math.floor(flexibleBalance.usdc).toLocaleString("en-US")}</p>
                  </div>
                  <div className="p-2 rounded bg-background/60 border border-border/40">
                    <span className="text-[10px] text-muted-foreground">EURC</span>
                    <p className="text-lg font-bold">€{Math.floor(flexibleBalance.eurc).toLocaleString("en-US")}</p>
                  </div>
                </div>
              </Card>

              {/* Wallet */}
              <Card className="p-4 border-border/50">
                <div className="flex items-center gap-2 mb-3">
                  <WalletIcon className="w-4 h-4 text-muted-foreground" />
                  <h2 className="text-base font-bold">Wallet</h2>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 rounded bg-background/60 border border-border/40">
                      <span className="text-[10px] text-muted-foreground">USDC</span>
                      <p className="text-lg font-bold">${realUSDCBalance.toFixed(2)}</p>
                    </div>
                    <div className="p-2 rounded bg-background/60 border border-border/40">
                      <span className="text-[10px] text-muted-foreground">EURC</span>
                      <p className="text-lg font-bold">€{realEURCBalance.toFixed(2)}</p>
                    </div>
                </div>
              </Card>
            </div>

            {/* Locked Positions Section */}
            <div>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold mb-1">Locked Positions</h2>
                  <p className="text-sm text-muted-foreground">
                    {lockedPositions.length} active lock
                    {lockedPositions.length !== 1 ? "s" : ""} • More Points
                    for longer locks
                  </p>
                </div>
                <Button
                  onClick={() => setLockPositionModalOpen(true)}
                  className="bg-primary hover:bg-primary/90 gap-2"
                  disabled={MIGRATION_IN_PROGRESS || USYC_WHITELIST_PENDING}
                  title={MIGRATION_IN_PROGRESS ? "Locks disabled during migration" : USYC_WHITELIST_PENDING ? "Locks disabled - awaiting USYC whitelist" : undefined}
                >
                  <Lock className="w-4 h-4" />
                  New Lock Position
                </Button>
              </div>

              {lockedPositions.length === 0 ? (
                <Card className="p-12 text-center border-border/50">
                  <Lock className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-xl font-semibold mb-2">
                    No Locked Positions Yet
                  </h3>
                  <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                    Lock your stablecoins for fixed periods to earn more Points.
                    Choose from 1 month, 3 months, or 12 months.
                  </p>
                  <Button
                    onClick={() => setLockPositionModalOpen(true)}
                    className="bg-primary hover:bg-primary/90"
                    disabled={MIGRATION_IN_PROGRESS || USYC_WHITELIST_PENDING}
                    title={MIGRATION_IN_PROGRESS ? "Locks disabled during migration" : USYC_WHITELIST_PENDING ? "Locks disabled - awaiting USYC whitelist" : undefined}
                  >
                    Create Your First Lock
                  </Button>
                </Card>
              ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {lockedPositions.map((position, index) => {
                    // Convert lock period months to LockPeriod enum
                    let lockPeriod: LockPeriod;
                    if (position.lockPeriodMonths === 1) {
                      lockPeriod = LockPeriod.ONE_MONTH;
                    } else if (position.lockPeriodMonths === 3) {
                      lockPeriod = LockPeriod.THREE_MONTH;
                    } else {
                      lockPeriod = LockPeriod.TWELVE_MONTH;
                    }

                    return (
                      <LockedPositionCard
                        key={position.id}
                        position={{
                          ...position,
                          lockPeriod,
                        }}
                        isWithdrawing={isWithdrawing}
                        isEarlyWithdrawing={isEarlyWithdrawing}
                        isClaiming={isClaiming}
                        onWithdraw={async () => {
                          const hash = await withdrawLocked(position.arrayIndex);
                          setLastWithdrawHash(hash);
                        }}
                        onEarlyWithdraw={async () => {
                          const hash = await earlyWithdrawLocked(position.arrayIndex);
                          setLastEarlyWithdrawHash(hash);
                        }}
                        onClaimYield={() => {
                          claimYield(position.arrayIndex);
                        }}
                      />
                    );
                  })}
                </div>
              )}
            </div>

            {/* USYC Info & Lock Periods - Two Info Cards */}
            <div className="grid md:grid-cols-2 gap-4">
              {/* USYC Yield Token */}
              <Card className="p-4 border-green-500/20 bg-gradient-to-br from-green-500/5 to-transparent">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="w-4 h-4 text-green-500" />
                  <h3 className="text-base font-bold text-green-500">USYC Yield Token</h3>
                </div>
                <div className="flex items-center gap-4 mb-3">
                  <div>
                    <span className="text-xs text-muted-foreground">Price</span>
                    <p className="text-xl font-bold text-green-500">${usycPrice > 0 ? usycPrice.toFixed(4) : "..."}</p>
                  </div>
                  <div className="h-8 w-px bg-border/40" />
                  <div>
                    <span className="text-xs text-muted-foreground">APY</span>
                    <p className="text-xl font-bold text-green-500">{apy.toFixed(2)}%</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  USYC is a yield-bearing stablecoin backed by short-term US Treasury Bills.
                  The APY reflects real-time NAV price changes and updates hourly.
                </p>
              </Card>

              {/* Lock Periods & Points */}
              <Card className="p-4 border-border/50">
                <div className="flex items-center gap-2 mb-3">
                  <Lock className="w-4 h-4 text-primary" />
                  <h3 className="text-base font-bold">Lock Periods & Points</h3>
                </div>
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {[
                    { period: "Flex", mult: "1x" },
                    { period: "1M", mult: "1.5x" },
                    { period: "3M", mult: "2x" },
                    { period: "12M", mult: "3x", highlight: true },
                  ].map((item) => (
                    <div key={item.period} className={`text-center p-2 rounded-lg ${item.highlight ? 'bg-primary/10 border border-primary/30' : 'bg-white/5'}`}>
                      <p className="text-[10px] text-muted-foreground mb-0.5">{item.period}</p>
                      <p className={`text-sm font-bold ${item.highlight ? 'text-primary' : ''}`}>{item.mult}</p>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  All periods earn ~{apy.toFixed(2)}% APY. Longer locks multiply your Points for future ARC token rewards. Early unlock penalty: 25%.
                </p>
              </Card>
            </div>
          </div>
        )}
      </main>

      {/* Modals */}
      <DepositModal
        open={depositModalOpen}
        onOpenChange={setDepositModalOpen}
        onDeposit={handleDeposit}
        isPending={isFlexiblePending || isFlexibleConfirming}
      />

      <WithdrawModal
        open={withdrawModalOpen}
        onOpenChange={setWithdrawModalOpen}
        usdcBalance={flexibleBalance.usdc}
        eurcBalance={flexibleBalance.eurc}
        onWithdraw={handleWithdraw}
        isPending={isFlexiblePending || isFlexibleConfirming}
      />

      <LockPositionModal
        open={lockPositionModalOpen}
        onOpenChange={setLockPositionModalOpen}
        onLock={handleLockPosition}
        isPending={isDepositing}
      />
    </div>
  );
};

export default DashboardSimplified;
