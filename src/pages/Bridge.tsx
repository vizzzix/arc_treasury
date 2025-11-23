import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, Info, ArrowLeft, Loader2, ExternalLink, CheckCircle2, XCircle, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAccount } from "wagmi";
import { WalletConnect } from "@/components/WalletConnect";
import { UserMenu } from "@/components/UserMenu";
import { useBridgeCCTP } from "@/hooks/useBridgeCCTP";
import { useUSDCBalance } from "@/hooks/useUSDCBalance";
import { SUPPORTED_NETWORKS } from "@/lib/constants";
import arcLogo from "@/assets/arc-logo.png";


const Bridge = () => {
  const navigate = useNavigate();
  const account = useAccount();
  const isConnected = account?.isConnected ?? false;

  // Bridge only supports Ethereum Sepolia → Arc Testnet
  const fromNetwork: keyof typeof SUPPORTED_NETWORKS = "ethereumSepolia";
  const toNetwork: keyof typeof SUPPORTED_NETWORKS = "arcTestnet";

  const [amount, setAmount] = useState<string>("");
  const { bridge, completeBridge, isBridging, error, transactions, attestationStatus, canCompleteBridge } = useBridgeCCTP();

  // Get USDC balance for source network (Ethereum Sepolia)
  const { balance: fromBalance, isLoading: isLoadingFromBalance } = useUSDCBalance(fromNetwork);
  // Get USDC balance for destination network (Arc Testnet)
  const { balance: toBalance, isLoading: isLoadingToBalance } = useUSDCBalance(toNetwork);

  const handleBridge = async () => {
    if (!amount || parseFloat(amount) <= 0) return;

    await bridge({
      fromNetwork,
      toNetwork,
      amount,
    });
  };

  const handleMax = () => {
    const balance = parseFloat(fromBalance);
    if (balance > 0) {
      setAmount(balance.toFixed(2));
    }
  };

  const handleHalf = () => {
    const balance = parseFloat(fromBalance);
    if (balance > 0) {
      setAmount((balance / 2).toFixed(2));
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation Header */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/30 bg-background/80 backdrop-blur-lg">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={arcLogo} alt="Arc Treasury" className="w-10 h-10" />
              <span className="text-2xl font-bold">Arc Treasury</span>
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={() => navigate("/")}
                variant="outline"
                className="border-border/50 hover:bg-card"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              {isConnected ? (
                <UserMenu />
              ) : (
                <WalletConnect />
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="pt-24 pb-12">
        <div className="container mx-auto px-6">
          <div className="max-w-2xl mx-auto">
            {/* Header */}
            <div className="text-center mb-8">
              <h1 className="text-4xl lg:text-5xl font-bold mb-4">
                Bridge USDC to Arc
              </h1>
              <p className="text-lg text-muted-foreground">
                Transfer USDC from Ethereum Sepolia to Arc Testnet using Circle CCTP
              </p>
            </div>
            
            {/* Faucet Link */}
            <div className="mb-6 p-4 rounded-lg bg-primary/5 border border-primary/20">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium mb-1">Need testnet USDC or EURC?</p>
                  <a 
                    href="https://faucet.circle.com/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                  >
                    Get free testnet tokens from Circle Faucet
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>

            {/* Bridge Form */}
            <div className="bg-card border border-border rounded-xl p-8">
              <div className="space-y-6">
                {/* From Network */}
                <div className="space-y-2">
                  <Label htmlFor="from-network">From Network</Label>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-background border border-border">
                    <span className="font-medium">{SUPPORTED_NETWORKS[fromNetwork].name}</span>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {isLoadingFromBalance ? 'Loading...' : `${fromBalance} USDC`}
                    </span>
                  </div>
                </div>

                {/* Arrow Indicator */}
                <div className="flex justify-center">
                  <div className="p-2 rounded-full bg-primary/10">
                    <ArrowRight className="w-5 h-5 text-primary" />
                  </div>
                </div>

                {/* To Network */}
                <div className="space-y-2">
                  <Label htmlFor="to-network">To Network</Label>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-background border border-border">
                    <span className="font-medium">{SUPPORTED_NETWORKS[toNetwork].name}</span>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {isLoadingToBalance ? 'Loading...' : `${toBalance} USDC`}
                    </span>
                  </div>
                </div>

                {/* Amount */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="amount">Amount (USDC)</Label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleHalf}
                        disabled={isBridging || parseFloat(fromBalance) <= 0}
                        className="h-7 text-xs"
                      >
                        HALF
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleMax}
                        disabled={isBridging || parseFloat(fromBalance) <= 0}
                        className="h-7 text-xs"
                      >
                        MAX
                      </Button>
                    </div>
                  </div>
                  <Input
                    id="amount"
                    type="number"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="bg-background border-border"
                    min="0"
                    step="0.01"
                    disabled={isBridging}
                  />
                  <p className="text-xs text-muted-foreground">
                    Available: {isLoadingFromBalance ? 'Loading...' : `${fromBalance} USDC`}
                  </p>
                </div>

                {/* Error Message */}
                {error && (
                  <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                    <p className="text-sm text-destructive">{error}</p>
                  </div>
                )}

                {/* Bridge Button */}
                <Button
                  size="lg"
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-lg py-6 shadow-glow hover:shadow-glow-lg transition-all"
                  disabled={!amount || parseFloat(amount) <= 0 || isBridging || attestationStatus !== null}
                  onClick={handleBridge}
                >
                  {isBridging ? (
                    <>
                      <Loader2 className="mr-2 w-5 h-5 animate-spin" />
                      Bridging to Arc...
                    </>
                  ) : (
                    <>
                      Bridge to Arc Testnet
                      <ArrowRight className="ml-2 w-5 h-5" />
                    </>
                  )}
                </Button>

                {/* Attestation Status - Waiting for Complete Button */}
                {attestationStatus && attestationStatus !== 'complete' && (
                  <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <div className="flex items-start gap-3">
                      <Clock className="w-5 h-5 text-blue-500 animate-pulse flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-blue-600 mb-1">
                          Step 1/2: Waiting for Circle Attestation
                        </p>
                        <p className="text-xs text-muted-foreground mb-2">
                          Status: <span className="font-medium">{attestationStatus}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          This takes 2-3 minutes. Once complete, a green "Complete Bridge" button will appear below. Click it to finish the transfer.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Complete Bridge Button - shown after attestation is ready */}
                {canCompleteBridge && (
                  <div className="space-y-3">
                    <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-green-600 mb-1">
                            Step 2/2: Ready to Complete Bridge
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Attestation verified! Click the button below to mint your USDC on Arc Testnet.
                          </p>
                        </div>
                      </div>
                    </div>
                    <Button
                      size="lg"
                      className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold text-lg py-6 shadow-glow hover:shadow-glow-lg transition-all animate-pulse"
                      disabled={isBridging}
                      onClick={completeBridge}
                    >
                      {isBridging ? (
                        <>
                          <Loader2 className="mr-2 w-5 h-5 animate-spin" />
                          Completing Bridge...
                        </>
                      ) : (
                        <>
                          Complete Bridge on Arc Testnet
                          <CheckCircle2 className="ml-2 w-5 h-5" />
                        </>
                      )}
                    </Button>
                  </div>
                )}

                {/* Info Note */}
                <p className="text-xs text-center text-muted-foreground">
                  Make sure you have enough ETH on Ethereum Sepolia to cover gas fees
                </p>

                {/* Transactions */}
                {transactions.length > 0 && (
                  <div className="space-y-3 pt-4 border-t border-border">
                    <Label>Transaction Status</Label>
                    <div className="space-y-2">
                      {transactions.map((tx, index) => (
                        <div
                          key={index}
                          className="p-3 rounded-lg bg-background border border-border"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                {tx.status === 'success' && (
                                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                                )}
                                {tx.status === 'failed' && (
                                  <XCircle className="w-4 h-4 text-red-500" />
                                )}
                                {tx.status === 'pending' && (
                                  <Clock className="w-4 h-4 text-yellow-500 animate-pulse" />
                                )}
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
            </div>

            {/* Features */}
            <div className="grid md:grid-cols-2 gap-4 mt-8">
              <div className="p-4 rounded-lg bg-card border border-border/50">
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  Native USDC Bridge
                </h3>
                <p className="text-sm text-muted-foreground">
                  Powered by Circle CCTP - no wrapped tokens, real USDC on both chains
                </p>
              </div>
              <div className="p-4 rounded-lg bg-card border border-border/50">
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-500" />
                  Two-Step Process
                </h3>
                <p className="text-sm text-muted-foreground">
                  Burn on Sepolia (~1 min) → Wait for attestation (~2-3 min) → Complete on Arc
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Bridge;
