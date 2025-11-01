import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useWallet } from "@/contexts/WalletContext";
import { usePoints } from "@/contexts/PointsContext";
import { Users, Copy, Check, Star, TrendingUp, Gift } from "lucide-react";
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
        <div className="container mx-auto max-w-4xl">
          <Card className="modern-card p-12 text-center">
            <Users className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
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
      <div className="container mx-auto max-w-4xl space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold mb-2">Referral Program</h1>
          <p className="text-muted-foreground">Invite friends and earn rewards together</p>
        </div>

        {/* Stats Overview */}
        <div className="grid md:grid-cols-3 gap-6">
          <Card className="modern-card p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Total Referrals</div>
                <div className="text-3xl font-bold">{referral.referrals.length}</div>
              </div>
            </div>
          </Card>

          <Card className="modern-card p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-success/20 to-success/10 flex items-center justify-center">
                <Star className="w-6 h-6 text-success" />
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Points Earned</div>
                <div className="text-3xl font-bold text-success">{Math.floor(referral.earnings).toLocaleString()}</div>
              </div>
            </div>
          </Card>

          <Card className="modern-card p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-warning/20 to-warning/10 flex items-center justify-center">
                <Gift className="w-6 h-6 text-warning" />
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Referral Points</div>
                <div className="text-3xl font-bold text-warning">{Math.floor(points.referralPoints).toLocaleString()}</div>
              </div>
            </div>
          </Card>
        </div>

        {/* Referral Link Card */}
        <Card className="modern-card p-6">
          <h2 className="text-xl font-bold mb-6">Your Referral Link</h2>

          <div className="space-y-4">
            {/* Referral Code */}
            <div className="space-y-2">
              <Label>Your Code</Label>
              <div className="flex gap-2">
                <div className="flex-1 px-4 py-3 rounded-lg bg-secondary/50 border border-border/50">
                  <div className="font-mono text-2xl font-bold text-center gradient-text">
                    {referral.code}
                  </div>
                </div>
              </div>
            </div>

            {/* Referral Link */}
            <div className="space-y-2">
              <Label>Referral Link</Label>
              <div className="flex gap-2">
                <Input
                  value={`${window.location.origin}?ref=${referral.code}`}
                  readOnly
                  className="glass-card font-mono text-sm"
                />
                <Button
                  onClick={copyReferralLink}
                  className="bg-gradient-to-r from-primary to-accent hover:opacity-90 gap-2"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy Link
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* How it Works */}
        <Card className="modern-card p-6">
          <h2 className="text-xl font-bold mb-6">How Referrals Work</h2>

          <div className="space-y-4">
            <div className="flex gap-4 p-4 rounded-lg bg-primary/10 border border-primary/20">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center font-bold text-primary">
                1
              </div>
              <div>
                <h3 className="font-semibold mb-1">Share Your Link</h3>
                <p className="text-sm text-muted-foreground">
                  Copy and share your unique referral link with friends
                </p>
              </div>
            </div>

            <div className="flex gap-4 p-4 rounded-lg bg-success/10 border border-success/20">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-success/20 flex items-center justify-center font-bold text-success">
                2
              </div>
              <div>
                <h3 className="font-semibold mb-1">They Sign Up</h3>
                <p className="text-sm text-muted-foreground">
                  When someone connects their wallet via your link, you earn <strong>100 points</strong>
                </p>
              </div>
            </div>

            <div className="flex gap-4 p-4 rounded-lg bg-warning/10 border border-warning/20">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-warning/20 flex items-center justify-center font-bold text-warning">
                3
              </div>
              <div>
                <h3 className="font-semibold mb-1">Earn from Their Deposits</h3>
                <p className="text-sm text-muted-foreground">
                  You earn <strong>5% of their deposit amounts</strong> as bonus points!
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Rewards Table */}
        <Card className="modern-card p-6">
          <h2 className="text-xl font-bold mb-6">Reward Structure</h2>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left py-3 px-4">Action</th>
                  <th className="text-left py-3 px-4">Points Earned</th>
                  <th className="text-left py-3 px-4">Example</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                <tr className="border-b border-border/30">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-primary" />
                      <span>Referral Signup</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 font-semibold">100 points</td>
                  <td className="py-3 px-4 text-muted-foreground">One-time bonus</td>
                </tr>
                <tr className="border-b border-border/30">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-success" />
                      <span>Referral Deposits</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 font-semibold">5% of amount</td>
                  <td className="py-3 px-4 text-muted-foreground">$1000 deposit = 50 pts</td>
                </tr>
                <tr>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <Gift className="w-4 h-4 text-warning" />
                      <span>Unlimited Referrals</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 font-semibold">No limit</td>
                  <td className="py-3 px-4 text-muted-foreground">Invite everyone!</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>

        {/* Referred By */}
        {referral.referredBy && (
          <Card className="modern-card p-6 border-2 border-accent/30">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-accent/20 to-accent/10 flex items-center justify-center">
                <Users className="w-6 h-6 text-accent" />
              </div>
              <div>
                <div className="text-sm text-muted-foreground">You were referred by</div>
                <div className="font-mono font-bold">
                  {referral.referredBy.slice(0, 10)}...{referral.referredBy.slice(-8)}
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Referrals;

