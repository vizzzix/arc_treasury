import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DollarSign, RefreshCw, TrendingUp } from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import { useTreasury } from "@/contexts/TreasuryContext";
import { CONTRACT_ADDRESSES } from "@/contracts/contractAddresses";
import { toast } from "sonner";
import { ethers, Contract } from "ethers";
import { AI_TREASURY_ABI } from "@/contracts/abis";

interface TreasuryBalanceProps {
  treasuryAddress: string;
}

const TreasuryBalance = ({ treasuryAddress }: TreasuryBalanceProps) => {
  const { isConnected } = useWallet();
  const [balances, setBalances] = useState({ USDC: "0", EURC: "0", XSGD: "0" });
  const [loading, setLoading] = useState(false);

  const tokens = [
    { symbol: "USDC", address: CONTRACT_ADDRESSES.USDC, icon: "💵", color: "from-blue-500 to-blue-600" },
    { symbol: "EURC", address: CONTRACT_ADDRESSES.EURC, icon: "💶", color: "from-purple-500 to-purple-600" },
    { symbol: "XSGD", address: CONTRACT_ADDRESSES.XSGD, icon: "💴", color: "from-green-500 to-green-600" },
  ];

  const fetchTreasuryBalances = async () => {
    if (!isConnected || !treasuryAddress) return;

    setLoading(true);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new Contract(CONTRACT_ADDRESSES.AITreasury, AI_TREASURY_ABI, signer);

      const usdcBalance = await contract.getTokenBalance(treasuryAddress, CONTRACT_ADDRESSES.USDC);
      const eurcBalance = await contract.getTokenBalance(treasuryAddress, CONTRACT_ADDRESSES.EURC);
      const xsgdBalance = await contract.getTokenBalance(treasuryAddress, CONTRACT_ADDRESSES.XSGD);

      setBalances({
        USDC: ethers.formatUnits(usdcBalance, 6),
        EURC: ethers.formatUnits(eurcBalance, 6),
        XSGD: ethers.formatUnits(xsgdBalance, 6),
      });

      toast.success("Treasury balances updated!");
    } catch (error) {
      console.error("Error fetching treasury balances:", error);
      toast.error("Failed to fetch treasury balances");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isConnected && treasuryAddress) {
      fetchTreasuryBalances();
    }
  }, [isConnected, treasuryAddress]);

  const totalValue = Object.values(balances).reduce(
    (sum, balance) => sum + parseFloat(balance || "0"),
    0
  );

  return (
    <Card className="modern-card p-6 relative overflow-hidden">
      {/* Background gradient effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-success/5 via-transparent to-warning/5 pointer-events-none" />
      
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-muted-foreground mb-1">🏦 Treasury Balance</h3>
            <div className="flex items-center gap-2">
              <span className="text-3xl font-bold gradient-text">
                ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <TrendingUp className="w-5 h-5 text-warning" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Managed by smart contract
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={fetchTreasuryBalances}
            disabled={loading}
            className="hover:bg-primary/10"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        <div className="space-y-3">
          {tokens.map((token) => (
            <div
              key={token.symbol}
              className="flex items-center justify-between p-4 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors border border-border/50"
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${token.color} flex items-center justify-center text-xl`}>
                  {token.icon}
                </div>
                <div>
                  <div className="font-semibold">{token.symbol}</div>
                  <div className="text-xs text-muted-foreground">In Treasury</div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-lg">
                  {parseFloat(balances[token.symbol as keyof typeof balances] || "0").toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>
                <div className="text-xs text-muted-foreground">
                  ${parseFloat(balances[token.symbol as keyof typeof balances] || "0").toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Info */}
        <div className="mt-4 pt-4 border-t border-border/50">
          <p className="text-xs text-muted-foreground text-center">
            💡 These tokens are securely managed by the Treasury smart contract
          </p>
        </div>
      </div>
    </Card>
  );
};

export default TreasuryBalance;

