import { useState, useEffect } from "react";
import { DollarSign, TrendingUp, RefreshCw } from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import { useTreasury } from "@/contexts/TreasuryContext";
import { CONTRACT_ADDRESSES } from "@/contracts/contractAddresses";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const TokenBalance = () => {
  const { address, isConnected } = useWallet();
  const { getTokenBalance } = useTreasury();
  const [balances, setBalances] = useState({
    USDC: "0",
    EURC: "0",
    XSGD: "0",
  });
  const [loading, setLoading] = useState(false);

  const tokens = [
    { symbol: "USDC", address: CONTRACT_ADDRESSES.USDC, icon: "💵", color: "from-blue-500 to-blue-600" },
    { symbol: "EURC", address: CONTRACT_ADDRESSES.EURC, icon: "💶", color: "from-purple-500 to-purple-600" },
    { symbol: "XSGD", address: CONTRACT_ADDRESSES.XSGD, icon: "💴", color: "from-green-500 to-green-600" },
  ];

  const fetchBalances = async () => {
    if (!isConnected || !address) return;

    setLoading(true);
    try {
      const usdcBalance = await getTokenBalance(CONTRACT_ADDRESSES.USDC);
      const eurcBalance = await getTokenBalance(CONTRACT_ADDRESSES.EURC);
      const xsgdBalance = await getTokenBalance(CONTRACT_ADDRESSES.XSGD);

      setBalances({
        USDC: usdcBalance,
        EURC: eurcBalance,
        XSGD: xsgdBalance,
      });
    } catch (error) {
      console.error("Error fetching balances:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isConnected && address) {
      // Добавляем небольшую задержку для инициализации контрактов
      const timer = setTimeout(() => {
        fetchBalances();
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [isConnected, address]);

  if (!isConnected) {
    return (
      <Card className="modern-card p-6">
        <div className="text-center py-8">
          <DollarSign className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Connect wallet to view balances</p>
        </div>
      </Card>
    );
  }

  // Проверка задеплоены ли контракты
  const hasValidContracts = CONTRACT_ADDRESSES.USDC !== "0x0000000000000000000000000000000000000000";
  
  if (!hasValidContracts) {
    return (
      <Card className="modern-card p-6">
        <div className="text-center py-8">
          <DollarSign className="w-12 h-12 mx-auto mb-4 text-warning" />
          <p className="text-warning font-semibold mb-2">Contracts not deployed</p>
          <p className="text-sm text-muted-foreground">
            Please deploy contracts to Arc Testnet first
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Run: npm run deploy
          </p>
        </div>
      </Card>
    );
  }

  const totalValue = Object.values(balances).reduce(
    (sum, balance) => sum + parseFloat(balance || "0"),
    0
  );

  return (
    <Card className="modern-card p-6 relative overflow-hidden">
      {/* Background gradient effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 pointer-events-none" />
      
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-muted-foreground mb-1">Total Balance</h3>
            <div className="flex items-center gap-2">
              <span className="text-3xl font-bold gradient-text">
                ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <TrendingUp className="w-5 h-5 text-success" />
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={fetchBalances}
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
                <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${token.color} flex items-center justify-center text-xl glow-effect`}>
                  {token.icon}
                </div>
                <div>
                  <div className="font-semibold">{token.symbol}</div>
                  <div className="text-xs text-muted-foreground">Arc Testnet</div>
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

        {/* Network indicator */}
        <div className="mt-4 pt-4 border-t border-border/50">
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <span>Connected to Arc Testnet</span>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default TokenBalance;

