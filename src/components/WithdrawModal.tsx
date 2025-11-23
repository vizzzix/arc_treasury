import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface WithdrawModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  usdcBalance: number;
  eurcBalance: number;
  onWithdraw: (amount: string, tokenType: "USDC" | "EURC") => Promise<void>;
  isPending: boolean;
}

export function WithdrawModal({
  open,
  onOpenChange,
  usdcBalance,
  eurcBalance,
  onWithdraw,
  isPending
}: WithdrawModalProps) {
  const [amount, setAmount] = useState("");
  const [tokenType, setTokenType] = useState<"USDC" | "EURC">("USDC");
  const { toast } = useToast();

  const availableBalance = tokenType === "USDC" ? usdcBalance : eurcBalance;

  const handleWithdraw = async () => {
    const amountNum = parseFloat(amount);

    if (!amount || amountNum <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid amount greater than 0",
        variant: "destructive",
      });
      return;
    }

    if (amountNum > availableBalance) {
      toast({
        title: "Insufficient Balance",
        description: `You only have ${availableBalance.toFixed(2)} ${tokenType} available`,
        variant: "destructive",
      });
      return;
    }

    try {
      await onWithdraw(amount, tokenType);
      // Success - show toast, close modal and clear form
      toast({
        title: "Withdrawal Successful",
        description: `${parseFloat(amount).toFixed(2)} ${tokenType} has been sent to your wallet`,
      });
      setAmount("");
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Withdrawal Failed",
        description: (error as Error).message,
        variant: "destructive",
      });
    }
  };

  const handleMaxClick = () => {
    setAmount(availableBalance.toString());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Withdraw from Flexible Balance</DialogTitle>
          <DialogDescription>
            Withdraw your flexible balance to your wallet
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
                <div className="text-left">
                  <div className="font-semibold">USDC</div>
                  <div className="text-xs opacity-80">${usdcBalance.toFixed(2)}</div>
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
                <div className="text-left">
                  <div className="font-semibold">EURC</div>
                  <div className="text-xs opacity-80">€{eurcBalance.toFixed(2)}</div>
                </div>
              </Button>
            </div>
          </div>

          {/* Amount Input */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="withdraw-amount">Amount</Label>
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
                id="withdraw-amount"
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={isPending}
                min="0"
                max={availableBalance}
              />
              <span className="text-sm text-muted-foreground font-medium">
                {tokenType}
              </span>
            </div>
            <div className="text-xs text-muted-foreground">
              Available: {availableBalance.toFixed(2)} {tokenType}
            </div>
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Funds will be transferred to your connected wallet address. Make sure you're on the correct network.
            </AlertDescription>
          </Alert>

          <div className="rounded-lg bg-muted p-3 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Withdrawal Fee</span>
              <span className="font-medium">0%</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">You will receive</span>
              <span className="font-medium">
                {amount ? parseFloat(amount).toFixed(2) : "0.00"} {tokenType}
              </span>
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
            onClick={handleWithdraw}
            disabled={isPending || !amount || parseFloat(amount) <= 0}
            className="flex-1 bg-primary hover:bg-primary/90"
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Withdrawing...
              </>
            ) : (
              `Withdraw ${tokenType}`
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
