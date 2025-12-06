import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRight, Info, ArrowLeft, Loader2, ExternalLink, XCircle, ArrowLeftRight, X, CheckCircle2, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAccount } from "wagmi";
import { WalletConnect } from "@/components/WalletConnect";
import { UserMenu } from "@/components/UserMenu";
import { useBridgeCCTP } from "@/hooks/useBridgeCCTP";
import { useUSDCBalance } from "@/hooks/useUSDCBalance";
import { SUPPORTED_NETWORKS } from "@/lib/constants";
import { LiveBridgeFeed } from "@/components/LiveBridgeFeed";

const formatBalance = (balance: string) => {
  const num = parseFloat(balance);
  if (isNaN(num)) return balance;
  // Show decimals for small amounts (< $100), hide for large
  if (num < 100) {
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return Math.floor(num).toLocaleString('en-US');
};

const Bridge = () => {
  const navigate = useNavigate();
  const account = useAccount();
  const isConnected = account?.isConnected ?? false;

  // Direction: true = Sepolia → Arc, false = Arc → Sepolia
  const [isSepoliaToArc, setIsSepoliaToArc] = useState(true);

  const fromNetwork: keyof typeof SUPPORTED_NETWORKS = isSepoliaToArc ? "ethereumSepolia" : "arcTestnet";
  const toNetwork: keyof typeof SUPPORTED_NETWORKS = isSepoliaToArc ? "arcTestnet" : "ethereumSepolia";

  const [amount, setAmount] = useState<string>("");
  const [showFaucetInfo, setShowFaucetInfo] = useState(() => {
    return localStorage.getItem('bridge_faucet_dismissed') !== 'true';
  });
  const [showBadgeReminder, setShowBadgeReminder] = useState(() => {
    return localStorage.getItem('bridge_badge_dismissed') !== 'true';
  });
  const [savedBridgeParams, setSavedBridgeParams] = useState<{ amount: string; toNetwork: keyof typeof SUPPORTED_NETWORKS } | null>(null);
  const [showRestoreForm, setShowRestoreForm] = useState(false);
  const [restoreTxHash, setRestoreTxHash] = useState("");
  const [restoreStatus, setRestoreStatus] = useState<{ type: 'idle' | 'loading' | 'success' | 'error' | 'claimed'; message: string }>({ type: 'idle', message: '' });

  // Persist dismissal to localStorage
  useEffect(() => {
    if (!showFaucetInfo) {
      localStorage.setItem('bridge_faucet_dismissed', 'true');
    }
  }, [showFaucetInfo]);

  useEffect(() => {
    if (!showBadgeReminder) {
      localStorage.setItem('bridge_badge_dismissed', 'true');
    }
  }, [showBadgeReminder]);
  const { bridge, claimPendingBridge, clearPendingBurn, restorePendingBurn, isBridging, isClaiming, error, result, transactions, attestationStatus, mintConfirmed, pendingBurn } = useBridgeCCTP();

  const { balance: fromBalance, isLoading: isLoadingFromBalance } = useUSDCBalance(fromNetwork);
  const { balance: toBalance, isLoading: isLoadingToBalance } = useUSDCBalance(toNetwork);

  const handleBridge = async () => {
    if (!amount || parseFloat(amount) <= 0) return;
    setSavedBridgeParams({ amount, toNetwork });
    await bridge({ fromNetwork, toNetwork, amount });
  };

  const handleMax = () => {
    const balance = parseFloat(fromBalance);
    if (balance > 0) setAmount(balance.toFixed(2));
  };

  const handleHalf = () => {
    const balance = parseFloat(fromBalance);
    if (balance > 0) setAmount((balance / 2).toFixed(2));
  };

  const handleRestore = async () => {
    if (!restoreTxHash || !restoreTxHash.startsWith('0x')) return;
    if (restoreTxHash.length !== 66) {
      setRestoreStatus({ type: 'error', message: 'Transaction hash should be 66 characters (0x + 64 hex)' });
      return;
    }
    setRestoreStatus({ type: 'loading', message: 'Verifying with Circle API...' });
    const result = await restorePendingBurn(restoreTxHash, fromNetwork, toNetwork, '0');
    if (result.success) {
      setRestoreStatus({ type: 'success', message: result.message });
      setTimeout(() => {
        setShowRestoreForm(false);
        setRestoreTxHash("");
        setRestoreStatus({ type: 'idle', message: '' });
      }, 2000);
    } else {
      setRestoreStatus({ type: result.type as 'error' | 'claimed', message: result.message });
    }
  };

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
              <h1 className="text-lg font-semibold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">Bridge</h1>
            </div>
            {isConnected ? <UserMenu /> : <WalletConnect />}
          </div>
        </div>
      </nav>

      <div className="pt-24 pb-20 container mx-auto px-6 max-w-2xl">
        {/* Hero */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-purple-500/20 mb-4">
            <ArrowLeftRight className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-3xl font-bold mb-2">Bridge USDC</h2>
          <p className="text-sm text-muted-foreground">
            Transfer USDC between Ethereum Sepolia and Arc Testnet via Circle CCTP V2
          </p>
        </div>

        {/* Info Cards */}
        {(showFaucetInfo || showBadgeReminder) && (
          <div className="mb-6 space-y-3">
            {/* Faucet Info */}
            {showFaucetInfo && (
              <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20 backdrop-blur-sm relative">
                <button
                  onClick={() => setShowFaucetInfo(false)}
                  className="absolute top-3 right-3 p-1 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
                <div className="flex items-start gap-3 pr-6">
                  <Info className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium mb-1">Need testnet USDC?</p>
                    <a
                      href="https://faucet.circle.com/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                    >
                      Get free tokens from Circle Faucet
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </div>
            )}

            {/* Early Badge Reminder */}
            {showBadgeReminder && (
              <div className="p-4 rounded-2xl bg-purple-500/5 border border-purple-500/20 backdrop-blur-sm relative">
                <button
                  onClick={() => setShowBadgeReminder(false)}
                  className="absolute top-3 right-3 p-1 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
                <div className="flex items-start gap-3 pr-6">
                  <span className="text-xl">🏆</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium mb-1">Don't forget your Early Badge!</p>
                    <button
                      onClick={() => navigate("/rewards")}
                      className="text-sm text-purple-400 hover:underline inline-flex items-center gap-1"
                    >
                      Mint free Early Supporter NFT
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Bridge Form or Preview */}
        {!isConnected ? (
          /* Preview for disconnected wallet */
          <div className="p-6 rounded-3xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 backdrop-blur-sm space-y-6">
            {/* From Network Preview */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">From</p>
              <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
                <span className="font-medium">Ethereum Sepolia</span>
                <span className="text-sm text-muted-foreground">- USDC</span>
              </div>
            </div>

            {/* Arrow */}
            <div className="flex justify-center">
              <div className="p-3 rounded-full bg-primary/10 border border-primary/20">
                <ArrowLeftRight className="w-5 h-5 text-primary" />
              </div>
            </div>

            {/* To Network Preview */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">To</p>
              <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
                <span className="font-medium">Arc Testnet</span>
                <span className="text-sm text-muted-foreground">- USDC</span>
              </div>
            </div>

            {/* Amount Preview */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Amount</p>
              <div className="h-14 rounded-xl bg-white/5 border border-white/10 flex items-center px-4">
                <span className="text-lg text-muted-foreground font-mono">0.00</span>
              </div>
            </div>

            {/* Connect Wallet CTA */}
            <div className="text-center space-y-4">
              <WalletConnect />
              <p className="text-sm text-muted-foreground">
                Connect wallet to bridge USDC
              </p>
            </div>

            {/* Features */}
            <div className="pt-4 border-t border-white/10 space-y-3">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <CheckCircle2 className="w-4 h-4 text-primary" />
                <span>Circle CCTP V2 & Bridge Kit SDK</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <CheckCircle2 className="w-4 h-4 text-primary" />
                <span>Fast Transfer (~30 seconds)</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <CheckCircle2 className="w-4 h-4 text-primary" />
                <span>No manual completion required</span>
              </div>
            </div>
          </div>
        ) : (
        <div className="p-6 rounded-3xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 backdrop-blur-sm space-y-6">
          {/* From Network */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">From</p>
            <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
              <span className="font-medium">{SUPPORTED_NETWORKS[fromNetwork].name}</span>
              <span className="text-sm text-muted-foreground">
                {isLoadingFromBalance ? '...' : `${formatBalance(fromBalance)} USDC`}
              </span>
            </div>
          </div>

          {/* Arrow - clickable to swap direction */}
          <div className="flex justify-center">
            <button
              onClick={() => {
                setIsSepoliaToArc(!isSepoliaToArc);
                setAmount("");
              }}
              disabled={isBridging}
              className="p-3 rounded-full bg-primary/10 border border-primary/20 hover:bg-primary/20 transition-all duration-200 hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Swap direction"
            >
              <ArrowLeftRight className="w-5 h-5 text-primary" />
            </button>
          </div>

          {/* To Network */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">To</p>
            <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
              <span className="font-medium">{SUPPORTED_NETWORKS[toNetwork].name}</span>
              <span className="text-sm text-muted-foreground">
                {isLoadingToBalance ? '...' : `${formatBalance(toBalance)} USDC`}
              </span>
            </div>
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Amount</p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleHalf}
                  disabled={isBridging || parseFloat(fromBalance) <= 0}
                  className="h-7 text-xs rounded-lg"
                >
                  HALF
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleMax}
                  disabled={isBridging || parseFloat(fromBalance) <= 0}
                  className="h-7 text-xs rounded-lg"
                >
                  MAX
                </Button>
              </div>
            </div>
            <Input
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="text-lg font-mono rounded-xl h-14 bg-white/5 border-white/10"
              min="0"
              step="0.01"
              disabled={isBridging}
            />
            <p className="text-xs text-muted-foreground">
              Available: {isLoadingFromBalance ? '...' : `${formatBalance(fromBalance)} USDC`}
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Bridge Button */}
          <Button
            size="lg"
            className="w-full rounded-xl h-14 text-base font-semibold"
            disabled={!amount || parseFloat(amount) <= 0 || isBridging || (mintConfirmed && result)}
            onClick={handleBridge}
          >
            {isBridging ? (
              <>
                <Loader2 className="mr-2 w-5 h-5 animate-spin" />
                Bridging...
              </>
            ) : (
              <>
                Bridge to {isSepoliaToArc ? "Arc Testnet" : "Ethereum Sepolia"}
                <ArrowRight className="ml-2 w-5 h-5" />
              </>
            )}
          </Button>

          {/* Attestation Status - Bridge Kit handles completion automatically */}
          {attestationStatus === 'pending' && (
            <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-blue-400 animate-pulse flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-400 mb-1">
                    Waiting for Circle Attestation
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    This usually takes under 30 seconds...
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Attestation received, waiting for mint */}
          {attestationStatus === 'attested' && (
            <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
              <div className="flex items-start gap-3">
                <Loader2 className="w-5 h-5 text-yellow-400 animate-spin flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-yellow-400 mb-1">
                    Attestation Received - Minting...
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Please confirm the mint transaction in your wallet
                  </p>
                  {!isSepoliaToArc && (
                    <p className="text-xs text-yellow-500/80 mt-2">
                      ⚠️ Make sure you have ETH on Sepolia for gas. If wallet shows empty popup - you need Sepolia ETH.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Transaction sent, waiting for blockchain confirmation */}
          {attestationStatus === 'confirming' && (
            <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20">
              <div className="flex items-start gap-3">
                <Loader2 className="w-5 h-5 text-purple-400 animate-spin flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-purple-400 mb-1">
                    Confirming Transaction...
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Waiting for blockchain confirmation
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Burn completed but mint cancelled - funds are safe */}
          {attestationStatus === 'pending_mint' && (
            <div className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/20 relative">
              <button
                onClick={clearPendingBurn}
                className="absolute top-2 right-2 p-1 text-orange-400/60 hover:text-orange-400 transition-colors"
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-orange-400 mb-1">
                    Your funds are safe!
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Burn completed but mint was not finished. Your USDC is waiting to be claimed.
                  </p>
                  {pendingBurn && (
                    <>
                      <p className="text-xs text-muted-foreground mt-1">
                        Burn TX: <a href={`${SUPPORTED_NETWORKS[pendingBurn.fromNetwork].explorerUrl}/tx/${pendingBurn.txHash}`} target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:underline">{pendingBurn.txHash.slice(0, 10)}...{pendingBurn.txHash.slice(-8)}</a>
                      </p>
                      <Button
                        onClick={claimPendingBridge}
                        disabled={isClaiming}
                        className="mt-3 w-full bg-orange-500 hover:bg-orange-600 text-white"
                      >
                        {isClaiming ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Claiming...
                          </>
                        ) : (
                          <>
                            Claim {pendingBurn.amount} USDC
                            <ArrowRight className="w-4 h-4 ml-2" />
                          </>
                        )}
                      </Button>
                    </>
                  )}
                  {!pendingBurn && (
                    <p className="text-xs text-orange-400/80 mt-2">
                      Contact support with your burn transaction hash to claim your USDC.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Success indicator when mint is confirmed */}
          {attestationStatus === 'complete' && mintConfirmed && result && (
            <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-400 mb-1">
                    Bridge Complete!
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Your {formatBalance(savedBridgeParams?.amount || '0')} USDC has been successfully bridged to {SUPPORTED_NETWORKS[savedBridgeParams?.toNetwork || toNetwork].name}.
                  </p>
                </div>
              </div>
            </div>
          )}

          <p className="text-xs text-center text-muted-foreground">
            Make sure you have {isSepoliaToArc ? "ETH on Sepolia" : "USDC on Arc Testnet"} for gas fees
          </p>

          {/* Transactions */}
          {transactions.length > 0 && (
            <div className="space-y-3 pt-4 border-t border-white/10">
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Transactions</p>
              <div className="space-y-2">
                {transactions.map((tx, index) => (
                  <div key={index} className="p-3 rounded-xl bg-white/5 border border-white/10">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {tx.status === 'success' && <CheckCircle2 className="w-4 h-4 text-green-400" />}
                          {tx.status === 'failed' && <XCircle className="w-4 h-4 text-red-400" />}
                          {tx.status === 'pending' && <Clock className="w-4 h-4 text-yellow-400 animate-pulse" />}
                          <span className="text-sm font-medium">{tx.step}</span>
                          <span className="text-xs text-muted-foreground">({tx.network})</span>
                        </div>
                        {tx.hash && (
                          <p className="text-xs text-muted-foreground font-mono truncate">
                            {tx.hash.slice(0, 10)}...{tx.hash.slice(-8)}
                          </p>
                        )}
                      </div>
                      {tx.explorerUrl && (
                        <a
                          href={tx.explorerUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline flex items-center gap-1 text-sm"
                        >
                          View
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Restore Pending Bridge */}
          <div className="pt-4 border-t border-white/5">
            <button
              onClick={() => setShowRestoreForm(!showRestoreForm)}
              className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors flex items-center gap-1 mx-auto"
            >
              {showRestoreForm ? <X className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
              {showRestoreForm ? "Close" : "Having trouble with a stuck transfer?"}
            </button>

            {showRestoreForm && (
              <div className="mt-4 p-4 rounded-xl bg-yellow-500/5 border border-yellow-500/20 space-y-3">
                <p className="text-xs text-muted-foreground">
                  If your bridge was interrupted after the burn transaction, enter your burn tx hash to restore and claim.
                </p>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    placeholder="0x..."
                    value={restoreTxHash}
                    onChange={(e) => {
                      setRestoreTxHash(e.target.value);
                      if (restoreStatus.type !== 'idle' && restoreStatus.type !== 'loading') {
                        setRestoreStatus({ type: 'idle', message: '' });
                      }
                    }}
                    className="text-sm font-mono h-9 bg-white/5 border-white/10 flex-1"
                  />
                  <Button
                    size="sm"
                    onClick={handleRestore}
                    disabled={!restoreTxHash || !restoreTxHash.startsWith('0x') || restoreStatus.type === 'loading'}
                    className="bg-yellow-600 hover:bg-yellow-700 h-9"
                  >
                    {restoreStatus.type === 'loading' ? 'Checking...' : 'Restore'}
                  </Button>
                </div>
                {restoreStatus.type !== 'idle' && restoreStatus.type !== 'loading' && (
                  <div className={`text-xs mt-2 px-2 py-1.5 rounded-lg ${
                    restoreStatus.type === 'success' ? 'bg-green-500/10 text-green-400' :
                    restoreStatus.type === 'claimed' ? 'bg-blue-500/10 text-blue-400' :
                    'bg-red-500/10 text-red-400'
                  }`}>
                    {restoreStatus.type === 'success' && '✓ '}
                    {restoreStatus.type === 'claimed' && '✓ '}
                    {restoreStatus.type === 'error' && '✗ '}
                    {restoreStatus.message}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        )}

        {/* Live Activity Feed */}
        <div className="mt-6">
          <LiveBridgeFeed />
        </div>
      </div>
    </div>
  );
};

export default Bridge;
