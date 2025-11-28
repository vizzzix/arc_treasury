import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, CheckCircle2, ExternalLink } from "lucide-react";
import { arcTestnet } from "@/lib/wagmi";

type Currency = "USDC" | "EURC";

interface WithdrawModalContentProps {
  onClose: () => void;
  onWithdraw: (shares: string, currency: Currency) => Promise<void>;
  userShares: string;
  userShareValue: string;
  pricePerShare: string;
  userEURCShares: string;
  userEURCShareValue: string;
  eurcPricePerShare: string;
  isPending: boolean;
  txHash?: `0x${string}`;
  isConfirmed: boolean;
}

export const WithdrawModalContent = ({
  onClose,
  onWithdraw,
  userShares,
  userShareValue,
  pricePerShare,
  userEURCShares,
  userEURCShareValue,
  eurcPricePerShare,
  isPending,
  txHash,
  isConfirmed,
}: WithdrawModalContentProps) => {
  const [shares, setShares] = useState("");
  const [error, setError] = useState("");
  const [currency, setCurrency] = useState<Currency>("USDC");

  // Get current currency values
  const currentUserShares = currency === "USDC" ? userShares : userEURCShares;
  const currentUserShareValue = currency === "USDC" ? userShareValue : userEURCShareValue;
  const currentPricePerShare = currency === "USDC" ? pricePerShare : eurcPricePerShare;

  // userShares is already formatted as a string with proper decimals
  const userSharesNum = parseFloat(currentUserShares) || 0;
  const userShareValueNum = parseFloat(currentUserShareValue) || 0;
  const pricePerShareNum = parseFloat(currentPricePerShare) || 0;

  const handleCurrencyChange = (value: string) => {
    setCurrency(value as Currency);
    setShares("");
    setError("");
  };

  const handleMax = () => {
    // currentUserShares is already formatted, so we can use it directly
    setShares(currentUserShares);
    setError("");
  };

  const handleWithdraw = async () => {
    setError("");
    
    if (!shares || parseFloat(shares) <= 0) {
      setError("Please enter a valid amount of shares");
      return;
    }

    if (parseFloat(shares) > userSharesNum) {
      setError("Insufficient shares");
      return;
    }

    try {
      await onWithdraw(shares, currency);
    } catch (err: any) {
      setError(err.message || "Withdraw failed");
    }
  };

  // Calculate estimated amount from shares
  // Both shares and pricePerShare are already formatted with proper decimals
  const estimatedAmount = shares && parseFloat(shares) > 0
    ? (parseFloat(shares) * pricePerShareNum).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : "0";

  return (
    <div className="space-y-4 py-4">
      {isConfirmed && txHash ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
            <CheckCircle2 className="w-5 h-5" />
            <span className="font-semibold">Withdraw successful!</span>
          </div>
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
          <p className="text-sm text-muted-foreground text-center">
            Your withdrawal has been confirmed on the blockchain.
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
          <Tabs value={currency} onValueChange={handleCurrencyChange} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="USDC" disabled={isPending}>USDC</TabsTrigger>
              <TabsTrigger value="EURC" disabled={isPending}>EURC</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="p-4 rounded-lg bg-muted space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Your Shares:</span>
              <span className="font-semibold">{parseFloat(currentUserShares).toLocaleString('en-US', { maximumFractionDigits: 4 })}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Your Share Value:</span>
              <span className="font-semibold text-primary">
                {currency === "USDC" ? "$" : "€"}{parseFloat(currentUserShareValue).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Price Per Share:</span>
              <span className="font-semibold">
                {currency === "USDC" ? "$" : "€"}{parseFloat(currentPricePerShare).toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="shares">Shares to Withdraw</Label>
            <div className="flex gap-2">
              <Input
                id="shares"
                type="number"
                placeholder="0"
                value={shares}
                onChange={(e) => {
                  setShares(e.target.value);
                  setError("");
                }}
                disabled={isPending || userSharesNum === 0}
                step="0.0001"
                min="0"
                max={currentUserShares}
                className="[&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleMax}
                disabled={isPending || userSharesNum === 0}
              >
                MAX
              </Button>
            </div>
          </div>

          {shares && parseFloat(shares) > 0 && (
            <div className="p-3 rounded-lg bg-muted">
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Shares:</span>
                  <span className="font-medium">{parseFloat(shares).toLocaleString('en-US', { maximumFractionDigits: 4 })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Estimated {currency}:</span>
                  <span className="font-medium text-primary">
                    {currency === "USDC" ? "$" : "€"}{estimatedAmount}
                  </span>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {userSharesNum === 0 && (
            <div className="p-3 rounded-lg bg-muted">
              <p className="text-sm text-muted-foreground">
                You don't have any shares in the vault. Deposit first to earn yield.
              </p>
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
              onClick={handleWithdraw}
              disabled={isPending || !shares || parseFloat(shares) <= 0 || userSharesNum === 0}
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                "Withdraw"
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  );
};

