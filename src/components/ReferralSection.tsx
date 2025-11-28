import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Check, Twitter, Send, Mail, ExternalLink, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useReferral } from "@/hooks/useReferral";
import { Skeleton } from "@/components/ui/skeleton";

export const ReferralSection = () => {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const { referralUrl, stats, referrals, isLoading } = useReferral();

  // Show partial loading - display referral link immediately if available
  const hasReferralUrl = referralUrl && referralUrl.length > 0;
  const showFullSkeleton = isLoading && !hasReferralUrl;

  // Default values if no stats loaded
  const totalReferrals = stats?.totalReferrals || 0;
  const activeReferrals = stats?.activeReferrals || 0;
  const totalEarnings = stats?.totalBonusPoints || 0;
  const currentTier = stats?.currentTier || 0;
  const currentTierInfo = stats?.tierInfo || { name: "Bronze", minRefs: 0, multiplier: 0, emoji: "🥉" };
  const nextTierInfo = stats?.nextTierInfo || { name: "Silver", minRefs: 5, multiplier: 0.1, emoji: "🥈" };
  const nextTierAt = stats?.nextTierAt || 5;
  const progress = (totalReferrals / nextTierAt) * 100;
  const MAX_TIER = 4; // Diamond tier (0=Bronze, 1=Silver, 2=Gold, 3=Platinum, 4=Diamond)

  const copyToClipboard = () => {
    navigator.clipboard.writeText(referralUrl);
    setCopied(true);
    toast({
      title: "Copied!",
      description: "Referral link copied to clipboard",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const shareOnTwitter = () => {
    const text = encodeURIComponent(
      `Join me on Arc Treasury - earn yield on your stablecoins! 🚀\n\n`
    );
    window.open(
      `https://twitter.com/intent/tweet?text=${text}&url=${encodeURIComponent(
        referralUrl
      )}`,
      "_blank"
    );
  };

  const shareOnTelegram = () => {
    const text = encodeURIComponent(
      `Join me on Arc Treasury - earn yield on your stablecoins!`
    );
    window.open(
      `https://t.me/share/url?url=${encodeURIComponent(
        referralUrl
      )}&text=${text}`,
      "_blank"
    );
  };

  const shareViaEmail = () => {
    const subject = encodeURIComponent("Join Arc Treasury");
    const body = encodeURIComponent(
      `Hi!\n\nI've been using Arc Treasury to earn yield on stablecoins and thought you might be interested.\n\nJoin using my referral link:\n${referralUrl}\n\nEarn real yield on USDC!`
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return `${Math.floor(diffDays / 30)} months ago`;
  };

  // Show loading skeleton only if we have no cached data
  if (showFullSkeleton) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-60 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
        {/* Referral Link - Shows immediately if cached */}
        <div>
          <label className="text-sm font-medium mb-2 block">
            Your Referral Link
          </label>
          <div className="flex items-center gap-2">
            <div className="flex-1 p-3 rounded-lg bg-muted/50 border border-border/50 font-mono text-sm overflow-x-auto">
              {hasReferralUrl ? referralUrl : (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-muted-foreground">Generating your referral code...</span>
                </div>
              )}
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={copyToClipboard}
              className="shrink-0"
              disabled={!hasReferralUrl}
            >
              {copied ? (
                <Check className="w-4 h-4 text-green-500" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Share Buttons */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={shareOnTwitter}
            className="gap-2"
            disabled={!hasReferralUrl}
          >
            <Twitter className="w-4 h-4" />
            Twitter
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={shareOnTelegram}
            className="gap-2"
            disabled={!hasReferralUrl}
          >
            <Send className="w-4 h-4" />
            Telegram
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={shareViaEmail}
            className="gap-2"
            disabled={!hasReferralUrl}
          >
            <Mail className="w-4 h-4" />
            Email
          </Button>
        </div>

        {/* Stats Cards - Show immediately with default values */}
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 rounded-lg bg-muted/30 border border-border/50 text-center relative">
            <span className="text-sm text-muted-foreground block mb-1">
              Total Referrals
            </span>
            <span className={`text-2xl font-bold ${isLoading && !stats ? 'opacity-50' : ''}`}>
              {isLoading && !stats ? (
                <Loader2 className="w-6 h-6 animate-spin mx-auto" />
              ) : (
                totalReferrals
              )}
            </span>
          </div>
          <div className="p-4 rounded-lg bg-muted/30 border border-border/50 text-center relative">
            <span className="text-sm text-muted-foreground block mb-1">
              Active Referrals
            </span>
            <span className={`text-2xl font-bold ${isLoading && !stats ? 'opacity-50' : ''}`}>
              {isLoading && !stats ? (
                <Loader2 className="w-6 h-6 animate-spin mx-auto" />
              ) : (
                activeReferrals
              )}
            </span>
          </div>
          <div className="p-4 rounded-lg bg-muted/30 border border-border/50 text-center relative">
            <span className="text-sm text-muted-foreground block mb-1">
              Bonus Points
            </span>
            <span className={`text-2xl font-bold text-green-500 ${isLoading && !stats ? 'opacity-50' : ''}`}>
              {isLoading && !stats ? (
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-green-500" />
              ) : (
                `+${totalEarnings.toLocaleString()}`
              )}
            </span>
          </div>
        </div>

        {/* Tier Progress - Show immediately with loading state */}
        <div className="p-4 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/30 relative">
          {isLoading && !stats && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/20 backdrop-blur-sm rounded-lg">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          )}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{currentTierInfo.emoji}</span>
              <div>
                <span className="font-semibold">{currentTierInfo.name}</span>
                <span className="text-sm text-muted-foreground ml-2">
                  +{currentTierInfo.multiplier}x multiplier
                </span>
              </div>
            </div>
            {currentTier < MAX_TIER && (
              <div className="text-right text-sm">
                <span className="text-muted-foreground">Next:</span>
                <span className="font-semibold ml-1">
                  {nextTierInfo.emoji} {nextTierInfo.name}
                </span>
              </div>
            )}
          </div>

          {currentTier < MAX_TIER && (
            <>
              <div className="w-full h-3 bg-background/60 rounded-full overflow-hidden mb-2">
                <div
                  className="h-full bg-gradient-to-r from-primary to-primary/60 transition-all duration-500"
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{totalReferrals} referrals</span>
                <span>
                  {nextTierAt - totalReferrals} more to {nextTierInfo.name}
                </span>
              </div>
            </>
          )}

          {currentTier === MAX_TIER && (
            <div className="text-center text-sm text-green-600 dark:text-green-400 font-medium">
              🎉 Maximum tier reached!
            </div>
          )}
        </div>

        {/* How It Works */}
        <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
          <h4 className="font-semibold mb-2 text-sm">How It Works</h4>
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li>• Share your referral link with friends</li>
            <li>• They need to deposit $100+ to earn points</li>
            <li>• You earn 10% of all their points (lifetime!)</li>
            <li>• Points are permanent - never lost after withdrawal</li>
          </ul>
        </div>

        {/* Recent Referrals */}
        {referrals && referrals.length > 0 && (
          <div>
            <h4 className="font-semibold mb-3 text-sm">Recent Referrals</h4>
            <div className="space-y-2">
              {referrals.map((ref, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        ref.isActive ? "bg-green-500" : "bg-gray-400"
                      }`}
                    />
                    <div>
                      <span className="font-mono text-sm">
                        {ref.address.slice(0, 6)}...{ref.address.slice(-4)}
                      </span>
                      <span className="text-xs text-muted-foreground ml-2">
                        {formatDate(ref.joinedDate)}
                      </span>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-green-500">
                    +{ref.pointsEarned} pts
                  </span>
                </div>
              ))}
            </div>
            {referrals.length > 3 && (
              <Button variant="ghost" size="sm" className="w-full mt-3">
                View All Referrals
                <ExternalLink className="w-3 h-3 ml-1" />
              </Button>
            )}
          </div>
        )}
    </div>
  );
};
