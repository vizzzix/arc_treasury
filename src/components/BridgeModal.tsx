import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, ArrowLeftRight, Info, Loader2, ExternalLink, CheckCircle2, XCircle, Clock, RefreshCw, DollarSign } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useBridgeCCTP } from "@/hooks/useBridgeCCTP";
import { useUSDCBalance } from "@/hooks/useUSDCBalance";
import { useAccount } from "wagmi";
import { SUPPORTED_NETWORKS } from "@/lib/constants";
import { toast } from "sonner";

interface BridgeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}


export const BridgeModal = ({ open, onOpenChange }: BridgeModalProps) => {
  // Bridge direction: true = to Arc, false = from Arc
  // NOTE: Currently only Sepolia → Arc is supported with CCTP
  const [bridgeDirection, setBridgeDirection] = useState<boolean>(true);
  const { address } = useAccount();

  const fromNetwork: keyof typeof SUPPORTED_NETWORKS = bridgeDirection ? "ethereumSepolia" : "arcTestnet";
  const toNetwork: keyof typeof SUPPORTED_NETWORKS = bridgeDirection ? "arcTestnet" : "ethereumSepolia";

  // Get USDC balance for source network
  const { balance: fromBalance, isLoading: isLoadingFromBalance } = useUSDCBalance(fromNetwork);
  // Get USDC balance for destination network
  const { balance: toBalance, isLoading: isLoadingToBalance } = useUSDCBalance(toNetwork);

  const [amount, setAmount] = useState<string>("");
  const {
    bridge,
    completeBridge,
    isBridging,
    error,
    transactions,
    attestationStatus,
    canCompleteBridge,
    // Bridge Kit 1.3.0 new features
    estimateBridge,
    retryBridge,
    canRetry,
    isEstimating,
    estimate,
    steps,
  } = useBridgeCCTP();

  // Debounced estimate when amount changes
  useEffect(() => {
    if (!amount || parseFloat(amount) <= 0) return;

    const timer = setTimeout(() => {
      estimateBridge({ fromNetwork, toNetwork, amount });
    }, 500);

    return () => clearTimeout(timer);
  }, [amount, fromNetwork, toNetwork, estimateBridge]);

  const handleDirectionChange = (newDirection: boolean) => {
    setBridgeDirection(newDirection);
    setAmount(""); // Reset amount when changing direction
  };

  const handleBridge = async () => {
    if (!amount || parseFloat(amount) <= 0) return;

    await bridge({
      fromNetwork,
      toNetwork,
      amount,
    });

    // Close modal on success (handled by toast notification)
    if (!error && !isBridging) {
      setTimeout(() => {
        onOpenChange(false);
        setAmount("");
      }, 2000);
    }
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl">Bridge USDC</DialogTitle>
          <DialogDescription>
            Transfer USDC between Ethereum Sepolia and Arc Testnet using Circle CCTP
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Faucet Link */}
          <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs font-medium mb-1">Need testnet USDC or EURC?</p>
                <a 
                  href="https://faucet.circle.com/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                >
                  Get free tokens from Circle Faucet
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>

          {/* Direction Toggle */}
          <div className="flex items-center justify-center gap-4 p-3 rounded-lg bg-background/50 border border-border">
            <Button
              variant={bridgeDirection ? "default" : "outline"}
              onClick={() => handleDirectionChange(true)}
              disabled={isBridging}
              size="sm"
              className="flex-1"
            >
              To Arc
            </Button>
            <ArrowLeftRight className="w-4 h-4 text-muted-foreground" />
            <Button
              variant={!bridgeDirection ? "default" : "outline"}
              onClick={() => handleDirectionChange(false)}
              disabled={isBridging}
              size="sm"
              className="flex-1"
            >
              From Arc
            </Button>
          </div>

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

          {/* Fee Estimate (Bridge Kit 1.3.0) */}
          {(isEstimating || estimate) && (
            <div className="p-3 rounded-lg bg-background/50 border border-border">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs font-medium">Estimated Fees</span>
                {isEstimating && <Loader2 className="w-3 h-3 animate-spin ml-auto" />}
              </div>
              {estimate && (
                <div className="space-y-1">
                  {estimate.fees.map((fee, idx) => (
                    <div key={idx} className="flex justify-between text-xs">
                      <span className="text-muted-foreground capitalize">{fee.type} fee</span>
                      <span>{fee.amount} {fee.token}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-xs font-medium pt-1 border-t border-border">
                    <span>Total fees</span>
                    <span>{estimate.totalFees} USDC</span>
                  </div>
                  <div className="flex justify-between text-xs text-green-600">
                    <span>You receive</span>
                    <span>~{(parseFloat(amount || '0') - parseFloat(estimate.totalFees)).toFixed(2)} USDC</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Bridge Steps Progress (Bridge Kit 1.3.0) */}
          {steps.length > 0 && (
            <div className="p-3 rounded-lg bg-background/50 border border-border">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-medium">Bridge Progress</span>
              </div>
              <div className="flex items-center justify-between">
                {['approve', 'burn', 'fetchAttestation', 'mint'].map((stepName, idx) => {
                  const step = steps.find(s => s.name === stepName);
                  const isActive = step?.state === 'pending';
                  const isComplete = step?.state === 'success';
                  const isError = step?.state === 'error';
                  const stepLabels = { approve: 'Approve', burn: 'Burn', fetchAttestation: 'Attest', mint: 'Mint' };

                  return (
                    <div key={stepName} className="flex flex-col items-center gap-1">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-all ${
                        isComplete ? 'bg-green-500 text-white' :
                        isError ? 'bg-red-500 text-white' :
                        isActive ? 'bg-primary text-white animate-pulse' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {isComplete ? <CheckCircle2 className="w-4 h-4" /> :
                         isError ? <XCircle className="w-4 h-4" /> :
                         isActive ? <Loader2 className="w-4 h-4 animate-spin" /> :
                         idx + 1}
                      </div>
                      <span className="text-[10px] text-muted-foreground">{stepLabels[stepName as keyof typeof stepLabels]}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Error Message with Retry */}
          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <p className="text-sm text-destructive">{error}</p>
              {canRetry && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 w-full"
                  onClick={retryBridge}
                  disabled={isBridging}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Retry Bridge
                </Button>
              )}
            </div>
          )}

          {/* Bridge Button */}
          <Button
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-lg py-6 shadow-glow hover:shadow-glow-lg transition-all"
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
                {bridgeDirection ? 'Bridge to Arc' : 'Bridge from Arc'}
                <ArrowRight className="ml-2 w-5 h-5" />
              </>
            )}
          </Button>

          {/* Attestation Status - Waiting for Complete Button */}
          {attestationStatus && attestationStatus !== 'complete' && transactions.length > 0 && (
            <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <div className="flex items-start gap-2">
                <Clock className="w-4 h-4 text-blue-500 animate-pulse flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs font-medium text-blue-600 mb-1">
                    Step 1/2: Waiting for Circle Attestation
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Status: <span className="font-medium">{attestationStatus}</span>. Takes ~30 sec. Green button will appear when ready.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Complete Bridge Button - shown after attestation is ready */}
          {canCompleteBridge && (
            <div className="space-y-2">
              <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs font-medium text-green-600 mb-1">
                      Step 2/2: Ready to Complete
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Click below to mint USDC on Arc Testnet
                    </p>
                  </div>
                </div>
              </div>
              <Button
                className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-4 animate-pulse"
                disabled={isBridging}
                onClick={completeBridge}
              >
                {isBridging ? (
                  <>
                    <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                    Completing...
                  </>
                ) : (
                  <>
                    Complete Bridge on Arc
                    <CheckCircle2 className="ml-2 w-4 h-4" />
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Transactions */}
          {transactions.length > 0 && (
            <div className="space-y-3 pt-4 border-t border-border">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Transaction History</Label>
              </div>
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {transactions.map((tx, index) => (
                  <div
                    key={index}
                    className="p-3 rounded-lg bg-background border border-border"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {tx.status === 'success' && (
                            <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                          )}
                          {tx.status === 'failed' && (
                            <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                          )}
                          {tx.status === 'pending' && (
                            <Clock className="w-4 h-4 text-yellow-500 animate-pulse flex-shrink-0" />
                          )}
                          <span className="text-xs font-medium truncate">{tx.step}</span>
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
                          className="text-primary hover:underline flex items-center gap-1 text-xs flex-shrink-0"
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

          {/* Powered By */}
          <p className="text-center text-xs text-muted-foreground">
            Powered by <span className="font-medium text-foreground">Circle CCTP</span> - Native USDC bridge with no wrapped tokens
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
