import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { useTokenBalance } from "@/hooks/useTokenBalance";
import { TOKEN_ADDRESSES } from "@/lib/constants";
import { useUSYCPrice } from "@/hooks/useUSYCPrice";

interface DepositModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeposit: (amount: string, tokenType: "USDC" | "EURC") => Promise<void>;
  isPending: boolean;
}

export function DepositModal({ open, onOpenChange, onDeposit, isPending }: DepositModalProps) {
  const [amount, setAmount] = useState("");
  const [tokenType, setTokenType] = useState<"USDC" | "EURC">("USDC");
  const { toast } = useToast();

  // Get real-time USYC APY
  const { apy } = useUSYCPrice();

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

  const handleDeposit = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid amount greater than 0",
        variant: "destructive",
      });
      return;
    }

    try {
      await onDeposit(amount, tokenType);
      // Success - show toast, close modal and clear form
      toast({
        title: "Deposit Successful",
        description: `${parseFloat(amount).toFixed(2)} ${tokenType} deposited to your flexible balance`,
      });
      setAmount("");
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Deposit Failed",
        description: (error as Error).message,
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Deposit to Flexible Balance</DialogTitle>
          <DialogDescription>
            Earn yield with flexible withdrawals anytime.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
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
              <Label htmlFor="amount">Amount</Label>
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
                id="amount"
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={isPending}
                min="0"
                className="hide-number-spinner"
              />
              <span className="text-sm text-muted-foreground font-medium">
                {tokenType}
              </span>
            </div>
            <div className="text-xs text-muted-foreground">
              Available: {availableBalance} {tokenType}
            </div>
          </div>

          <div className="rounded-lg bg-muted p-3 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Current APY</span>
              <span className="font-medium">{apy.toFixed(2)}%</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Withdrawal</span>
              <span className="font-medium">Anytime</span>
            </div>
          </div>
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
            onClick={handleDeposit}
            disabled={isPending || !amount}
            className="flex-1 bg-primary hover:bg-primary/90"
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Depositing...
              </>
            ) : (
              `Deposit ${tokenType}`
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
