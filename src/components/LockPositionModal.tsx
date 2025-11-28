import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { LockPeriod } from "@/components/LockPeriodSelector";
import { Loader2, Lock, TrendingUp, CheckCircle2, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTokenBalance } from "@/hooks/useTokenBalance";
import { TOKEN_ADDRESSES, SUPPORTED_NETWORKS } from "@/lib/constants";
import { useUSYCPrice } from "@/hooks/useUSYCPrice";

interface LockPositionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLock: (amount: string, tokenType: "USDC" | "EURC", lockPeriod: 1 | 3 | 12) => Promise<string | undefined>;
  isPending: boolean;
}

// Testnet Teller limit - max deposit per conversion transaction
const TESTNET_DEPOSIT_LIMIT = 90;

// Lock periods - APY is same for all, only Points multiplier differs
const LOCK_PERIODS = [
  {
    months: 1 as const,
    label: "1 Month",
    pointsMultiplier: "1.5x",
    description: "30 days locked",
  },
  {
    months: 3 as const,
    label: "3 Months",
    pointsMultiplier: "2x",
    description: "90 days locked",
    badge: "Popular",
  },
  {
    months: 12 as const,
    label: "12 Months",
    pointsMultiplier: "3x",
    description: "365 days locked",
    badge: "Most Points",
  },
];

