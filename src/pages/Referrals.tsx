import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useWallet } from "@/contexts/WalletContext";
import { usePoints } from "@/contexts/PointsContext";
import { Copy, Check, Trophy } from "lucide-react";
import { toast } from "sonner";

const Referrals = () => {
  const { address, isConnected } = useWallet();
  const { referral, points } = usePoints();
  const [copied, setCopied] = useState(false);

  const copyReferralLink = () => {
    const referralLink = `${window.location.origin}?ref=${referral.code}`;
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast.success("Referral link copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen pt-24 pb-12 px-4">
        <div className="container mx-auto max-w-3xl">
          <Card className="modern-card p-12 text-center">
            <Trophy className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-2xl font-bold mb-2">Connect Your Wallet</h2>
            <p className="text-muted-foreground">
              Please connect your wallet to access referral program
            </p>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 pb-12 px-4">
      <div className="container mx-auto max-w-3xl space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold mb-2">Referrals</h1>
          <p className="text-muted-foreground">Invite friends and earn rewards</p>
        </div>

        {/* Total Points */}
        <Card className="modern-card p-8 text-center border border-border/50">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 mb-4">
            <Trophy className="w-7 h-7 text-primary" />
          </div>
          <h3 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Total Points</h3>
          <div className="text-4xl font-bold gradient-text mb-6">
            {points.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
          <div className="grid grid-cols-4 gap-4 pt-4 border-t border-border/30 text-sm">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Deposits</div>
              <div className="font-semibold text-success">{points.depositPoints.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Withdrawals</div>
              <div className="font-semibold text-primary">{points.withdrawPoints.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Referrals</div>
              <div className="font-semibold text-accent">{points.referralPoints.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Holding</div>
              <div className="font-semibold text-warning">{points.holdingPoints.toLocaleString()}</div>
            </div>
          </div>
        </Card>

        {/* Referral Link */}
        <Card className="modern-card p-6">
          <h2 className="text-lg font-semibold mb-4">Your Referral Link</h2>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Referral Code</Label>
              <div className="px-4 py-3 rounded-lg bg-secondary/30 border border-border/50 font-mono text-lg font-bold text-center">
                {referral.code}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Full Link</Label>
              <div className="flex gap-2">
                <Input
                  value={`${window.location.origin}?ref=${referral.code}`}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  onClick={copyReferralLink}
                  variant="outline"
                  className="gap-2"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="modern-card p-5">
            <div className="text-xs text-muted-foreground mb-1">Total Referrals</div>
            <div className="text-2xl font-bold">{referral.referrals.length}</div>
          </Card>
          <Card className="modern-card p-5">
            <div className="text-xs text-muted-foreground mb-1">Points Earned</div>
            <div className="text-2xl font-bold text-success">{Math.floor(referral.earnings).toLocaleString()}</div>
          </Card>
        </div>

        {/* How It Works - Minimal */}
        <Card className="modern-card p-6">
          <h2 className="text-lg font-semibold mb-4">How It Works</h2>
          <div className="space-y-3 text-sm">
            <div className="flex gap-3">
              <span className="text-primary font-bold">1.</span>
              <span className="text-muted-foreground">Share your referral link with friends</span>
            </div>
            <div className="flex gap-3">
              <span className="text-primary font-bold">2.</span>
              <span className="text-muted-foreground">They connect wallet → you earn <strong className="text-foreground">100 points</strong></span>
            </div>
            <div className="flex gap-3">
              <span className="text-primary font-bold">3.</span>
              <span className="text-muted-foreground">Their deposits → you earn <strong className="text-foreground">5% as points</strong></span>
            </div>
          </div>
        </Card>

        {/* Referred By */}
        {referral.referredBy && (
          <Card className="modern-card p-6 border border-accent/30">
            <div className="text-xs text-muted-foreground mb-1">You were referred by</div>
            <div className="font-mono font-semibold">
              {referral.referredBy.slice(0, 10)}...{referral.referredBy.slice(-8)}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Referrals;
