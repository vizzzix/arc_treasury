import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CONTRACT_ADDRESSES } from "@/contracts/contractAddresses";
import { useTreasury } from "@/contexts/TreasuryContext";

interface DepositWithdrawModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "deposit" | "withdraw";
  treasuryAddress: string;
}

const DepositWithdrawModal = ({ open, onOpenChange, mode, treasuryAddress }: DepositWithdrawModalProps) => {
  const { deposit, withdraw, approveToken, getTokenBalance, loading } = useTreasury();
  const [selectedToken, setSelectedToken] = useState<string>("USDC");
  const [amount, setAmount] = useState<string>("");
  const [tokenBalance, setTokenBalance] = useState<string>("0");

  const tokens = [
    { symbol: "USDC", address: CONTRACT_ADDRESSES.USDC },
    { symbol: "EURC", address: CONTRACT_ADDRESSES.EURC },
    { symbol: "XSGD", address: CONTRACT_ADDRESSES.XSGD },
  ];

  const handleTokenChange = async (token: string) => {
    setSelectedToken(token);
    const tokenInfo = tokens.find(t => t.symbol === token);
    if (tokenInfo) {
      const balance = await getTokenBalance(tokenInfo.address);
      setTokenBalance(balance);
    }
  };

  const handleMaxClick = () => {
    setAmount(tokenBalance);
  };

  const handleSubmit = async () => {
    if (!amount || parseFloat(amount) <= 0) return;

    const tokenInfo = tokens.find(t => t.symbol === selectedToken);
    if (!tokenInfo) return;

    if (mode === "deposit") {
      // First approve
      const approved = await approveToken(tokenInfo.address, CONTRACT_ADDRESSES.AITreasury, amount);
      if (!approved) return;

      // Then deposit
      const success = await deposit(treasuryAddress, tokenInfo.address, amount);
      if (success) {
        onOpenChange(false);
        setAmount("");
      }
    } else {
      const success = await withdraw(treasuryAddress, tokenInfo.address, amount);
      if (success) {
        onOpenChange(false);
        setAmount("");
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card border-border/50">
        <DialogHeader>
          <DialogTitle>{mode === "deposit" ? "Deposit Funds" : "Withdraw Funds"}</DialogTitle>
          <DialogDescription>
            {mode === "deposit" 
              ? "Add funds to your treasury. You'll need to approve the token first."
              : "Withdraw funds from your treasury."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Token</Label>
            <Select value={selectedToken} onValueChange={handleTokenChange}>
              <SelectTrigger className="glass-card">
                <SelectValue placeholder="Select token" />
              </SelectTrigger>
              <SelectContent className="glass-card border-border/50">
                {tokens.map((token) => (
                  <SelectItem key={token.symbol} value={token.symbol}>
                    {token.symbol}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label>Amount</Label>
              <span className="text-sm text-muted-foreground">
                Balance: {parseFloat(tokenBalance).toLocaleString()}
              </span>
            </div>
            <div className="flex gap-2">
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="glass-card"
              />
              <Button variant="outline" onClick={handleMaxClick} className="glass-card">
                MAX
              </Button>
            </div>
          </div>

          {mode === "deposit" && (
            <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 text-sm">
              <p className="text-muted-foreground">
                💡 Tip: Deposits under $100 have zero fees!
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="glass-card">
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={loading || !amount || parseFloat(amount) <= 0}
            className="bg-gradient-to-r from-primary to-accent hover:opacity-90"
          >
            {loading ? "Processing..." : mode === "deposit" ? "Deposit" : "Withdraw"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DepositWithdrawModal;

