import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export enum LockPeriod {
  FLEXIBLE = "FLEXIBLE",
  ONE_MONTH = "ONE_MONTH",
  THREE_MONTH = "THREE_MONTH",
  TWELVE_MONTH = "TWELVE_MONTH",
}

interface LockOption {
  period: LockPeriod;
  label: string;
  duration: string;
  baseAPY: number;
  pointsMultiplier: number;
  badge?: string;
}

interface LockPeriodSelectorProps {
  selected: LockPeriod;
  onSelect: (period: LockPeriod) => void;
  baseAPY: number;
  depositAmount?: number;
}

export const LockPeriodSelector = ({
  selected,
  onSelect,
  baseAPY,
  depositAmount = 0,
}: LockPeriodSelectorProps) => {
  const lockOptions: LockOption[] = [
    {
      period: LockPeriod.FLEXIBLE,
      label: "Flexible",
      duration: "No lock",
      baseAPY: baseAPY,
      pointsMultiplier: 1,
    },
    {
      period: LockPeriod.ONE_MONTH,
      label: "1 Month",
      duration: "30 days lock",
      baseAPY: baseAPY,
      pointsMultiplier: 1.5,
    },
    {
      period: LockPeriod.THREE_MONTH,
      label: "3 Months",
      duration: "90 days lock",
      baseAPY: baseAPY,
      pointsMultiplier: 2,
      badge: "Popular",
    },
    {
      period: LockPeriod.TWELVE_MONTH,
      label: "12 Months",
      duration: "365 days lock",
      baseAPY: baseAPY,
      pointsMultiplier: 3,
      badge: "Most Points",
    },
  ];

  const calculateYield = (apy: number) => {
    if (depositAmount === 0) return 0;
    return (depositAmount * apy) / 100;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-foreground">
          Choose Lock Period
        </h3>
        <span className="text-xs text-muted-foreground">
          Longer lock = More Points
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {lockOptions.map((option) => {
          const isSelected = selected === option.period;
          const expectedYield = calculateYield(option.baseAPY);

          return (
            <button
              key={option.period}
              onClick={() => onSelect(option.period)}
              className={cn(
                "relative p-4 rounded-xl border-2 transition-all duration-200 text-left",
                "hover:border-primary/50 hover:shadow-lg hover:scale-[1.02]",
                isSelected
                  ? "border-primary bg-primary/10 shadow-glow"
                  : "border-border/50 bg-card/50"
              )}
            >
              {/* Badge */}
              {option.badge && (
                <div className="absolute -top-2 -right-2 px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-xs font-medium">
                  {option.badge}
                </div>
              )}

              {/* Selected Indicator */}
              {isSelected && (
                <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                  <Check className="w-3 h-3 text-primary-foreground" />
                </div>
              )}

              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="text-base font-semibold text-foreground">
                    {option.label}
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {option.duration}
                  </p>
                </div>
              </div>

              {/* APY & Points Display */}
              <div className="space-y-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-primary">
                    ~{option.baseAPY.toFixed(2)}%
                  </span>
                  <span className="text-xs text-muted-foreground">APY*</span>
                </div>

                {/* Points Multiplier */}
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <div className="flex justify-between">
                    <span>Points Multiplier</span>
                    <span className={cn(
                      "font-semibold",
                      option.pointsMultiplier > 1 ? "text-green-600 dark:text-green-400" : ""
                    )}>
                      {option.pointsMultiplier}x
                    </span>
                  </div>
                </div>

                {/* Expected Yield */}
                {depositAmount > 0 && (
                  <div className="pt-2 border-t border-border/50">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">
                        Est. Annual Yield
                      </span>
                      <span className="text-sm font-semibold text-primary">
                        ${expectedYield.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Info Footer */}
      <div className="mt-4 p-3 rounded-lg bg-muted/30 border border-border/50">
        <p className="text-xs text-muted-foreground leading-relaxed">
          {selected === LockPeriod.FLEXIBLE ? (
            <>
              <span className="font-medium text-foreground">Flexible:</span>{" "}
              Withdraw anytime with no penalties. Base USYC yield.
            </>
          ) : (
            <>
              <span className="font-medium text-foreground">Locked:</span>{" "}
              Same APY, but earn {lockOptions.find(o => o.period === selected)?.pointsMultiplier}x Points for future ARC token rewards. Early exit: 25% penalty.
            </>
          )}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          *APY is variable based on USYC T-Bill yield minus 5% platform fee.
        </p>
      </div>
    </div>
  );
};
