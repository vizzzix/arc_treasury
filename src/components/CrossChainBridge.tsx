import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight, Zap, ArrowDownUp } from "lucide-react";
import { bridgeUSDCToArc } from "@/services/cctpService";
import { useWallet } from "@/contexts/WalletContext";

const CrossChainBridge = () => {
  const { address } = useWallet();
  const [fromChain, setFromChain] = useState("ethereum");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);

  const chains = [
    { id: "ethereum", name: "Ethereum", icon: "⟠" },
    { id: "polygon", name: "Polygon", icon: "⬣" },
    { id: "base", name: "Base", icon: "🔵" },
    { id: "arbitrum", name: "Arbitrum", icon: "🔷" }
  ];

  const handleBridge = async () => {
    if (!amount || !address) return;
    
    setLoading(true);
    const result = await bridgeUSDCToArc(fromChain as any, amount, address);
    setLoading(false);
    
    if (result.success) {
      setAmount("");
    }
  };

  return (
    <Card className="p-5 border border-border/50 hover:border-primary/30 transition-colors">
      <div className="flex items-center gap-2 mb-4">
        <Zap className="w-5 h-5 text-primary" />
        <div>
          <h3 className="font-semibold text-sm">Bridge USDC</h3>
          <p className="text-xs text-muted-foreground">Circle CCTP</p>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <Select value={fromChain} onValueChange={setFromChain}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {chains.map((chain) => (
                <SelectItem key={chain.id} value={chain.id}>
                  <span className="flex items-center gap-2">
                    {chain.icon} {chain.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Input
            type="number"
            placeholder="Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="h-9 text-sm"
          />
          <ArrowDownUp className="w-4 h-4 text-muted-foreground" />
          <div className="px-3 py-1.5 rounded-lg bg-primary/10 text-xs font-medium">
            Arc
          </div>
        </div>

        <Button 
          onClick={handleBridge}
          disabled={loading || !amount}
          size="sm"
          className="w-full gap-2 h-9"
        >
          {loading ? "Bridging..." : "Bridge"}
          <ArrowRight className="w-3.5 h-3.5" />
        </Button>

        <p className="text-xs text-center text-muted-foreground">
          ~15 min • Fee: $1-3
        </p>
      </div>
    </Card>
  );
};

export default CrossChainBridge;

