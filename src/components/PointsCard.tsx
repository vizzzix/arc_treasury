import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Star, Trophy, Users, TrendingUp, Copy, Check } from "lucide-react";
import { usePoints } from "@/contexts/PointsContext";
import { useState } from "react";
import { toast } from "sonner";

const PointsCard = () => {
  const { points, referral } = usePoints();
  const [copied, setCopied] = useState(false);

  const copyReferralCode = () => {
    const referralLink = `${window.location.origin}?ref=${referral.code}`;
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast.success("Referral link copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const pointsBreakdown = [
    { label: "Deposits", value: points.depositPoints, icon: TrendingUp, color: "text-success" },
    { label: "Withdrawals", value: points.withdrawPoints, icon: Star, color: "text-primary" },
    { label: "Referrals", value: points.referralPoints, icon: Users, color: "text-accent" },
    { label: "Holding", value: points.holdingPoints, icon: Trophy, color: "text-warning" },
  ];

  return (
    <Card className="modern-card p-6">
      {/* Total Points */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 mb-3">
          <Trophy className="w-10 h-10 text-primary" />
        </div>
        <h3 className="text-sm font-medium text-muted-foreground mb-1">Total Points</h3>
        <div className="text-4xl font-bold gradient-text">
          {points.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </div>
      </div>

      {/* Points Breakdown */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {pointsBreakdown.map((item) => (
          <div key={item.label} className="p-3 rounded-lg bg-secondary/30">
            <div className="flex items-center gap-2 mb-1">
              <item.icon className={`w-4 h-4 ${item.color}`} />
              <span className="text-xs text-muted-foreground">{item.label}</span>
            </div>
            <div className={`font-bold ${item.color}`}>
              {item.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
          </div>
        ))}
      </div>

      {/* Referral Section */}
      <div className="border-t border-border/50 pt-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h4 className="font-semibold text-sm">Referral Program</h4>
            <p className="text-xs text-muted-foreground">
              {referral.referrals.length} referrals • {referral.earnings} points earned
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <div className="flex-1 px-3 py-2 rounded-lg bg-secondary/50 font-mono text-sm">
            {referral.code}
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={copyReferralCode}
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

        <div className="mt-3 p-3 rounded-lg bg-primary/10 border border-primary/20">
          <p className="text-xs text-muted-foreground">
            💡 <span className="font-semibold">Earn points:</span> 100 pts per signup + 5% of their deposits!
          </p>
        </div>
      </div>
    </Card>
  );
};

export default PointsCard;