export function LockPositionModal({ open, onOpenChange, onLock, isPending }: LockPositionModalProps) {
  const [amount, setAmount] = useState("");
  const [tokenType, setTokenType] = useState<"USDC" | "EURC">("USDC");
  const [selectedPeriod, setSelectedPeriod] = useState<1 | 3 | 12>(12);
  const { toast } = useToast();

  // Get real-time USYC APY (same for all lock periods)
  const { apy: baseAPY } = useUSYCPrice();

  // Get wallet balances
  const { balance: usdcBalance, isLoading: isLoadingUSDC } = useTokenBalance({
    tokenAddress: TOKEN_ADDRESSES.arcTestnet.USDC,
    decimals: 18, // Native USDC uses 18 decimals (native currency)
  });

  const { balance: eurcBalance, isLoading: isLoadingEURC } = useTokenBalance({
    tokenAddress: TOKEN_ADDRESSES.arcTestnet.EURC,
    decimals: 6,
  });

  const availableBalance = tokenType === "USDC"
    ? (isLoadingUSDC ? "0" : usdcBalance)
    : (isLoadingEURC ? "0" : eurcBalance);

  const handleMaxClick = () => {
    const maxAmount = Math.min(parseFloat(availableBalance) || 0, TESTNET_DEPOSIT_LIMIT);
    setAmount(maxAmount.toString());
  };

  const handleLock = async () => {
    const amountNum = parseFloat(amount);

    if (!amount || amountNum <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid amount greater than 0",
        variant: "destructive",
      });
      return;
    }

    if (amountNum < 10) {
      toast({
        title: "Minimum Deposit Required",
        description: `Minimum deposit is ${tokenType === "USDC" ? "$" : "€"}10`,
        variant: "destructive",
      });
      return;
    }

    if (amountNum > TESTNET_DEPOSIT_LIMIT) {
      toast({
        title: "Testnet Limit",
        description: `Maximum ${TESTNET_DEPOSIT_LIMIT} ${tokenType} per deposit on testnet`,
        variant: "destructive",
      });
      return;
    }

    try {
      const txHash = await onLock(amount, tokenType, selectedPeriod);
      // Success - show toast with tx link, close modal and clear form
      const explorerUrl = txHash ? `${SUPPORTED_NETWORKS.arcTestnet.explorerUrl}/tx/${txHash}` : null;
      toast({
        title: (
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            <span>Lock Position Created</span>
          </div>
        ) as unknown as string,
        description: (
          <div className="space-y-1.5">
            <p>{parseFloat(amount).toFixed(2)} {tokenType} locked for {selectedPeriod} month{selectedPeriod > 1 ? 's' : ''}</p>
            {explorerUrl && (
              <a
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline text-xs"
              >
                View transaction
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        ) as unknown as string,
      });
      setAmount("");
      onOpenChange(false);
    } catch (error) {
      // Only show error if modal is still open (not a delayed/stale error)
      if (!open) return;

      const errorMessage = (error as Error).message;
      // Show user-friendly message for common errors
      let description = "An error occurred during lock";
      if (errorMessage.includes("User rejected") || errorMessage.includes("user rejected")) {
        description = "Transaction was cancelled";
      } else if (errorMessage.includes("insufficient funds")) {
        description = "Insufficient funds for gas";
      } else if (errorMessage.includes("failed on blockchain") || errorMessage.includes("reverted")) {
        description = "Transaction failed - please try again";
      } else if (errorMessage.length < 100) {
        description = errorMessage;
      }
      toast({
        title: "Lock Failed",
        description,
        variant: "destructive",
      });
    }
  };

  const selectedPeriodData = LOCK_PERIODS.find(p => p.months === selectedPeriod);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5" />
            Create Lock Position
          </DialogTitle>
          <DialogDescription>
            Lock your stablecoins to earn more Points for future ARC token rewards
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Token Selection */}
          <div className="space-y-2">
            <Label>Select Token</Label>
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant={tokenType === "USDC" ? "default" : "outline"}
                onClick={() => {
                  setTokenType("USDC");
                  setAmount("");
                }}
                disabled={isPending}
                className="h-auto py-3"
              >
                <div className="text-left w-full">
                  <div className="font-semibold">USDC</div>
                  <div className="text-xs opacity-80">
                    {isLoadingUSDC ? "Loading..." : `Available: ${usdcBalance}`}
                  </div>
                </div>
              </Button>
              <Button
                variant={tokenType === "EURC" ? "default" : "outline"}
                onClick={() => {
                  setTokenType("EURC");
                  setAmount("");
                }}
                disabled={isPending}
                className="h-auto py-3"
              >
                <div className="text-left w-full">
                  <div className="font-semibold">EURC</div>
                  <div className="text-xs opacity-80">
                    {isLoadingEURC ? "Loading..." : `Available: ${eurcBalance}`}
                  </div>
                </div>
              </Button>
            </div>
          </div>

          {/* Amount Input */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="lock-amount">Amount (min: {tokenType === "USDC" ? "$" : "€"}10)</Label>
              <button
                onClick={handleMaxClick}
                disabled={isPending}
                className="text-xs text-primary hover:underline font-medium"
              >
                MAX
              </button>
            </div>
            <div className="flex items-center gap-2">
              <Input
                id="lock-amount"
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={isPending}
                step="0.01"
                min="10"
              />
              <span className="text-sm text-muted-foreground font-medium">
                {tokenType}
              </span>
            </div>
            <div className="text-xs text-muted-foreground">
              Available: {availableBalance} {tokenType}
              {" · "}
              <span className="text-amber-600 dark:text-amber-400">
                Testnet limit: {TESTNET_DEPOSIT_LIMIT} {tokenType}
              </span>
            </div>
          </div>

          {/* Lock Period Selection */}
          <div className="space-y-3">
            <Label>Lock Period (same APY, more Points)</Label>
            <div className="grid grid-cols-3 gap-3">
              {LOCK_PERIODS.map((period) => (
                <button
                  key={period.months}
                  onClick={() => setSelectedPeriod(period.months)}
                  disabled={isPending}
                  className={cn(
                    "relative p-4 rounded-lg border-2 text-left transition-all",
                    "hover:border-primary/50",
                    selectedPeriod === period.months
                      ? "border-primary bg-primary/5"
                      : "border-border",
                    isPending && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {period.badge && (
                    <div className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full font-semibold">
                      {period.badge}
                    </div>
                  )}
                  <div className="space-y-1">
                    <div className="font-semibold">{period.label}</div>
                    <div className="text-2xl font-bold text-primary">
                      {period.pointsMultiplier}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {period.description}
                    </div>
                    <div className="text-xs text-green-600 dark:text-green-400">
                      ~{baseAPY.toFixed(2)}% APY
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Summary */}
          {selectedPeriodData && (
            <div className="rounded-lg bg-gradient-to-br from-primary/10 to-green-500/10 border border-primary/20 p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <TrendingUp className="w-4 h-4 text-primary" />
                Position Summary
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-muted-foreground">Lock Period</div>
                  <div className="font-semibold">{selectedPeriodData.label}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">APY</div>
                  <div className="font-semibold text-green-600 dark:text-green-400">
                    ~{baseAPY.toFixed(2)}%*
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Points Multiplier</div>
                  <div className="font-semibold text-primary">{selectedPeriodData.pointsMultiplier}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Early Withdrawal</div>
                  <div className="font-semibold text-orange-500">25% penalty</div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground pt-2 border-t border-border/30">
                *APY is variable based on USYC T-Bill yield. Same APY for all lock periods.
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleLock}
            disabled={isPending || !amount || parseFloat(amount) < 10}
            className="flex-1 bg-primary hover:bg-primary/90"
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating Lock...
              </>
            ) : (
              <>
                <Lock className="w-4 h-4 mr-2" />
                Create Lock Position
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
