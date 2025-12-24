import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ArrowLeft, ArrowDownUp, RefreshCw, Info, Loader2, Plus, Minus, Droplets, CheckCircle2, XCircle, ExternalLink, Settings2, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAccount, useSwitchChain } from "wagmi";
import { useToast } from "@/hooks/use-toast";
import { WalletConnect } from "@/components/WalletConnect";
import { UserMenu } from "@/components/UserMenu";
import { useSwapPool } from "@/hooks/useSwapPool";
import { useUSDCBalance } from "@/hooks/useUSDCBalance";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import { LiveSwapFeed } from "@/components/LiveSwapFeed";

const formatBalance = (balance: string | number) => {
  const num = typeof balance === 'string' ? parseFloat(balance) : balance;
  if (isNaN(num)) return String(balance);
  // Show decimals for small amounts (< $100), hide for large
  if (num < 100) {
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return Math.floor(num).toLocaleString('en-US');
};

type TabType = 'swap' | 'pool';

const Swap = () => {
  const navigate = useNavigate();
  const account = useAccount();
  const isConnected = account?.isConnected ?? false;
  const address = account?.address;
  const chainId = account?.chainId;
  const isArcTestnet = chainId === 5042002;
  const { switchChainAsync } = useSwitchChain();
  const { toast } = useToast();

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
      console.error('[Swap] Network switch error:', error);
      toast({
        title: "Failed to switch network",
        description: error?.message || "Please manually switch to Arc Testnet in your wallet",
        variant: "destructive",
      });
    }
  };

  // Get native USDC balance on Arc Testnet
  const { balance: usdcBalance, isLoading: isLoadingBalance } = useUSDCBalance('arcTestnet');

  // Get live EUR/USD exchange rate
  const { eurToUsd: liveRate, refreshRate, isLoading: isLoadingRate } = useExchangeRate();

  const {
    poolStats,
    userEurcBalance,
    isSwapping,
    isLoading,
    isRefreshing,
    lastSwap,
    clearLastSwap,
    fetchPoolStats,
    getSwapQuote,
    swapUsdcForEurc,
    swapEurcForUsdc,
    addLiquidity,
    removeLiquidity,
  } = useSwapPool();

  const [activeTab, setActiveTab] = useState<TabType>('swap');
  const [fromToken, setFromToken] = useState<'USDC' | 'EURC'>('USDC');
  const [amount, setAmount] = useState('');
  const [outputAmount, setOutputAmount] = useState('0');
  const [feeAmount, setFeeAmount] = useState('0');
  const [poolAction, setPoolAction] = useState<'add' | 'remove'>('add');
  const [lpAmount, setLpAmount] = useState('');
  const [addUsdcAmount, setAddUsdcAmount] = useState('');
  const [addEurcAmount, setAddEurcAmount] = useState('');
  const [slippage, setSlippage] = useState<number>(0.5);
  const [showSlippageSettings, setShowSlippageSettings] = useState(false);

  const toToken = fromToken === 'USDC' ? 'EURC' : 'USDC';

  // Get quote when amount changes
  useEffect(() => {
    const fetchQuote = async () => {
      if (!amount || parseFloat(amount) <= 0) {
        setOutputAmount('0');
        setFeeAmount('0');
        return;
      }

      const quote = await getSwapQuote(fromToken, amount);
      if (quote) {
        setOutputAmount(parseFloat(quote.output).toFixed(2));
        setFeeAmount(parseFloat(quote.fee).toFixed(4));
      }
    };

    const timer = setTimeout(fetchQuote, 300);
    return () => clearTimeout(timer);
  }, [amount, fromToken, getSwapQuote]);

  const handleSwapTokens = () => {
    setFromToken(fromToken === 'USDC' ? 'EURC' : 'USDC');
    setAmount('');
    setOutputAmount('0');
    setFeeAmount('0');
  };

  const handleSwap = async () => {
    if (!amount || parseFloat(amount) <= 0) return;

    let success = false;
    if (fromToken === 'USDC') {
      success = await swapUsdcForEurc(amount, outputAmount, slippage);
    } else {
      success = await swapEurcForUsdc(amount, outputAmount, slippage);
    }

    if (success) {
      setAmount('');
      setOutputAmount('0');
      setFeeAmount('0');
    }
  };

  const handleAddLiquidity = async () => {
    if (!addUsdcAmount || !addEurcAmount) return;
    const success = await addLiquidity(addUsdcAmount, addEurcAmount);
    if (success) {
      setAddUsdcAmount('');
      setAddEurcAmount('');
    }
  };

  const handleRemoveLiquidity = async () => {
    if (!lpAmount) return;
    const success = await removeLiquidity(lpAmount);
    if (success) {
      setLpAmount('');
    }
  };

  const handleMaxFrom = () => {
    if (fromToken === 'USDC') {
      const max = Math.max(0, parseFloat(usdcBalance) - 1).toFixed(2); // Leave 1 USDC for gas
      setAmount(max);
    } else {
      setAmount(parseFloat(userEurcBalance).toFixed(2));
    }
  };

  // Calculate expected output for remove liquidity
  const calcRemoveOutput = () => {
    if (!lpAmount || parseFloat(lpAmount) <= 0 || parseFloat(poolStats.userLpTokens) <= 0) {
      return { usdc: '0', eurc: '0' };
    }
    const ratio = parseFloat(lpAmount) / parseFloat(poolStats.userLpTokens);
    return {
      usdc: (parseFloat(poolStats.userUsdcShare) * ratio).toFixed(2),
      eurc: (parseFloat(poolStats.userEurcShare) * ratio).toFixed(2),
    };
  };

  const removeOutput = calcRemoveOutput();

  return (
    <div className="min-h-screen bg-background">
      {/* Animated gradient background */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-primary/5 via-transparent to-transparent rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-blue-500/5 via-transparent to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
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
              <h1 className="text-lg font-semibold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">Swap</h1>
            </div>
            {isConnected ? <UserMenu /> : <WalletConnect />}
          </div>
        </div>
      </nav>

      <div className="pt-24 pb-20 container mx-auto px-6 max-w-2xl">
        {/* Hero */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-blue-500/20 mb-4">
            <ArrowDownUp className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-3xl font-bold mb-2">Stablecoin Swap</h2>
          <p className="text-sm text-muted-foreground">
            Swap USDC and EURC with 0.2% fee
          </p>
        </div>

        {/* Wrong Network Warning */}
        {!isArcTestnet && isConnected && (
          <Card className="p-4 mb-6 border-red-500/50 bg-red-500/10 animate-in fade-in slide-in-from-top-2 duration-500">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex items-center gap-3 flex-1">
                <div className="p-2 rounded-lg bg-red-500/20 border border-red-500/30 animate-pulse">
                  <XCircle className="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-red-500">Wrong Network</h3>
                  <p className="text-xs text-muted-foreground">
                    Switch to Arc Testnet to use Swap
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
        )}

        {/* Demo view when not connected */}
        {!isConnected ? (
          <div className="space-y-6">
            {/* Features Grid */}
            <div className="grid grid-cols-3 gap-3">
              <Card className="p-4 text-center border-border/50 bg-card/50">
                <div className="p-3 rounded-full bg-green-500/10 w-fit mx-auto mb-3">
                  <ArrowDownUp className="w-5 h-5 text-green-500" />
                </div>
                <h3 className="font-semibold text-sm mb-1">Instant Swap</h3>
                <p className="text-xs text-muted-foreground">USDC ↔ EURC</p>
              </Card>

              <Card className="p-4 text-center border-border/50 bg-card/50">
                <div className="p-3 rounded-full bg-blue-500/10 w-fit mx-auto mb-3">
                  <Droplets className="w-5 h-5 text-blue-500" />
                </div>
                <h3 className="font-semibold text-sm mb-1">Earn Fees</h3>
                <p className="text-xs text-muted-foreground">0.2% LP rewards</p>
              </Card>

              <Card className="p-4 text-center border-border/50 bg-card/50">
                <div className="p-3 rounded-full bg-purple-500/10 w-fit mx-auto mb-3">
                  <RefreshCw className="w-5 h-5 text-purple-500" />
                </div>
                <h3 className="font-semibold text-sm mb-1">Live Rate</h3>
                <p className="text-xs text-muted-foreground">EUR/USD oracle</p>
              </Card>
            </div>

            {/* Demo Swap Card */}
            <Card className="p-6 border-border/50 bg-card/50 backdrop-blur-sm">
              <div className="space-y-4 opacity-60">
                {/* From */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">From</span>
                    <span className="text-muted-foreground">Balance: --</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
                    <span className="text-2xl font-medium text-muted-foreground">0.00</span>
                    <div className="ml-auto px-3 py-1.5 bg-white/10 rounded-lg text-sm font-medium">USDC</div>
                  </div>
                </div>

                {/* Arrow */}
                <div className="flex justify-center">
                  <div className="p-2 rounded-full bg-primary/10 border border-primary/20">
                    <ArrowDownUp className="w-4 h-4 text-primary" />
                  </div>
                </div>

                {/* To */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">To (estimated)</span>
                    <span className="text-muted-foreground">Balance: --</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
                    <span className="text-2xl font-medium text-muted-foreground">0.00</span>
                    <div className="ml-auto px-3 py-1.5 bg-white/10 rounded-lg text-sm font-medium">EURC</div>
                  </div>
                </div>

                {/* Rate info */}
                <div className="p-3 rounded-lg bg-white/5 text-sm text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Rate</span>
                    <span>1 USDC ≈ {liveRate > 0 ? (1/liveRate).toFixed(4) : '0.9259'} EURC</span>
                  </div>
                  <div className="flex justify-between mt-1">
                    <span>Fee</span>
                    <span>0.2%</span>
                  </div>
                </div>
              </div>

              {/* Connect button */}
              <div className="mt-6">
                <WalletConnect />
              </div>
            </Card>

            {/* Pool Stats Preview */}
            <Card className="p-4 border-border/50 bg-card/50 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold flex items-center gap-2 text-sm">
                  <Droplets className="w-4 h-4 text-primary" />
                  Pool Statistics
                </h3>
              </div>
              <div className="grid grid-cols-2 gap-3 opacity-60">
                <div className="p-2 rounded-lg bg-white/5 text-center">
                  <span className="text-xs text-muted-foreground block">Total Liquidity</span>
                  <p className="font-bold">$--</p>
                </div>
                <div className="p-2 rounded-lg bg-white/5 text-center">
                  <span className="text-xs text-muted-foreground block">LP APY</span>
                  <p className="font-bold text-green-500">0.2% fees</p>
                </div>
              </div>
            </Card>

            {/* Live Activity */}
            <LiveSwapFeed />
          </div>
        ) : (
          <>
        {/* Tabs */}
        <div className="flex gap-2 mb-6 p-1 bg-white/5 rounded-xl">
          <button
            onClick={() => setActiveTab('swap')}
            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'swap'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
            }`}
          >
            <ArrowDownUp className="w-4 h-4 inline mr-2" />
            Swap
          </button>
          <button
            onClick={() => setActiveTab('pool')}
            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'pool'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
            }`}
          >
            <Droplets className="w-4 h-4 inline mr-2" />
            Pool
          </button>
        </div>

        {/* Slippage Settings Modal */}
        {showSlippageSettings && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowSlippageSettings(false)}
            />
            {/* Modal */}
            <div className="relative z-10 w-full max-w-sm mx-4 p-5 rounded-2xl bg-card border border-border/50 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Slippage Settings</h3>
                <button
                  onClick={() => setShowSlippageSettings(false)}
                  className="p-1.5 hover:bg-white/10 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>

              <p className="text-sm text-muted-foreground mb-4">
                Your transaction will revert if the price changes unfavorably by more than this percentage.
              </p>

              <div className="flex gap-2 mb-4">
                {[0.1, 0.5, 1.0, 2.0].map((value) => (
                  <button
                    key={value}
                    onClick={() => setSlippage(value)}
                    className={`flex-1 py-2.5 px-3 rounded-xl text-sm font-medium transition-all ${
                      slippage === value
                        ? 'bg-primary text-primary-foreground shadow-lg'
                        : 'bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-foreground'
                    }`}
                  >
                    {value}%
                  </button>
                ))}
              </div>

              <div className="relative">
                <Input
                  type="number"
                  value={slippage}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val) && val >= 0 && val <= 50) setSlippage(val);
                  }}
                  className="h-12 text-center text-lg font-medium bg-white/5 border-white/10 pr-10"
                  step="0.1"
                  min="0"
                  max="50"
                  placeholder="Custom"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
              </div>

              {slippage > 5 && (
                <div className="mt-3 p-2.5 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 text-xs">
                  High slippage may result in an unfavorable trade
                </div>
              )}

              <Button
                onClick={() => setShowSlippageSettings(false)}
                className="w-full mt-4 h-11"
              >
                Done
              </Button>
            </div>
          </div>
        )}

        {activeTab === 'swap' ? (
          /* Swap Tab */
          <>
          <Card className="p-6 border-border/50 bg-card/50 backdrop-blur-sm">
            {/* Settings button */}
            <div className="flex justify-end mb-4">
              <button
                onClick={() => setShowSlippageSettings(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-white/10 rounded-lg transition-colors"
              >
                <Settings2 className="w-3.5 h-3.5" />
                <span>{slippage}% slippage</span>
              </button>
            </div>

            {/* From token */}
            <div className="space-y-2 mb-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">From</span>
                <span className="text-sm text-muted-foreground">
                  Balance: {isLoadingBalance ? '...' : formatBalance(fromToken === 'USDC' ? usdcBalance : (isConnected ? userEurcBalance : '0'))}
                </span>
              </div>
              <div className="relative">
                <Input
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pr-24 h-14 text-xl bg-white/5 border-white/10"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                  <button
                    onClick={handleMaxFrom}
                    className="text-xs text-primary hover:underline"
                  >
                    MAX
                  </button>
                  <div className="px-3 py-1.5 bg-white/10 rounded-lg font-medium text-sm">
                    {fromToken}
                  </div>
                </div>
              </div>
            </div>

            {/* Swap direction button */}
            <div className="flex justify-center my-2 relative z-10">
              <button
                onClick={handleSwapTokens}
                className="p-3 rounded-full bg-primary/10 border border-primary/20 hover:bg-primary/20 transition-all duration-200 hover:scale-110"
              >
                <ArrowDownUp className="w-5 h-5 text-primary" />
              </button>
            </div>

            {/* To token */}
            <div className="space-y-2 mt-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">To (estimated)</span>
                <span className="text-sm text-muted-foreground">
                  Balance: {isLoadingBalance ? '...' : formatBalance(toToken === 'USDC' ? usdcBalance : (isConnected ? userEurcBalance : '0'))}
                </span>
              </div>
              <div className="relative">
                <Input
                  type="text"
                  placeholder="0.00"
                  value={outputAmount}
                  readOnly
                  className="pr-20 h-14 text-xl bg-white/5 border-white/10"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="px-3 py-1.5 bg-white/10 rounded-lg font-medium text-sm">
                    {toToken}
                  </div>
                </div>
              </div>
            </div>

            {/* Swap details */}
            <div className="mt-4 p-3 rounded-lg bg-white/5 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Fee (0.2%)</span>
                <span>{feeAmount} {toToken}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Rate</span>
                <span>1 {fromToken} = {fromToken === 'USDC' ? (1/liveRate).toFixed(4) : liveRate.toFixed(4)} {toToken}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Slippage</span>
                <span>{slippage}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Min. received</span>
                <span>{(parseFloat(outputAmount) * (1 - slippage / 100)).toFixed(2)} {toToken}</span>
              </div>
            </div>

            {/* Swap button */}
            {isConnected ? (
              <Button
                onClick={handleSwap}
                disabled={!amount || parseFloat(amount) <= 0 || isSwapping}
                className="w-full mt-4 h-12 text-base bg-primary hover:bg-primary/90"
              >
                {isSwapping ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Swapping...
                  </>
                ) : !amount || parseFloat(amount) <= 0 ? (
                  'Enter amount'
                ) : (
                  `Swap ${fromToken} to ${toToken}`
                )}
              </Button>
            ) : (
              <div className="mt-4">
                <WalletConnect />
              </div>
            )}

            {/* Last Swap Transaction */}
            {lastSwap && lastSwap.type === 'swap' && (
              <div className={`mt-4 p-4 rounded-xl border ${
                lastSwap.status === 'success'
                  ? 'bg-green-500/10 border-green-500/20'
                  : lastSwap.status === 'failed'
                  ? 'bg-red-500/10 border-red-500/20'
                  : 'bg-blue-500/10 border-blue-500/20'
              }`}>
                <div className="flex items-start gap-3">
                  {lastSwap.status === 'success' && <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />}
                  {lastSwap.status === 'failed' && <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />}
                  {lastSwap.status === 'pending' && <Loader2 className="w-5 h-5 text-blue-400 animate-spin flex-shrink-0 mt-0.5" />}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium mb-1 ${
                      lastSwap.status === 'success' ? 'text-green-400' :
                      lastSwap.status === 'failed' ? 'text-red-400' : 'text-blue-400'
                    }`}>
                      {lastSwap.status === 'success' ? 'Swap Complete!' :
                       lastSwap.status === 'failed' ? 'Swap Failed' : 'Processing Swap...'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Swapped {lastSwap.amountIn} {lastSwap.fromToken} → {lastSwap.amountOut} {lastSwap.toToken}
                    </p>
                    <a
                      href={lastSwap.explorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline flex items-center gap-1 mt-2"
                    >
                      View transaction <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <button onClick={clearLastSwap} className="p-1 hover:bg-white/10 rounded flex-shrink-0">
                    <X className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>
              </div>
            )}

            {/* Info */}
            <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5" />
                <span>0.2% fee</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span>{isLoadingRate ? '...' : `1 EUR = $${liveRate.toFixed(4)}`}</span>
                <button
                  onClick={() => { refreshRate(); fetchPoolStats(); }}
                  className="p-0.5 hover:bg-white/10 rounded transition-colors"
                  disabled={isLoadingRate}
                  title="Refresh rate"
                >
                  <RefreshCw className={`w-3 h-3 ${isLoadingRate ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>
          </Card>

          {/* Live Activity - Swap Tab */}
          <div className="mt-4">
            <LiveSwapFeed />
          </div>
          </>
        ) : (
          /* Pool Tab */
          <div className="space-y-4">
            {/* Pool Stats */}
            <Card className="p-6 border-border/50 bg-card/50 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <Droplets className="w-5 h-5 text-primary" />
                  Pool Statistics
                </h3>
                <button
                  onClick={fetchPoolStats}
                  disabled={isRefreshing}
                  className="p-1.5 hover:bg-white/10 rounded transition-colors disabled:opacity-50"
                  title="Refresh pool data"
                >
                  <RefreshCw className={`w-4 h-4 text-muted-foreground ${isRefreshing ? 'animate-spin' : ''}`} />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-lg bg-white/5">
                  <span className="text-xs text-muted-foreground">Total USDC</span>
                  <p className="text-lg font-bold">${parseFloat(poolStats.usdcReserve).toLocaleString()}</p>
                </div>
                <div className="p-3 rounded-lg bg-white/5">
                  <span className="text-xs text-muted-foreground">Total EURC</span>
                  <p className="text-lg font-bold">{parseFloat(poolStats.eurcReserve).toLocaleString()}</p>
                </div>
                <div className="p-3 rounded-lg bg-white/5">
                  <span className="text-xs text-muted-foreground">Total Liquidity</span>
                  <p className="text-lg font-bold">${parseFloat(poolStats.totalLiquidityUsd).toLocaleString()}</p>
                </div>
                <div className="p-3 rounded-lg bg-white/5">
                  <span className="text-xs text-muted-foreground">Swap Fee</span>
                  <p className="text-lg font-bold text-green-500">0.2%</p>
                </div>
              </div>
            </Card>

            {/* Your Position */}
            {isConnected && (
              <Card className="p-6 border-border/50 bg-card/50 backdrop-blur-sm">
                <h3 className="font-semibold mb-4">Your Position</h3>
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 rounded-lg bg-white/5 text-center">
                    <span className="text-xs text-muted-foreground block">LP Tokens</span>
                    <p className="font-bold">{parseFloat(poolStats.userLpTokens).toFixed(2)}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-white/5 text-center">
                    <span className="text-xs text-muted-foreground block">Pool Share</span>
                    <p className="font-bold">{poolStats.userSharePercent.toFixed(2)}%</p>
                  </div>
                  <div className="p-3 rounded-lg bg-white/5 text-center">
                    <span className="text-xs text-muted-foreground block">Your Value</span>
                    <p className="font-bold text-green-500">
                      ${(parseFloat(poolStats.userUsdcShare) + parseFloat(poolStats.userEurcShare) * liveRate).toFixed(2)}
                    </p>
                  </div>
                </div>
                {parseFloat(poolStats.userLpTokens) > 0 && (
                  <div className="mt-3 p-3 rounded-lg bg-white/5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Your USDC</span>
                      <span>${parseFloat(poolStats.userUsdcShare).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-muted-foreground">Your EURC</span>
                      <span>{parseFloat(poolStats.userEurcShare).toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </Card>
            )}

            {/* Add/Remove Liquidity */}
            <Card className="p-6 border-border/50 bg-card/50 backdrop-blur-sm">
              {/* Sub-tabs */}
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setPoolAction('add')}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${
                    poolAction === 'add'
                      ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                      : 'bg-white/5 text-muted-foreground hover:bg-white/10'
                  }`}
                >
                  <Plus className="w-4 h-4" />
                  Add
                </button>
                <button
                  onClick={() => setPoolAction('remove')}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${
                    poolAction === 'remove'
                      ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                      : 'bg-white/5 text-muted-foreground hover:bg-white/10'
                  }`}
                >
                  <Minus className="w-4 h-4" />
                  Remove
                </button>
              </div>

              {poolAction === 'add' ? (
                <div className="space-y-4">
                  {/* USDC input */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <label className="text-muted-foreground">USDC Amount</label>
                      <span className="text-muted-foreground">Balance: {formatBalance(usdcBalance)}</span>
                    </div>
                    <div className="relative">
                      <Input
                        type="number"
                        placeholder="0.00"
                        value={addUsdcAmount}
                        onChange={(e) => {
                          const usdc = e.target.value;
                          setAddUsdcAmount(usdc);
                          // Auto-calculate EURC based on live EUR/USD rate from Fixer.io
                          if (usdc && parseFloat(usdc) > 0 && liveRate > 0) {
                            const eurc = parseFloat(usdc) / liveRate;
                            setAddEurcAmount(eurc.toFixed(2));
                          } else {
                            setAddEurcAmount('');
                          }
                        }}
                        className="pr-28 h-12 bg-white/5 border-white/10"
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                        <button
                          onClick={() => {
                            const max = Math.max(0, parseFloat(usdcBalance) - 1).toFixed(2);
                            setAddUsdcAmount(max);
                            if (liveRate > 0) {
                              const eurc = parseFloat(max) / liveRate;
                              setAddEurcAmount(eurc.toFixed(2));
                            }
                          }}
                          className="text-xs text-primary hover:text-primary/80"
                        >
                          MAX
                        </button>
                        <span className="text-sm font-medium text-muted-foreground">USDC</span>
                      </div>
                    </div>
                  </div>

                  {/* EURC input (auto-calculated) */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <label className="text-muted-foreground">EURC Amount (auto)</label>
                      <span className="text-muted-foreground">Balance: {formatBalance(userEurcBalance)}</span>
                    </div>
                    <div className="relative">
                      <Input
                        type="number"
                        placeholder="0.00"
                        value={addEurcAmount}
                        onChange={(e) => {
                          const eurc = e.target.value;
                          setAddEurcAmount(eurc);
                          // Auto-calculate USDC based on live EUR/USD rate from Fixer.io
                          if (eurc && parseFloat(eurc) > 0 && liveRate > 0) {
                            const usdc = parseFloat(eurc) * liveRate;
                            setAddUsdcAmount(usdc.toFixed(2));
                          } else {
                            setAddUsdcAmount('');
                          }
                        }}
                        className="pr-16 h-12 bg-white/5 border-white/10"
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium">
                        EURC
                      </div>
                    </div>
                  </div>

                  {/* Exchange rate info */}
                  {liveRate > 0 && (
                    <div className="p-2 rounded bg-white/5 text-xs text-muted-foreground text-center">
                      1 USDC ≈ {(1 / liveRate).toFixed(4)} EURC (live rate: 1 EUR = ${liveRate.toFixed(4)})
                    </div>
                  )}

                  <Button
                    onClick={handleAddLiquidity}
                    disabled={!isConnected || !addUsdcAmount || !addEurcAmount || isLoading}
                    className="w-full h-12 bg-green-600 hover:bg-green-700"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4 mr-2" />
                        Add Liquidity
                      </>
                    )}
                  </Button>

                  {/* Last Transaction for Add Liquidity */}
                  {lastSwap && lastSwap.type === 'addLiquidity' && (
                    <div className={`mt-4 p-4 rounded-xl border ${
                      lastSwap.status === 'success'
                        ? 'bg-green-500/10 border-green-500/20'
                        : lastSwap.status === 'failed'
                        ? 'bg-red-500/10 border-red-500/20'
                        : 'bg-blue-500/10 border-blue-500/20'
                    }`}>
                      <div className="flex items-start gap-3">
                        {lastSwap.status === 'success' && <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />}
                        {lastSwap.status === 'failed' && <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />}
                        {lastSwap.status === 'pending' && <Loader2 className="w-5 h-5 text-blue-400 animate-spin flex-shrink-0 mt-0.5" />}
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium mb-1 ${
                            lastSwap.status === 'success' ? 'text-green-400' :
                            lastSwap.status === 'failed' ? 'text-red-400' : 'text-blue-400'
                          }`}>
                            {lastSwap.status === 'success' ? 'Liquidity Added!' :
                             lastSwap.status === 'failed' ? 'Transaction Failed' : 'Adding Liquidity...'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Added {lastSwap.amountIn} to the pool
                          </p>
                          <a
                            href={lastSwap.explorerUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline flex items-center gap-1 mt-2"
                          >
                            View transaction <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                        <button onClick={clearLastSwap} className="p-1 hover:bg-white/10 rounded flex-shrink-0">
                          <X className="w-4 h-4 text-muted-foreground" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <label className="text-muted-foreground">LP Tokens to Remove</label>
                      <span className="text-muted-foreground">Balance: {parseFloat(poolStats.userLpTokens).toFixed(2)}</span>
                    </div>
                    <div className="relative">
                      <Input
                        type="number"
                        placeholder="0.00"
                        value={lpAmount}
                        onChange={(e) => setLpAmount(e.target.value)}
                        className="pr-16 h-12 bg-white/5 border-white/10"
                      />
                      <button
                        onClick={() => setLpAmount(parseFloat(poolStats.userLpTokens).toFixed(2))}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-primary hover:underline"
                      >
                        MAX
                      </button>
                    </div>
                  </div>

                  {/* Preview */}
                  <div className="p-3 rounded-lg bg-white/5 text-sm">
                    <span className="text-muted-foreground">You will receive:</span>
                    <div className="flex justify-between mt-2">
                      <span>USDC</span>
                      <span className="font-medium">~${removeOutput.usdc}</span>
                    </div>
                    <div className="flex justify-between mt-1">
                      <span>EURC</span>
                      <span className="font-medium">~{removeOutput.eurc}</span>
                    </div>
                  </div>

                  <Button
                    onClick={handleRemoveLiquidity}
                    disabled={!isConnected || parseFloat(poolStats.userLpTokens) === 0 || !lpAmount || isLoading}
                    className="w-full h-12 bg-red-600 hover:bg-red-700"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Removing...
                      </>
                    ) : (
                      <>
                        <Minus className="w-4 h-4 mr-2" />
                        Remove Liquidity
                      </>
                    )}
                  </Button>

                  {/* Last Transaction for Remove Liquidity */}
                  {lastSwap && lastSwap.type === 'removeLiquidity' && (
                    <div className={`mt-4 p-4 rounded-xl border ${
                      lastSwap.status === 'success'
                        ? 'bg-green-500/10 border-green-500/20'
                        : lastSwap.status === 'failed'
                        ? 'bg-red-500/10 border-red-500/20'
                        : 'bg-blue-500/10 border-blue-500/20'
                    }`}>
                      <div className="flex items-start gap-3">
                        {lastSwap.status === 'success' && <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />}
                        {lastSwap.status === 'failed' && <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />}
                        {lastSwap.status === 'pending' && <Loader2 className="w-5 h-5 text-blue-400 animate-spin flex-shrink-0 mt-0.5" />}
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium mb-1 ${
                            lastSwap.status === 'success' ? 'text-green-400' :
                            lastSwap.status === 'failed' ? 'text-red-400' : 'text-blue-400'
                          }`}>
                            {lastSwap.status === 'success' ? 'Liquidity Removed!' :
                             lastSwap.status === 'failed' ? 'Transaction Failed' : 'Removing Liquidity...'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Removed {lastSwap.amountIn} LP tokens from the pool
                          </p>
                          <a
                            href={lastSwap.explorerUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline flex items-center gap-1 mt-2"
                          >
                            View transaction <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                        <button onClick={clearLastSwap} className="p-1 hover:bg-white/10 rounded flex-shrink-0">
                          <X className="w-4 h-4 text-muted-foreground" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Card>

            {/* Live Activity */}
            <LiveSwapFeed />
          </div>
        )}
          </>
        )}
      </div>
    </div>
  );
};

export default Swap;
