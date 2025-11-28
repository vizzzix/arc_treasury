import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2, ExternalLink } from "lucide-react";
import { formatUnits, parseUnits } from "viem";
import { arcTestnet } from "@/lib/wagmi";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Currency = "USDC" | "EURC";

// Testnet Teller limit - max deposit per conversion transaction
const TESTNET_DEPOSIT_LIMIT = 90;

interface DepositModalContentProps {
  onClose: () => void;
  onDeposit: (amount: string, currency: Currency) => Promise<void>;
  availableBalanceUSDC: number;
  availableBalanceEURC: number;
  isPending: boolean;
  txHash?: `0x${string}`;
  isConfirmed: boolean;
  pricePerShare: string;
}

export const DepositModalContent = ({
  onClose,
  onDeposit,
  availableBalanceUSDC,
  availableBalanceEURC,
  isPending,
  txHash,
  isConfirmed,
  pricePerShare,
}: DepositModalContentProps) => {
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<Currency>("USDC");
  const [error, setError] = useState("");

  const availableBalance = currency === "USDC" ? availableBalanceUSDC : availableBalanceEURC;

  const handleMax = () => {
    const maxAmount = Math.min(availableBalance, TESTNET_DEPOSIT_LIMIT);
    setAmount(maxAmount.toFixed(6));
    setError("");
  };

  const handleDeposit = async () => {
    setError("");

    if (!amount || parseFloat(amount) <= 0) {
      setError("Please enter a valid amount");
      return;
    }

    if (parseFloat(amount) > availableBalance) {
      setError("Insufficient balance");
      return;
    }

    if (parseFloat(amount) > TESTNET_DEPOSIT_LIMIT) {
      setError(`Testnet limit: max ${TESTNET_DEPOSIT_LIMIT} ${currency} per deposit`);
      return;
    }

    try {
      await onDeposit(amount, currency);
    } catch (err: any) {
      setError(err.message || "Deposit failed");
    }
  };

  // Reset amount when currency changes
  const handleCurrencyChange = (value: string) => {
    setCurrency(value as Currency);
    setAmount("");
    setError("");
  };

  // Calculate estimated shares
  const estimatedShares = amount && parseFloat(amount) > 0
    ? (parseFloat(amount) / parseFloat(pricePerShare)).toFixed(4)
    : "0";
  
  // Format price per share to 4 decimal places
  const formattedPricePerShare = parseFloat(pricePerShare).toFixed(4);

  return (
    <div className="space-y-4 py-4">
      {isConfirmed && txHash ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
            <CheckCircle2 className="w-5 h-5" />
            <span className="font-semibold">Deposit successful!</span>
          </div>
          {txHash && (
            <div className="p-4 rounded-lg bg-muted">
              <p className="text-sm text-muted-foreground mb-2">Transaction Hash:</p>
              <a
                href={`${arcTestnet.blockExplorers.default.url}/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline flex items-center gap-1"
              >
                {txHash.slice(0, 10)}...{txHash.slice(-8)}
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
          <p className="text-sm text-muted-foreground text-center">
            Your deposit has been confirmed on the blockchain.
          </p>
          <Button className="w-full" onClick={onClose}>
            Close
          </Button>
        </div>
      ) : (isPending || (txHash && !isConfirmed)) ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-primary">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="font-semibold">
              {txHash ? "Transaction confirming..." : "Transaction in progress..."}
            </span>
          </div>
          {txHash && (
            <div className="p-4 rounded-lg bg-muted">
              <p className="text-sm text-muted-foreground mb-2">Transaction Hash:</p>
              <a
                href={`${arcTestnet.blockExplorers.default.url}/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline flex items-center gap-1"
              >
                {txHash.slice(0, 10)}...{txHash.slice(-8)}
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
          <p className="text-sm text-muted-foreground text-center">
            {txHash 
              ? "Please wait while your transaction is being confirmed on the blockchain. If it takes too long, you can close this window and refresh the page."
              : "Please confirm the transaction in your wallet."}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Close
            </Button>
            <Button 
              variant="default" 
              className="flex-1" 
              onClick={() => window.open(`https://testnet.arcscan.app/tx/${txHash}`, '_blank')}
              disabled={!txHash}
            >
              View on ArcScan
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {/* Currency Selection */}
            <div className="space-y-2">
              <Label>Select Currency</Label>
              <Tabs value={currency} onValueChange={handleCurrencyChange} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="USDC" disabled={isPending}>USDC</TabsTrigger>
                  <TabsTrigger value="EURC" disabled={isPending}>EURC</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Amount Input */}
            <div className="space-y-2">
              <Label htmlFor="amount">Amount ({currency})</Label>
              <div className="flex gap-2">
                <Input
                  id="amount"
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    setError("");
                  }}
                  disabled={isPending}
                  step="0.000001"
                  min="0"
                  className="[&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleMax}
                  disabled={isPending || availableBalance === 0}
                >
                  MAX
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Available: {currency === "USDC" ? "$" : "€"}{availableBalance.toFixed(2)} {currency}
                {" · "}
                <span className="text-amber-600 dark:text-amber-400">
                  Testnet limit: {TESTNET_DEPOSIT_LIMIT} {currency}
                </span>
              </p>
            </div>
          </div>

          {amount && parseFloat(amount) > 0 && (
            <div className="p-3 rounded-lg bg-muted">
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount:</span>
                  <span className="font-medium">
                    {currency === "USDC" ? "$" : "€"}{parseFloat(amount).toFixed(2)} {currency}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Price Per Share:</span>
                  <span className="font-medium">${formattedPricePerShare}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Estimated Shares:</span>
                  <span className="font-medium text-primary">{estimatedShares}</span>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={onClose}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleDeposit}
              disabled={isPending || !amount || parseFloat(amount) <= 0}
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                "Deposit"
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  );
};

