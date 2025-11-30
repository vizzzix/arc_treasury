import { Lock, Clock, TrendingUp, Unlock, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LockPeriod } from "./LockPeriodSelector";
import { useState, useEffect } from "react";

interface LockedPosition {
  id: string;
  amount: number;
  token: "USDC" | "EURC";
  lockPeriod: LockPeriod;
  depositTime: Date;
  unlockTime: Date;
  currentAPY: number;
  earnedYield: number;
}

interface LockedPositionCardProps {
  position: LockedPosition;
  onWithdraw?: (positionId: string) => void;
  onEarlyWithdraw?: (positionId: string) => void;
  onClaimYield?: (positionId: string) => void;
  isWithdrawing?: boolean;
  isEarlyWithdrawing?: boolean;
  isClaiming?: boolean;
}

export const LockedPositionCard = ({
  position,
  onWithdraw,
  onEarlyWithdraw,
  onClaimYield,
  isWithdrawing = false,
  isEarlyWithdrawing = false,
  isClaiming = false,
}: LockedPositionCardProps) => {
  const [timeRemaining, setTimeRemaining] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false);

  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const diff = position.unlockTime.getTime() - now.getTime();

      if (diff <= 0) {
        setIsUnlocked(true);
        setTimeRemaining("Unlocked");
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      if (days > 0) {
        setTimeRemaining(`${days}d ${hours}h`);
      } else if (hours > 0) {
        setTimeRemaining(`${hours}h ${minutes}m`);
      } else {
        setTimeRemaining(`${minutes}m`);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [position.unlockTime]);

  const getLockPeriodLabel = (period: LockPeriod) => {
    switch (period) {
      case LockPeriod.ONE_MONTH:
        return "1 Month Lock";
      case LockPeriod.THREE_MONTH:
        return "3 Months Lock";
      case LockPeriod.TWELVE_MONTH:
        return "12 Months Lock";
      default:
        return "Flexible";
    }
  };

  const getPointsMultiplier = (period: LockPeriod) => {
    switch (period) {
      case LockPeriod.ONE_MONTH:
        return "1.5x";
      case LockPeriod.THREE_MONTH:
        return "2x";
      case LockPeriod.TWELVE_MONTH:
        return "3x";
      default:
        return "1x";
    }
  };

  const getProgressPercentage = () => {
    const total = position.unlockTime.getTime() - position.depositTime.getTime();
    const elapsed = Date.now() - position.depositTime.getTime();
    return Math.min((elapsed / total) * 100, 100);
  };

  const progress = getProgressPercentage();

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border transition-all duration-300",
        isUnlocked
          ? "border-green-500/50 bg-green-500/5 hover:shadow-glow-lg"
          : "border-border/50 bg-card/50 hover:border-primary/30"
      )}
    >
      <div className="p-6">
        {/* Header */}
        <div className="mb-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground">
              {getLockPeriodLabel(position.lockPeriod)}
            </h3>
            {isUnlocked ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/20 border border-green-500/50">
                <Unlock className="w-3 h-3 text-green-500" />
                <span className="text-xs font-medium text-green-500">Unlocked</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/20 border border-blue-500/50">
                <span className="text-xs font-bold text-blue-400">{getPointsMultiplier(position.lockPeriod)} Points</span>
              </div>
            )}
          </div>
        </div>

        {/* Amount */}
        <div className="mb-4 p-4 rounded-lg bg-background/60 border border-border/40">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-muted-foreground">Locked Amount</span>
            <span className="text-2xl font-bold text-foreground">
              {position.token === "USDC" ? "$" : "€"}
              {position.amount.toLocaleString("en-US")}
            </span>
          </div>
          <div className="text-xs text-muted-foreground">
            {position.token}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {/* APY */}
          <div className="p-3 rounded-lg bg-background/40 border border-border/30">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp className="w-3.5 h-3.5 text-green-500" />
              <span className="text-xs text-muted-foreground">APY</span>
            </div>
            <span className="text-lg font-bold text-green-500">
              {position.currentAPY.toFixed(2)}%
            </span>
          </div>

          {/* Earned Yield */}
          <div className="p-3 rounded-lg bg-background/40 border border-border/30">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-xs text-muted-foreground">Earned</span>
            </div>
            <span className="text-lg font-bold text-primary">
              {position.earnedYield >= 0 ? "+" : ""}
              {position.token === "USDC" ? "$" : "€"}
              {Math.abs(position.earnedYield).toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: position.earnedYield > 0 && position.earnedYield < 0.01 ? 4 : 2,
              })}
            </span>
          </div>
        </div>

        {/* Countdown */}
        {!isUnlocked && (
          <div className="mb-4 p-3 rounded-lg bg-muted/30 border border-border/50">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-foreground">
                  Time Remaining
                </span>
              </div>
              <span className="text-sm font-bold text-primary">
                {timeRemaining}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-2 bg-background/60 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary/50 to-primary transition-all duration-1000"
                style={{ width: `${progress}%` }}
              />
            </div>

            <div className="flex justify-between mt-1 text-xs text-muted-foreground">
              <span>
                {position.depositTime.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </span>
              <span>
                {position.unlockTime.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3">
          {isUnlocked ? (
            <Button
              variant="default"
              size="sm"
              onClick={() => onWithdraw?.(position.id)}
              disabled={isWithdrawing}
              className="w-full bg-green-500 hover:bg-green-600 text-white border-green-500"
            >
              {isWithdrawing ? "Withdrawing..." : "Withdraw All"}
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEarlyWithdraw?.(position.id)}
              disabled={isEarlyWithdrawing}
              className="w-full border-orange-500/50 hover:bg-orange-500/10 text-orange-600 dark:text-orange-400"
            >
              {isEarlyWithdrawing ? (
                "Processing..."
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Early Withdraw (25% penalty)</span>
                </div>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Glow effect for unlocked */}
      {isUnlocked && (
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-green-500/50 to-transparent" />
      )}
    </div>
  );
};
