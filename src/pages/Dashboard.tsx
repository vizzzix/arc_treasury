import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, ArrowDownLeft, Settings, RefreshCw, TrendingUp, Wallet } from "lucide-react";
import StatCard from "@/components/StatCard";
import DepositWithdrawModal from "@/components/DepositWithdrawModal";
import TokenBalance from "@/components/TokenBalance";
import { useTreasury } from "@/contexts/TreasuryContext";
import { useWallet } from "@/contexts/WalletContext";

const Dashboard = () => {
  const { totalValueLocked, totalYieldGenerated, rebalance, loading } = useTreasury();
  const { isConnected } = useWallet();
  const [depositModalOpen, setDepositModalOpen] = useState(false);
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
  
  // In a real implementation, you'd get this from the TreasuryContext
  // For now, using a placeholder
  const treasuryAddress = "0x0000000000000000000000000000000000000000";

  const handleRebalance = async () => {
    if (!isConnected || !treasuryAddress) return;
    await rebalance(treasuryAddress);
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
            <h1 className="text-4xl font-bold mb-2">Dashboard</h1>
            <p className="text-muted-foreground">Monitor and manage your treasury</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="gap-2 glass-card">
              <Settings className="w-4 h-4" />
              Settings
            </Button>
            <Button 
              className="gap-2 bg-gradient-to-r from-primary to-accent hover:opacity-90"
              onClick={handleRebalance}
              disabled={loading || !isConnected}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              {loading ? "Rebalancing..." : "Rebalance Now"}
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <StatCard
            title="Total Balance"
            value={`$${parseFloat(totalValueLocked || "0").toLocaleString()}`}
            change="+2.4%"
            icon={Wallet}
            trend="up"
          />
          <StatCard
            title="24h Yield"
            value="$142.50"
            change="+8.2%"
            icon={TrendingUp}
            trend="up"
          />
          <StatCard
            title="Total Yield"
            value={`$${parseFloat(totalYieldGenerated || "0").toLocaleString()}`}
            icon={TrendingUp}
            trend="up"
          />
          <StatCard
            title="Gas Spent"
            value="$23.45"
            icon={RefreshCw}
            trend="neutral"
          />
        </div>

        {/* Token Balances */}
        <TokenBalance />

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

        {/* Quick Actions */}
        <div className="grid md:grid-cols-4 gap-4">
          <Button 
            variant="outline" 
            className="h-auto py-6 glass-card flex-col gap-2"
            onClick={() => setDepositModalOpen(true)}
            disabled={!isConnected}
          >
            <ArrowDownLeft className="w-6 h-6 text-success" />
            <span className="font-medium">Deposit</span>
          </Button>
          <Button 
            variant="outline" 
            className="h-auto py-6 glass-card flex-col gap-2"
            onClick={() => setWithdrawModalOpen(true)}
            disabled={!isConnected}
          >
            <ArrowUpRight className="w-6 h-6 text-primary" />
            <span className="font-medium">Withdraw</span>
          </Button>
          <Button variant="outline" className="h-auto py-6 glass-card flex-col gap-2">
            <Settings className="w-6 h-6 text-accent" />
            <span className="font-medium">Adjust Strategy</span>
          </Button>
          <Button 
            variant="outline" 
            className="h-auto py-6 glass-card flex-col gap-2"
            onClick={handleRebalance}
            disabled={loading || !isConnected}
          >
            <RefreshCw className={`w-6 h-6 text-warning ${loading ? 'animate-spin' : ''}`} />
            <span className="font-medium">{loading ? "Rebalancing..." : "Rebalance Now"}</span>
          </Button>
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
