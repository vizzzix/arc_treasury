import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, ArrowDownLeft, Settings, RefreshCw, TrendingUp, Wallet, PlusCircle, Copy, ArrowRight, Trash2 } from "lucide-react";
import StatCard from "@/components/StatCard";
import DepositWithdrawModal from "@/components/DepositWithdrawModal";
import TokenBalance from "@/components/TokenBalance";
import TreasuryBalance from "@/components/TreasuryBalance";
import ArcBadge from "@/components/ArcBadge";
import { useTreasury } from "@/contexts/TreasuryContext";
import { useWallet } from "@/contexts/WalletContext";
import { usePoints } from "@/contexts/PointsContext";
import { CONTRACT_ADDRESSES } from "@/contracts/contractAddresses";
import { TreasuryMetadata } from "@/types/treasury";
import { toast } from "sonner";

const Dashboard = () => {
  const navigate = useNavigate();
  const { totalValueLocked, totalYieldGenerated, rebalance, deleteTreasury, loading, treasuries } = useTreasury();
  const { isConnected, address } = useWallet();
  const { applyReferralCode } = usePoints();
  const [depositModalOpen, setDepositModalOpen] = useState(false);
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
  const [treasuryAddress, setTreasuryAddress] = useState<string>("");
  const [treasuryMetadata, setTreasuryMetadata] = useState<TreasuryMetadata | null>(null);

  // Load treasury address and metadata from localStorage and contract
  useEffect(() => {
    if (address) {
      const savedTreasury = localStorage.getItem(`treasury_${address}`);
      const savedMetadata = localStorage.getItem(`treasury_metadata_${address}`);
      
      if (savedTreasury) {
        setTreasuryAddress(savedTreasury);
      } else if (treasuries.length > 0) {
        // Use first treasury from contract if no localStorage
        setTreasuryAddress(treasuries[0].address);
      }
      
      if (savedMetadata) {
        setTreasuryMetadata(JSON.parse(savedMetadata));
      }

      // Check for referral code in URL
      const urlParams = new URLSearchParams(window.location.search);
      const refCode = urlParams.get('ref');
      if (refCode) {
        const success = applyReferralCode(refCode);
        if (success) {
          toast.success(`Welcome! You've been referred by ${refCode}`);
          // Remove ref from URL
          window.history.replaceState({}, '', window.location.pathname);
        }
      }
    }
  }, [address, treasuries]);


  const handleRebalance = async () => {
    if (!isConnected || !treasuryAddress) {
      toast.error("Please create a treasury first");
      return;
    }
    await rebalance(treasuryAddress);
  };

  const handleDeleteTreasury = async () => {
    if (!isConnected || !treasuryAddress) {
      toast.error("No treasury selected");
      return;
    }

    if (!confirm("⚠️ Delete this Treasury? This action cannot be undone. Make sure all balances are zero.")) {
      return;
    }

    const success = await deleteTreasury(treasuryAddress);
    if (success) {
      setTreasuryAddress("");
      setTreasuryMetadata(null);
    }
  };

  const portfolioData = [
    { name: "USDC", percentage: 45, color: "bg-primary" },
    { name: "EURC", percentage: 35, color: "bg-accent" },
    { name: "XSGD", percentage: 20, color: "bg-success" },
  ];

  const allocationComparison = [
    { name: "USDC", target: 50, current: 45 },
    { name: "EURC", target: 30, current: 35 },
    { name: "XSGD", target: 20, current: 20 },
  ];

  return (
    <div className="min-h-screen pt-24 pb-12 px-4">
      <div className="container mx-auto max-w-7xl space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-4xl font-bold">Dashboard</h1>
              <ArcBadge variant="testnet" />
              <ArcBadge variant="gas" />
            </div>
            <p className="text-muted-foreground">
              Monitor and manage your treasury • Gas paid in USDC
            </p>
          </div>
          <div className="flex gap-3">
            <Button 
              className="gap-2 bg-gradient-to-r from-primary to-accent hover:opacity-90"
              onClick={handleRebalance}
              disabled={loading || !isConnected || !treasuryAddress}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              {loading ? "Rebalancing..." : "Rebalance Now"}
            </Button>
          </div>
        </div>

        {/* No Treasury - Prompt to Create */}
        {!treasuryAddress && isConnected && (
          <div className="modern-card p-8 border-2 border-primary/30 text-center">
            <div className="max-w-md mx-auto space-y-4">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mx-auto text-4xl">
                🏦
              </div>
              <h3 className="text-2xl font-bold">No Treasury Yet</h3>
              <p className="text-muted-foreground">
                Create your first automated stablecoin portfolio
              </p>
              <Button 
                size="lg"
                onClick={() => navigate("/create")}
                className="gap-2 bg-gradient-to-r from-primary to-accent hover:opacity-90"
              >
                <PlusCircle className="w-5 h-5" />
                Create Treasury
                <ArrowRight className="w-5 h-5" />
              </Button>
            </div>
          </div>
        )}

        {/* Treasury Management */}
        {treasuryAddress && isConnected && (
          <div className="modern-card p-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-4 flex-1">
                {/* Treasury Avatar & Name */}
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-3xl border-2 border-primary/20">
                  {treasuryMetadata?.avatar || "🏦"}
                </div>
                
                <div className="flex-1">
                  <h3 className="text-xl font-bold mb-1">
                    {treasuryMetadata?.name || "My Treasury"}
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">
                      {treasuryAddress.slice(0, 10)}...{treasuryAddress.slice(-8)}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        navigator.clipboard.writeText(treasuryAddress);
                        toast.success("Treasury address copied!");
                      }}
                      className="h-5 w-5 p-0"
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                  <a 
                    href={`https://testnet.arcscan.app/address/${treasuryAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline inline-block"
                  >
                    View on ArcScan ↗
                  </a>
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate("/create")}
                  className="gap-2"
                >
                  <PlusCircle className="w-4 h-4" />
                  New Treasury
                </Button>
                
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleDeleteTreasury}
                  disabled={loading}
                  className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Balances Grid */}
        {treasuryAddress ? (
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Wallet Balance (кошелёк) */}
            <TokenBalance />
            
            {/* Treasury Balance (контракт) */}
            <TreasuryBalance treasuryAddress={treasuryAddress} />
          </div>
        ) : (
          <TokenBalance />
        )}

        {/* Quick Actions - COMPACT & MODERN */}
        {treasuryAddress && (
          <div className="modern-card p-6">
            <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
            <div className="grid grid-cols-3 gap-3">
              <Button 
                variant="outline"
                className="h-16 flex-col gap-1 hover:bg-success/10 hover:border-success/50 transition-all group"
                onClick={() => setDepositModalOpen(true)}
                disabled={!isConnected}
              >
                <ArrowDownLeft className="w-5 h-5 text-success group-hover:scale-110 transition-transform" />
                <span className="text-sm font-medium">Deposit</span>
              </Button>
              <Button 
                variant="outline"
                className="h-16 flex-col gap-1 hover:bg-primary/10 hover:border-primary/50 transition-all group"
                onClick={() => setWithdrawModalOpen(true)}
                disabled={!isConnected}
              >
                <ArrowUpRight className="w-5 h-5 text-primary group-hover:scale-110 transition-transform" />
                <span className="text-sm font-medium">Withdraw</span>
              </Button>
              <Button 
                variant="outline"
                className="h-16 flex-col gap-1 hover:bg-warning/10 hover:border-warning/50 transition-all group"
                onClick={handleRebalance}
                disabled={loading || !isConnected}
              >
                <RefreshCw className={`w-5 h-5 text-warning ${loading ? 'animate-spin' : ''} group-hover:scale-110 transition-transform`} />
                <span className="text-sm font-medium">{loading ? "Rebalancing..." : "Rebalance"}</span>
              </Button>
            </div>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="modern-card p-4 hover:border-primary/30 transition-all">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Wallet className="w-4 h-4" />
              <span>Treasury Balance</span>
            </div>
            <div className="text-2xl font-bold">${parseFloat(totalValueLocked || "0").toLocaleString()}</div>
          </div>
          <div className="modern-card p-4 hover:border-success/30 transition-all">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <TrendingUp className="w-4 h-4" />
              <span>Total Yield</span>
            </div>
            <div className="text-2xl font-bold text-success">${parseFloat(totalYieldGenerated || "0").toLocaleString()}</div>
          </div>
          <div className="modern-card p-4 hover:border-warning/30 transition-all">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <RefreshCw className="w-4 h-4" />
              <span>Rebalances</span>
            </div>
            <div className="text-2xl font-bold">0</div>
          </div>
          <div className="modern-card p-4 hover:border-accent/30 transition-all">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <TrendingUp className="w-4 h-4" />
              <span>APY</span>
            </div>
            <div className="text-2xl font-bold text-accent">8.5%</div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Portfolio Allocation */}
          <div className="modern-card rounded-xl p-6">
            <h2 className="text-xl font-bold mb-6">Portfolio Allocation</h2>
            <div className="space-y-6">
              <div className="relative w-48 h-48 mx-auto">
                <svg viewBox="0 0 100 100" className="transform -rotate-90">
                  {portfolioData.reduce((acc, item, index) => {
                    const prevPercentage = portfolioData.slice(0, index).reduce((sum, p) => sum + p.percentage, 0);
                    const strokeDasharray = `${item.percentage} ${100 - item.percentage}`;
                    const strokeDashoffset = -prevPercentage;
                    
                    acc.push(
                      <circle
                        key={index}
                        cx="50"
                        cy="50"
                        r="40"
                        fill="none"
                        stroke={`hsl(var(--${item.name === 'USDC' ? 'primary' : item.name === 'EURC' ? 'accent' : 'success'}))`}
                        strokeWidth="20"
                        strokeDasharray={strokeDasharray}
                        strokeDashoffset={strokeDashoffset}
                        className="transition-all duration-500"
                      />
                    );
                    return acc;
                  }, [] as JSX.Element[])}
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-3xl font-bold">$125K</div>
                    <div className="text-sm text-muted-foreground">Total</div>
                  </div>
                </div>
              </div>
              
              <div className="space-y-3">
                {portfolioData.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${item.color}`} />
                      <span className="font-medium">{item.name}</span>
                    </div>
                    <span className="font-bold">{item.percentage}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Target vs Current Allocation */}
          <div className="modern-card rounded-xl p-6">
            <h2 className="text-xl font-bold mb-6">Your Treasury</h2>
            <div className="space-y-6">
              {allocationComparison.map((item, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{item.name}</span>
                    <span className="text-muted-foreground">
                      Target: {item.target}% | Current: {item.current}%
                    </span>
                  </div>
                  <div className="space-y-1">
                    <div className="h-3 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-500"
                        style={{ width: `${item.target}%` }}
                      />
                    </div>
                    <div className="h-3 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-muted rounded-full transition-all duration-500"
                        style={{ width: `${item.current}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

      {/* Modals */}
      <DepositWithdrawModal
        open={depositModalOpen}
        onOpenChange={setDepositModalOpen}
        mode="deposit"
        treasuryAddress={treasuryAddress}
      />
      <DepositWithdrawModal
        open={withdrawModalOpen}
        onOpenChange={setWithdrawModalOpen}
        mode="withdraw"
        treasuryAddress={treasuryAddress}
      />
    </div>
  );
};

export default Dashboard;
