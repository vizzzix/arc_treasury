import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Shield, Zap, TrendingUp, ArrowRight } from "lucide-react";
import { useTreasury } from "@/contexts/TreasuryContext";
import { useWallet } from "@/contexts/WalletContext";
import { CONTRACT_ADDRESSES } from "@/contracts/contractAddresses";

const CreateTreasury = () => {
  const navigate = useNavigate();
  const { createTreasury, loading } = useTreasury();
  const { isConnected } = useWallet();
  
  const [allocations, setAllocations] = useState({
    USDC: 50,
    EURC: 30,
    XSGD: 20,
  });
  
  const [autoYield, setAutoYield] = useState(true);
  const [rebalanceThreshold, setRebalanceThreshold] = useState("5");

  const templates = [
    {
      name: "Conservative",
      icon: Shield,
      allocation: { USDC: 70, EURC: 20, XSGD: 10 },
      description: "Low risk, stable returns",
    },
    {
      name: "Balanced",
      icon: Zap,
      allocation: { USDC: 50, EURC: 30, XSGD: 20 },
      description: "Moderate risk and returns",
    },
    {
      name: "Aggressive",
      icon: TrendingUp,
      allocation: { USDC: 30, EURC: 40, XSGD: 30 },
      description: "Higher risk, higher rewards",
    },
  ];

  const tokens = [
    { symbol: "USDC", name: "USD Coin", color: "bg-primary" },
    { symbol: "EURC", name: "Euro Coin", color: "bg-accent" },
    { symbol: "XSGD", name: "Singapore Dollar", color: "bg-success" },
  ];

  const handleAllocationChange = (token: string, value: number[]) => {
    setAllocations((prev) => ({ ...prev, [token]: value[0] }));
  };

  const applyTemplate = (template: typeof templates[0]) => {
    setAllocations(template.allocation);
  };

  const totalAllocation = Object.values(allocations).reduce((a, b) => a + b, 0);

  const handleCreateTreasury = async () => {
    if (!isConnected) {
      return;
    }

    if (totalAllocation !== 100) {
      return;
    }

    // Convert allocations to basis points (e.g., 50% = 5000)
    const tokens = [CONTRACT_ADDRESSES.USDC, CONTRACT_ADDRESSES.EURC, CONTRACT_ADDRESSES.XSGD];
    const allocationsArray = [allocations.USDC * 100, allocations.EURC * 100, allocations.XSGD * 100];
    const threshold = parseFloat(rebalanceThreshold) * 100; // Convert to basis points

    const treasuryAddress = await createTreasury(tokens, allocationsArray, threshold, autoYield);
    
    if (treasuryAddress) {
      navigate("/dashboard");
    }
  };

  return (
    <div className="min-h-screen pt-24 pb-12 px-4">
      <div className="container mx-auto max-w-5xl space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold">Create Your Treasury</h1>
          <p className="text-xl text-muted-foreground">
            Configure your automated stablecoin portfolio
          </p>
        </div>

        {/* Strategy Templates */}
        <div>
          <h2 className="text-xl font-bold mb-4">Quick Start Templates</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {templates.map((template, index) => (
              <Card
                key={index}
                className="glass-card p-6 cursor-pointer hover:scale-105 transition-all hover:border-primary/50"
                onClick={() => applyTemplate(template)}
              >
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20">
                    <template.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold mb-1">{template.name}</h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      {template.description}
                    </p>
                    <div className="flex gap-2 text-xs">
                      <span>USDC: {template.allocation.USDC}%</span>
                      <span>EURC: {template.allocation.EURC}%</span>
                      <span>XSGD: {template.allocation.XSGD}%</span>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Token Selection & Allocation */}
        <Card className="glass-card p-8">
          <h2 className="text-xl font-bold mb-6">Asset Allocation</h2>
          
          <div className="space-y-8">
            {tokens.map((token) => (
              <div key={token.symbol} className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full ${token.color} flex items-center justify-center text-sm font-bold`}>
                      {token.symbol.slice(0, 1)}
                    </div>
                    <div>
                      <div className="font-medium">{token.symbol}</div>
                      <div className="text-sm text-muted-foreground">{token.name}</div>
                    </div>
                  </div>
                  <div className="text-2xl font-bold">{allocations[token.symbol as keyof typeof allocations]}%</div>
                </div>
                <Slider
                  value={[allocations[token.symbol as keyof typeof allocations]]}
                  onValueChange={(value) => handleAllocationChange(token.symbol, value)}
                  max={100}
                  step={1}
                  className="w-full"
                />
              </div>
            ))}
          </div>

          <div className="mt-6 p-4 rounded-lg bg-secondary/50 flex justify-between items-center">
            <span className="font-medium">Total Allocation</span>
            <span className={`text-xl font-bold ${totalAllocation === 100 ? 'text-success' : 'text-warning'}`}>
              {totalAllocation}%
            </span>
          </div>
        </Card>

        {/* Configuration */}
        <Card className="glass-card p-8">
          <h2 className="text-xl font-bold mb-6">Configuration</h2>
          
          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/50">
              <div className="space-y-1">
                <Label htmlFor="auto-yield" className="text-base font-medium">
                  Auto-Yield Farming
                </Label>
                <p className="text-sm text-muted-foreground">
                  Automatically deploy idle assets to generate yield
                </p>
              </div>
              <Switch
                id="auto-yield"
                checked={autoYield}
                onCheckedChange={setAutoYield}
              />
            </div>

            <div className="space-y-3">
              <Label htmlFor="threshold" className="text-base font-medium">
                Rebalance Threshold
              </Label>
              <div className="flex items-center gap-4">
                <Input
                  id="threshold"
                  type="number"
                  value={rebalanceThreshold}
                  onChange={(e) => setRebalanceThreshold(e.target.value)}
                  className="flex-1 glass-card"
                />
                <span className="text-muted-foreground">%</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Rebalance automatically when allocation drifts by this percentage
              </p>
            </div>
          </div>
        </Card>

        {/* Preview & Submit */}
        <Card className="glass-card p-8">
          <h2 className="text-xl font-bold mb-6">Preview</h2>
          
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">Estimated APY</div>
              <div className="text-3xl font-bold text-success">4.2%</div>
            </div>
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">Estimated Fees</div>
              <div className="text-3xl font-bold">$0.00</div>
              <div className="text-xs text-muted-foreground">Zero fees for initial setup</div>
            </div>
          </div>

          <Button
            size="lg"
            className="w-full gap-2 bg-gradient-to-r from-primary to-accent hover:opacity-90 text-lg py-6"
            disabled={totalAllocation !== 100 || loading || !isConnected}
            onClick={handleCreateTreasury}
          >
            {loading ? "Creating..." : !isConnected ? "Connect Wallet First" : "Create Treasury"}
            <ArrowRight className="w-5 h-5" />
          </Button>
          
          {totalAllocation !== 100 && (
            <p className="text-sm text-warning text-center mt-4">
              Please adjust allocations to total 100%
            </p>
          )}
        </Card>
      </div>
    </div>
  );
};

export default CreateTreasury;
