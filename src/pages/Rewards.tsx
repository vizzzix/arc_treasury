import { useAccount } from "wagmi";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WalletConnect } from "@/components/WalletConnect";
import { UserMenu } from "@/components/UserMenu";
import { PointsDisplay } from "@/components/PointsDisplay";
import { ReferralSection } from "@/components/ReferralSection";
import { Shield, Wallet, ArrowLeft, Gift, Sparkles } from "lucide-react";
import { useUserPoints } from "@/hooks/useUserPoints";

const Rewards = () => {
  const navigate = useNavigate();
  const account = useAccount();
  const { formattedPoints, isLoading: isLoadingPoints } = useUserPoints();
  const isConnected = account?.isConnected ?? false;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/30 bg-background/80 backdrop-blur-lg">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                onClick={() => navigate("/dashboard")}
                variant="ghost"
                size="sm"
                className="gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Dashboard
              </Button>
              <h1 className="text-xl font-bold">Referral & Rewards</h1>
            </div>
            <div className="flex items-center gap-3">
              {isConnected ? (
                <UserMenu />
              ) : (
                <WalletConnect />
              )}
            </div>
          </div>
        </div>
      </nav>

      <div className="pt-24 pb-20 container mx-auto px-6">
        {!isConnected ? (
          <div className="max-w-md mx-auto mt-20 text-center">
            <Card className="p-8">
              <Wallet className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h2 className="text-xl font-semibold mb-2">
                Connect Your Wallet
              </h2>
              <p className="text-muted-foreground mb-6">
                Please connect your wallet to view your rewards and referrals.
              </p>
              <WalletConnect />
            </Card>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Total Points Display */}
            <Card className="border-border/50 bg-gradient-to-br from-primary/10 to-primary/5">
              <CardContent className="p-8">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-4 rounded-full bg-primary/20 border-2 border-primary/30">
                      <Sparkles className="w-8 h-8 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Your Total Points</p>
                      <h2 className="text-4xl font-bold text-primary">
                        {isLoadingPoints ? "..." : formattedPoints}
                      </h2>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Earn more by:</p>
                    <p className="text-xs text-muted-foreground mt-1">• Locking funds longer</p>
                    <p className="text-xs text-muted-foreground">• Minting 2x NFT</p>
                    <p className="text-xs text-muted-foreground">• Referring friends</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Points Multiplier NFT */}
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Points Multiplier NFT
                </CardTitle>
              </CardHeader>
              <CardContent>
                <PointsDisplay />
              </CardContent>
            </Card>

            {/* Referral Program */}
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Gift className="w-5 h-5" />
                  Referral Program
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ReferralSection />
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default Rewards;
