import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, ArrowDownLeft, RefreshCw, Wallet, PlusCircle, Copy, ArrowRight, Trash2 } from "lucide-react";
import DepositWithdrawModal from "@/components/DepositWithdrawModal";
import TokenBalance from "@/components/TokenBalance";
import TreasuryBalance from "@/components/TreasuryBalance";
import { useTreasury } from "@/contexts/TreasuryContext";
import { useWallet } from "@/contexts/WalletContext";
import { usePoints } from "@/contexts/PointsContext";
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

  const handleHideTreasury = () => {
    if (!address) return;
    
    if (confirm("Hide this Treasury from dashboard? It will remain on-chain, you can re-add it later.")) {
      localStorage.removeItem(`treasury_${address}`);
      localStorage.removeItem(`treasury_metadata_${address}`);
      setTreasuryAddress("");
      setTreasuryMetadata(null);
      toast.success("Treasury hidden from dashboard");
    }
  };

  return (
    <div className="min-h-screen pt-24 pb-12 px-4">
      <div className="container mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-1">Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Manage your stablecoin treasury
            </p>
          </div>
        </div>

        {/* No Treasury - Prompt to Create */}
        {!treasuryAddress && isConnected && (
          <div className="modern-card p-12 text-center">
            <div className="max-w-md mx-auto space-y-6">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mx-auto text-4xl">
                🏦
              </div>
              <div>
                <h3 className="text-2xl font-bold mb-2">No Treasury Yet</h3>
                <p className="text-muted-foreground">
                  Create your first stablecoin treasury with AI-powered allocations
                </p>
              </div>
              <Button 
                size="lg"
                onClick={() => navigate("/create")}
                className="gap-2 bg-gradient-to-r from-primary to-accent hover:opacity-90 hover:scale-105 transition-all"
              >
                <PlusCircle className="w-5 h-5" />
                Create Treasury
                <ArrowRight className="w-5 h-5" />
              </Button>
            </div>
          </div>
        )}

        {/* Treasury Card */}
        {treasuryAddress && isConnected && (
          <div className="modern-card p-6 hover:shadow-lg hover:shadow-primary/5 transition-all">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-2xl">
                  {treasuryMetadata?.avatar || "🏦"}
                </div>
                
                <div>
                  <h3 className="text-lg font-bold mb-1">
                    {treasuryMetadata?.name || "My Treasury"}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-mono">
                      {treasuryAddress.slice(0, 8)}...{treasuryAddress.slice(-6)}
                    </span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(treasuryAddress);
                        toast.success("Address copied!");
                      }}
                      className="hover:text-primary transition-colors"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                    <a 
                      href={`https://testnet.arcscan.app/address/${treasuryAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      View ↗
                    </a>
                  </div>
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate("/create")}
                  className="gap-1.5 hover:bg-primary/5"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  New
                </Button>
                
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleHideTreasury}
                  className="gap-1.5 hover:bg-warning/5"
                >
                  Hide
                </Button>
                
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleDeleteTreasury}
                  disabled={loading}
                  className="gap-1.5 text-destructive hover:bg-destructive/5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
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

        {/* Quick Actions */}
        {treasuryAddress && (
          <div className="modern-card p-6">
            <div className="grid grid-cols-3 gap-4">
              <Button 
                variant="outline"
                size="lg"
                className="h-20 flex-col gap-2 hover:bg-success/10 hover:border-success/40 hover:scale-105 transition-all group"
                onClick={() => setDepositModalOpen(true)}
                disabled={!isConnected}
              >
                <ArrowDownLeft className="w-6 h-6 text-success group-hover:scale-110 transition-transform" />
                <span className="font-semibold">Deposit</span>
              </Button>
              <Button 
                variant="outline"
                size="lg"
                className="h-20 flex-col gap-2 hover:bg-primary/10 hover:border-primary/40 hover:scale-105 transition-all group"
                onClick={() => setWithdrawModalOpen(true)}
                disabled={!isConnected}
              >
                <ArrowUpRight className="w-6 h-6 text-primary group-hover:scale-110 transition-transform" />
                <span className="font-semibold">Withdraw</span>
              </Button>
              <Button 
                variant="outline"
                size="lg"
                className="h-20 flex-col gap-2 hover:bg-warning/10 hover:border-warning/40 hover:scale-105 transition-all group"
                onClick={handleRebalance}
                disabled={loading || !isConnected}
              >
                <RefreshCw className={`w-6 h-6 text-warning ${loading ? 'animate-spin' : ''} group-hover:scale-110 transition-transform`} />
                <span className="font-semibold">{loading ? "Rebalancing..." : "Rebalance"}</span>
              </Button>
            </div>
          </div>
        )}

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
