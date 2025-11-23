import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { LockPeriod } from "@/components/LockPeriodSelector";
import { Loader2, Lock, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTokenBalance } from "@/hooks/useTokenBalance";
import { TOKEN_ADDRESSES } from "@/lib/constants";
import { useUSYCPrice } from "@/hooks/useUSYCPrice";

interface LockPositionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLock: (amount: string, tokenType: "USDC" | "EURC", lockPeriod: 1 | 3 | 12) => Promise<void>;
  isPending: boolean;
}

// Lock periods with APY boost multipliers (applied to base USYC APY)
const LOCK_PERIODS = [
  {
    months: 1 as const,
    label: "1 Month",
    boostMultiplier: 1.17, // +17% APY boost
    boost: "+17%",
    pointsMultiplier: "1.5x",
    description: "30 days locked",
  },
  {
    months: 3 as const,
    label: "3 Months",
    boostMultiplier: 1.35, // +35% APY boost
    boost: "+35%",
    pointsMultiplier: "2x",
    description: "90 days locked",
  },
  {
    months: 12 as const,
    label: "12 Months",
    boostMultiplier: 1.69, // +69% APY boost
    boost: "+69%",
    pointsMultiplier: "3x",
    description: "365 days locked",
    popular: true,
  },
];

export function LockPositionModal({ open, onOpenChange, onLock, isPending }: LockPositionModalProps) {
  const [amount, setAmount] = useState("");
  const [tokenType, setTokenType] = useState<"USDC" | "EURC">("USDC");
  const [selectedPeriod, setSelectedPeriod] = useState<1 | 3 | 12>(12);
  const { toast } = useToast();

  // Get real-time USYC APY
  const { apy: baseAPY } = useUSYCPrice();

  // Calculate boosted APY for a lock period
  const getLockedAPY = (boostMultiplier: number) => {
    return baseAPY * boostMultiplier;
  };

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
    setAmount(availableBalance);
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

    try {
      await onLock(amount, tokenType, selectedPeriod);
      // Success - show toast, close modal and clear form
      toast({
        title: "Lock Position Created",
        description: `${parseFloat(amount).toFixed(2)} ${tokenType} locked for ${selectedPeriod} month${selectedPeriod > 1 ? 's' : ''}`,
      });
      setAmount("");
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Lock Failed",
        description: (error as Error).message,
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
            Lock your stablecoins for higher APY and bonus points multiplier
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
            </div>
          </div>

          {/* Lock Period Selection */}
          <div className="space-y-3">
            <Label>Lock Period</Label>
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
                  {period.popular && (
                    <div className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full font-semibold">
                      Popular
                    </div>
                  )}
                  <div className="space-y-1">
                    <div className="font-semibold">{period.label}</div>
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {getLockedAPY(period.boostMultiplier).toFixed(2)}%
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {period.description}
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-green-600 dark:text-green-400">
                        {period.boost} APY
                      </span>
                      <span className="text-primary">
                        {period.pointsMultiplier} points
                      </span>
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
                    {getLockedAPY(selectedPeriodData.boostMultiplier).toFixed(2)}%
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
