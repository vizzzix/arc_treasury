import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CONTRACT_ADDRESSES } from "@/contracts/contractAddresses";
import { useTreasury } from "@/contexts/TreasuryContext";
import { usePoints } from "@/contexts/PointsContext";
import { useWallet } from "@/contexts/WalletContext";
import { getSponsorshipMessage, updateGasStats } from "@/services/gasSponsorService";
import { toast } from "sonner";
import { RefreshCw, Star, Gift } from "lucide-react";

interface DepositWithdrawModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "deposit" | "withdraw";
  treasuryAddress: string;
}

const DepositWithdrawModal = ({ open, onOpenChange, mode, treasuryAddress }: DepositWithdrawModalProps) => {
  const { deposit, withdraw, approveToken, getTokenBalance, loading } = useTreasury();
  const { addDepositPoints, addWithdrawPoints } = usePoints();
  const { address } = useWallet();
  const [selectedToken, setSelectedToken] = useState<string>("USDC");
  const [amount, setAmount] = useState<string>("");
  const [tokenBalance, setTokenBalance] = useState<string>("0");
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [sponsorMessage, setSponsorMessage] = useState<string | null>(null);

  const tokens = [
    { symbol: "USDC", address: CONTRACT_ADDRESSES.USDC },
    { symbol: "EURC", address: CONTRACT_ADDRESSES.EURC },
    { symbol: "XSGD", address: CONTRACT_ADDRESSES.XSGD },
  ];

  // Load balance and check gas sponsorship when modal opens
  useEffect(() => {
    if (open && selectedToken) {
      loadBalance();
      
      // Check if gas is sponsored
      if (address) {
        const message = getSponsorshipMessage(address, mode);
        setSponsorMessage(message);
      }
    }
  }, [open, selectedToken, address, mode]);

  const loadBalance = async () => {
    console.log("🔄 Modal: Loading balance for", selectedToken);
    setLoadingBalance(true);
    setTokenBalance("0"); // Сбрасываем перед загрузкой
    
    try {
      const tokenInfo = tokens.find(t => t.symbol === selectedToken);
      if (!tokenInfo || !tokenInfo.address) {
        console.error("❌ Token info not found for:", selectedToken);
        setTokenBalance("0");
        return;
      }
      
      console.log("🔍 Modal: Getting balance for address:", tokenInfo.address);
      const balance = await getTokenBalance(tokenInfo.address);
      console.log("✅ Modal: Balance received:", balance);
      
      setTokenBalance(balance || "0");
    } catch (error) {
      console.error("❌ Modal: Error loading balance:", error);
      setTokenBalance("0");
    } finally {
      setLoadingBalance(false);
    }
  };

  const handleTokenChange = async (token: string) => {
    setSelectedToken(token);
  };

  const handleMaxClick = () => {
    setAmount(tokenBalance);
  };

  const handleSubmit = async () => {
    const amountNum = parseFloat(amount);
    const balanceNum = parseFloat(tokenBalance);

    if (!amount || amountNum <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    if (amountNum > balanceNum) {
      toast.error(`Insufficient balance! You have ${balanceNum.toFixed(2)} ${selectedToken}`);
      return;
    }

    if (!treasuryAddress || treasuryAddress === "") {
      toast.error("Treasury address not found. Please create a treasury first.");
      return;
    }

    const tokenInfo = tokens.find(t => t.symbol === selectedToken);
    if (!tokenInfo) {
      toast.error("Token not found");
      return;
    }

    console.log("💰 Depositing:", amountNum, selectedToken);
    console.log("💳 Balance:", balanceNum);
    console.log("✅ Validation passed!");

    if (mode === "deposit") {
      // First approve
      const approved = await approveToken(tokenInfo.address, CONTRACT_ADDRESSES.AITreasury, amount);
      if (!approved) return;

      // Then deposit
      const success = await deposit(treasuryAddress, tokenInfo.address, amount);
      if (success) {
        // Update gas stats
        if (address) {
          updateGasStats(address, "deposit");
        }
        
        // Award points for deposit
        const amountNum = parseFloat(amount);
        addDepositPoints(amountNum);
        
        const pointsEarned = Math.floor(amountNum * 0.01);
        const message = sponsorMessage 
          ? `${sponsorMessage} • +${pointsEarned} points earned! ⭐`
          : `Deposit successful! +${pointsEarned} points earned! ⭐`;
        
        toast.success(message);
        
        onOpenChange(false);
        setAmount("");
      }
    } else {
      const success = await withdraw(treasuryAddress, tokenInfo.address, amount);
      if (success) {
        // Update gas stats
        if (address) {
          updateGasStats(address, "withdraw");
        }
        
        // Award points for withdrawal
        const amountNum = parseFloat(amount);
        addWithdrawPoints(amountNum);
        
        const pointsEarned = Math.floor(amountNum * 0.005);
        toast.success(`Withdrawal successful! +${pointsEarned} points earned! ⭐`);
        
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
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  Balance: {loadingBalance ? "Loading..." : parseFloat(tokenBalance).toLocaleString()}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={loadBalance}
                  disabled={loadingBalance}
                  className="h-6 w-6 p-0"
                >
                  <RefreshCw className={`w-3 h-3 ${loadingBalance ? 'animate-spin' : ''}`} />
                </Button>
              </div>
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

          {mode === "deposit" && sponsorMessage && (
            <div className="p-3 rounded-lg bg-success/10 border border-success/20 text-sm flex items-start gap-2">
              <Gift className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
              <p className="text-success font-medium">
                {sponsorMessage}
              </p>
            </div>
          )}
          
          {mode === "deposit" && !sponsorMessage && (
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

