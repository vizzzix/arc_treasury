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
import { TrendingUp, Wallet as WalletIcon, Lock, User, ArrowLeft, XCircle, Info, X, ArrowRightLeft } from "lucide-react";
import { useUSYCPrice } from "@/hooks/useUSYCPrice";
import { useLockedPositions, useWithdrawLocked, useEarlyWithdrawLocked, useClaimLockedYield, useDepositLocked } from "@/hooks/useLockedPositions";
import { useTreasuryVault } from "@/hooks/useTreasuryVault";
import { useUSDCBalance } from "@/hooks/useUSDCBalance";
import { useTokenBalance } from "@/hooks/useTokenBalance";
import { TOKEN_ADDRESSES, TOKEN_DECIMALS } from "@/lib/constants";
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
  const { toast } = useToast();

  // Bridge card visibility state
  const [showBridgeCard, setShowBridgeCard] = useState(true);

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

  // Calculate if balance is critically low (< $1)
  const isCriticallyLow = useMemo(() => {
    return realUSDCBalance < 1 && realEURCBalance < 1;
  }, [realUSDCBalance, realEURCBalance]);

  const handleCloseBridgeCard = () => {
    setShowBridgeCard(false);
  };

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

  // Fetch real locked positions from contract
  const { positions: lockedPositions, isLoading: isLoadingPositions, refetch: refetchPositions } = useLockedPositions(
    account.address as `0x${string}` | undefined
  );

  // Hooks for deposits, withdraw and claim
  const { depositLockedUSDC, depositLockedEURC, isPending: isDepositing, isSuccess: depositSuccess } = useDepositLocked();
  const { withdrawLocked, isPending: isWithdrawing, isSuccess: withdrawSuccess } = useWithdrawLocked();
  const { earlyWithdrawLocked, isPending: isEarlyWithdrawing, isSuccess: earlyWithdrawSuccess } = useEarlyWithdrawLocked();
  const { claimYield, isPending: isClaiming, isSuccess: claimSuccess } = useClaimLockedYield();

  // Hook for flexible deposits/withdrawals
  const {
    deposit,
    withdraw,
    userShareValue,
    userEURCShareValue,
    isPending: isFlexiblePending,
    isConfirming: isFlexibleConfirming,
    refetchAll
  } = useTreasuryVault();

  // Handle deposit success (locked)
  useEffect(() => {
    if (depositSuccess) {
      toast({
        title: "Lock Position Created",
        description: "Your deposit has been locked successfully.",
      });
      refetchPositions();
      refetchAll();
    }
  }, [depositSuccess]);

  // Handle withdraw success
  useEffect(() => {
    if (withdrawSuccess) {
      toast({
        title: "Withdrawal Successful",
        description: "Your locked position has been withdrawn.",
      });
      refetchPositions();
    }
  }, [withdrawSuccess]);

  // Handle early withdraw success
  useEffect(() => {
    if (earlyWithdrawSuccess) {
      toast({
        title: "Early Withdrawal Successful",
        description: "Withdrawn with 25% penalty applied.",
        variant: "default",
      });
      refetchPositions();
    }
  }, [earlyWithdrawSuccess]);

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
  const handleDeposit = async (amount: string, tokenType: "USDC" | "EURC") => {
    await deposit(amount, tokenType);
    refetchAll();
  };

  const handleWithdraw = async (amount: string, tokenType: "USDC" | "EURC") => {
    await withdraw(amount, tokenType);
    refetchAll();
  };

  const handleLockPosition = async (amount: string, tokenType: "USDC" | "EURC", lockPeriod: 1 | 3 | 12) => {
    if (tokenType === "USDC") {
      await depositLockedUSDC(amount, lockPeriod);
    } else {
      await depositLockedEURC(amount, lockPeriod);
    }
    refetchPositions();
  };

  // Flexible balance from contract
  const flexibleBalance = {
    usdc: parseFloat(userShareValue) || 0,
    eurc: parseFloat(userEURCShareValue) || 0,
  };

  // Calculate totals
  const totalFlexible = flexibleBalance.usdc + flexibleBalance.eurc;
  const totalLocked = lockedPositions.reduce((sum, pos) => sum + pos.amount, 0);
  const totalYield = lockedPositions.reduce((sum, pos) => sum + pos.earnedYield, 0);
  const totalBalance = totalFlexible + totalLocked + totalYield;

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
            <div className="flex items-center gap-3">
              {isConnected ? (
                <UserMenu />
              ) : (
                <WalletConnect />
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-12">
        {/* Wrong Network Warning */}
        {!isArcTestnet && isConnected && (
          <div className="max-w-7xl mx-auto mb-8">
            <Card className="p-6 border-red-500/50 bg-red-500/10 animate-in fade-in slide-in-from-top-2 duration-500">
              <div className="flex flex-col md:flex-row items-start gap-6">
                <div className="flex items-start gap-4 flex-1">
                  <div className="p-3 rounded-lg bg-red-500/20 border border-red-500/30 animate-pulse">
                    <XCircle className="w-6 h-6 text-red-500" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold mb-2 text-red-600">⚠️ Wrong Network Detected</h3>
                    <p className="text-sm text-muted-foreground mb-2">
                      You're currently on <span className="font-mono font-semibold text-red-600">Chain ID: {chainId}</span>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Arc Treasury only works on <span className="font-semibold text-primary">Arc Testnet (Chain ID: 5042002)</span>.
                    </p>
                  </div>
                </div>
                <Button
                  onClick={handleSwitchNetwork}
                  className="bg-red-600 hover:bg-red-700 text-white font-semibold shadow-lg whitespace-nowrap"
                  size="lg"
                >
                  Switch to Arc Testnet
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* Bridge Call-to-Action Card - Show when balance is low */}
        {showBridgeCard && isArcTestnet && isConnected && !isLoadingUSDC && !isLoadingEURC && (realUSDCBalance < 10 || realEURCBalance < 10) && (
          <div className="max-w-7xl mx-auto mb-8">
            <Card className="p-6 bg-gradient-to-r border-primary/20 from-primary/5 to-blue-500/5 relative animate-in fade-in slide-in-from-top-2 duration-500">
              {/* Close button - always visible */}
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 h-6 w-6 text-muted-foreground hover:text-foreground"
                onClick={handleCloseBridgeCard}
              >
                <X className="w-4 h-4" />
              </Button>
              <div className="flex flex-col md:flex-row items-start gap-6 pr-8">
                <div className="flex items-start gap-4 flex-1">
                  <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                    <Info className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1 space-y-3">
                    <div>
                      <h3 className="text-lg font-semibold mb-2">
                        Need USDC or EURC on Arc Testnet?
                      </h3>
                      <p className="text-sm text-muted-foreground mb-2">
                        You have <span className="font-semibold">${realUSDCBalance.toFixed(2)} USDC</span> and <span className="font-semibold">€{realEURCBalance.toFixed(2)} EURC</span> available.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        <span className="font-semibold">Step 1:</span> Get free testnet USDC from{" "}
                        <a
                          href="https://faucet.circle.com/"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline inline-flex items-center gap-1"
                        >
                          Circle Faucet
                          <ArrowRightLeft className="w-3 h-3" />
                        </a>
                      </p>
                      <p className="text-sm text-muted-foreground">
                        <span className="font-semibold">Step 2:</span> Bridge from Ethereum Sepolia to Arc using the button below
                      </p>
                    </div>
                  </div>
                </div>
                <Button
                  onClick={() => navigate("/bridge")}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold whitespace-nowrap self-start md:self-center"
                >
                  <ArrowRightLeft className="w-4 h-4 mr-2" />
                  Bridge to Arc
                </Button>
              </div>
            </Card>
          </div>
        )}

        {!isConnected ? (
          <div className="max-w-md mx-auto mt-20 text-center">
            <Card className="p-8">
              <WalletIcon className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h2 className="text-xl font-semibold mb-2">
                Connect Your Wallet
              </h2>
              <p className="text-muted-foreground mb-6">
                Please connect your wallet to view your treasury dashboard.
              </p>
              <WalletConnect />
            </Card>
          </div>
        ) : (
          <div className="max-w-7xl mx-auto space-y-8">
            {/* Quick Stats Banner */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="p-6 border-border/50 bg-gradient-to-br from-card to-primary/5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">
                    Total Balance
                  </span>
                  <TrendingUp className="w-4 h-4 text-primary" />
                </div>
                <p className="text-3xl font-bold text-primary">
                  ${totalBalance.toLocaleString("en-US")}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Flexible + Locked + Yield
                </p>
              </Card>

              <Card className="p-6 border-border/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">
                    Total Yield
                  </span>
                  <TrendingUp className="w-4 h-4 text-green-500" />
                </div>
                <p className="text-3xl font-bold text-green-500">
                  {totalYield >= 0 ? "+" : ""}${Math.abs(totalYield).toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Earned across all locks
                </p>
              </Card>

              <Card className="p-6 border-border/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">
                    Active Locks
                  </span>
                  <Lock className="w-4 h-4 text-primary" />
                </div>
                <p className="text-3xl font-bold">
                  {lockedPositions.length}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Positions locked
                </p>
              </Card>

              <Card className="p-6 border-border/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">
                    Avg APY
                  </span>
                  <TrendingUp className="w-4 h-4 text-green-500" />
                </div>
                <p className="text-3xl font-bold text-green-500">
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
                <p className="text-xs text-muted-foreground mt-1">
                  Weighted average
                </p>
              </Card>
            </div>

            {/* Flexible Balance Section */}
            <Card className="p-8 border-border/50">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold mb-1">Flexible Balance</h2>
                  <p className="text-sm text-muted-foreground">
                    Withdraw anytime • {apy.toFixed(2)}% APY
                  </p>
                </div>
                <div className="flex gap-3">
                  <Button
                    onClick={() => setDepositModalOpen(true)}
                    className="bg-primary hover:bg-primary/90"
                  >
                    Deposit
                  </Button>
                  <Button
                    onClick={() => setWithdrawModalOpen(true)}
                    variant="outline"
                    className="border-primary/30 hover:bg-primary/10"
                  >
                    Withdraw
                  </Button>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-6 rounded-lg bg-background/60 border border-border/40">
                  <span className="text-sm text-muted-foreground block mb-2">
                    USDC
                  </span>
                  <p className="text-3xl font-bold mb-1">
                    ${flexibleBalance.usdc.toLocaleString("en-US")}
                  </p>
                  <p className="text-sm text-green-500">
                    {apy.toFixed(2)}% APY
                  </p>
                </div>

                <div className="p-6 rounded-lg bg-background/60 border border-border/40">
                  <span className="text-sm text-muted-foreground block mb-2">
                    EURC
                  </span>
                  <p className="text-3xl font-bold mb-1">
                    €{flexibleBalance.eurc.toLocaleString("en-US")}
                  </p>
                  <p className="text-sm text-green-500">
                    {apy.toFixed(2)}% APY
                  </p>
                </div>
              </div>
            </Card>

            {/* Locked Positions Section */}
            <div>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold mb-1">Locked Positions</h2>
                  <p className="text-sm text-muted-foreground">
                    {lockedPositions.length} active lock
                    {lockedPositions.length !== 1 ? "s" : ""} • Higher APY
                    for longer locks
                  </p>
                </div>
                <Button
                  onClick={() => setLockPositionModalOpen(true)}
                  className="bg-primary hover:bg-primary/90 gap-2"
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
                    Lock your stablecoins for fixed periods to earn higher APY.
                    Choose from 1 month, 3 months, or 12 months.
                  </p>
                  <Button
                    onClick={() => setLockPositionModalOpen(true)}
                    className="bg-primary hover:bg-primary/90"
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
                        onWithdraw={() => {
                          withdrawLocked(position.arrayIndex);
                        }}
                        onEarlyWithdraw={() => {
                          earlyWithdrawLocked(position.arrayIndex);
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

            {/* USYC Info & Lock Periods Card */}
            <Card className="p-6 border-primary/30 bg-gradient-to-r from-green-500/5 to-primary/5">
              <div className="grid md:grid-cols-2 gap-8 md:divide-x divide-border/50">
                {/* Left: USYC Yield Token */}
                <div className="flex items-start gap-4 md:pr-4">
                  <div className="p-2 rounded-lg bg-green-500/10 border border-green-500/20">
                    <TrendingUp className="w-5 h-5 text-green-500" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold mb-2 text-green-600 dark:text-green-400">
                      USYC Yield Token
                    </h3>
                    <div className="grid grid-cols-2 gap-4 mb-3">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Current Price</p>
                        <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                          ${usycPrice > 0 ? usycPrice.toFixed(4) : "Loading..."}
                        </p>
                        {usycPrice > 0 && priceLastUpdated && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Updated {(() => {
                              // Handle Unix timestamp (seconds) or ISO string
                              const timestamp = Number(priceLastUpdated);
                              const date = !isNaN(timestamp) ? new Date(timestamp * 1000) : new Date(priceLastUpdated);
                              const diffMins = Math.floor((Date.now() - date.getTime()) / 60000);
                              if (diffMins < 1) return 'just now';
                              if (diffMins < 60) return `${diffMins}m ago`;
                              return `${Math.floor(diffMins / 60)}h ago`;
                            })()}
                          </p>
                        )}
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Current APY</p>
                        <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                          {apy.toFixed(2)}%
                        </p>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      USYC is a yield-bearing stablecoin backed by short-term US Treasury bills.
                      The APY is calculated from real-time NAV price changes and updates hourly.
                    </p>
                  </div>
                </div>

                {/* Right: Lock Periods & APY */}
                <div className="flex items-start gap-4 md:pl-4">
                  <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
                    <TrendingUp className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold mb-2">
                      About Lock Periods & APY
                    </h3>
                    <div className="space-y-1 text-sm text-muted-foreground">
                      <p>• Flexible: {apy.toFixed(2)}% APY - Withdraw anytime</p>
                      <p>
                        • 1 Month Lock: {(apy * 1.17).toFixed(2)}% APY - Locked for 30 days (+17%
                        boost)
                      </p>
                      <p>
                        • 3 Months Lock: {(apy * 1.35).toFixed(2)}% APY - Locked for 90 days (+35%
                        boost)
                      </p>
                      <p>
                        • 12 Months Lock: {(apy * 1.69).toFixed(2)}% APY - Locked for 365 days (+69%
                        boost)
                      </p>
                    </div>
                    <p className="text-sm text-muted-foreground mt-3">
                      Yields are simulated based on USYC NAV oracle on testnet.
                      On mainnet, real USYC will be used.
                    </p>
                  </div>
                </div>
              </div>
            </Card>
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
