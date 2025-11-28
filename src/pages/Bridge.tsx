import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRight, Info, ArrowLeft, Loader2, ExternalLink, CheckCircle2, XCircle, Clock, ArrowDownUp, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAccount } from "wagmi";
import { WalletConnect } from "@/components/WalletConnect";
import { UserMenu } from "@/components/UserMenu";
import { useBridgeCCTP } from "@/hooks/useBridgeCCTP";
import { useUSDCBalance } from "@/hooks/useUSDCBalance";
import { SUPPORTED_NETWORKS } from "@/lib/constants";

const Bridge = () => {
  const navigate = useNavigate();
  const account = useAccount();
  const isConnected = account?.isConnected ?? false;

  const fromNetwork: keyof typeof SUPPORTED_NETWORKS = "ethereumSepolia";
  const toNetwork: keyof typeof SUPPORTED_NETWORKS = "arcTestnet";

  const [amount, setAmount] = useState<string>("");
  const [showFaucetInfo, setShowFaucetInfo] = useState(true);
  const { bridge, completeBridge, isBridging, error, transactions, attestationStatus, canCompleteBridge } = useBridgeCCTP();

  const { balance: fromBalance, isLoading: isLoadingFromBalance } = useUSDCBalance(fromNetwork);
  const { balance: toBalance, isLoading: isLoadingToBalance } = useUSDCBalance(toNetwork);

  const handleBridge = async () => {
    if (!amount || parseFloat(amount) <= 0) return;
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
            <ArrowDownUp className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-3xl font-bold mb-2">Bridge USDC</h2>
          <p className="text-sm text-muted-foreground">
            Transfer USDC from Ethereum Sepolia to Arc Testnet via Circle CCTP
          </p>
        </div>

        {/* Faucet Info */}
        {showFaucetInfo && (
          <div className="mb-6 p-4 rounded-2xl bg-primary/5 border border-primary/20 backdrop-blur-sm relative">
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

        {/* Bridge Form */}
        <div className="p-6 rounded-3xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 backdrop-blur-sm space-y-6">
          {/* From Network */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">From</p>
            <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
              <span className="font-medium">{SUPPORTED_NETWORKS[fromNetwork].name}</span>
              <span className="text-sm text-muted-foreground">
                {isLoadingFromBalance ? '...' : `${fromBalance} USDC`}
              </span>
            </div>
          </div>

          {/* Arrow */}
          <div className="flex justify-center">
            <div className="p-3 rounded-full bg-primary/10 border border-primary/20">
              <ArrowRight className="w-5 h-5 text-primary" />
            </div>
          </div>

          {/* To Network */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">To</p>
            <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
              <span className="font-medium">{SUPPORTED_NETWORKS[toNetwork].name}</span>
              <span className="text-sm text-muted-foreground">
                {isLoadingToBalance ? '...' : `${toBalance} USDC`}
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
              Available: {isLoadingFromBalance ? '...' : `${fromBalance} USDC`}
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
            disabled={!amount || parseFloat(amount) <= 0 || isBridging || attestationStatus !== null}
            onClick={handleBridge}
          >
            {isBridging ? (
              <>
                <Loader2 className="mr-2 w-5 h-5 animate-spin" />
                Bridging...
              </>
            ) : (
              <>
                Bridge to Arc Testnet
                <ArrowRight className="ml-2 w-5 h-5" />
              </>
            )}
          </Button>

          {/* Attestation Status */}
          {attestationStatus && attestationStatus !== 'complete' && (
            <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-blue-400 animate-pulse flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-400 mb-1">
                    Step 1/2: Waiting for Attestation
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Status: <span className="font-medium">{attestationStatus}</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Takes 2-3 minutes. A green button will appear when ready.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Complete Bridge Button */}
          {canCompleteBridge && (
            <div className="space-y-3">
              <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-green-400 mb-1">
                      Step 2/2: Ready to Complete
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Attestation verified! Click below to mint USDC on Arc.
                    </p>
                  </div>
                </div>
              </div>
              <Button
                size="lg"
                className="w-full rounded-xl h-14 text-base font-semibold bg-green-600 hover:bg-green-700 animate-pulse"
                disabled={isBridging}
                onClick={completeBridge}
              >
                {isBridging ? (
                  <>
                    <Loader2 className="mr-2 w-5 h-5 animate-spin" />
                    Completing...
                  </>
                ) : (
                  <>
                    Complete Bridge
                    <CheckCircle2 className="ml-2 w-5 h-5" />
                  </>
                )}
              </Button>
            </div>
          )}

          <p className="text-xs text-center text-muted-foreground">
            Make sure you have ETH on Sepolia for gas fees
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
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-2 gap-4 mt-8">
          <div className="p-4 rounded-2xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-4 h-4 text-green-400" />
              <h3 className="font-semibold">Native USDC</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Powered by Circle CCTP - real USDC on both chains
            </p>
          </div>
          <div className="p-4 rounded-2xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-blue-400" />
              <h3 className="font-semibold">Two-Step Process</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Burn on Sepolia → Wait ~3 min → Complete on Arc
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Bridge;
