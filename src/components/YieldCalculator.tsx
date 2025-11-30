import React, { useState, useMemo, useEffect, useRef } from "react";
import { TrendingUp, Calculator, Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import { useUSYCPrice } from "@/hooks/useUSYCPrice";
import vaultDoor from "@/assets/vault-door.png";

interface YieldCalculatorProps {
  autoPlay?: boolean; // Enable auto-typing animation
}

type LockPeriod = "flexible" | "1month" | "3months" | "12months";

// Lock period info - APY is same for all, only Points multiplier differs
const lockPeriodInfo = {
  flexible: { name: "Flexible", pointsMultiplier: 1, duration: "Withdraw anytime" },
  "1month": { name: "1 Month Lock", pointsMultiplier: 1.5, duration: "30 days" },
  "3months": { name: "3 Months Lock", pointsMultiplier: 2, duration: "90 days" },
  "12months": { name: "12 Months Lock", pointsMultiplier: 3, duration: "365 days" },
};

export const YieldCalculator: React.FC<YieldCalculatorProps> = ({
  autoPlay = false,
}) => {
  const { apy } = useUSYCPrice();
  const baseAPY = apy;
  const [usdcAmount, setUsdcAmount] = useState<string>("");
  const [eurcAmount, setEurcAmount] = useState<string>("");
  const [selectedPeriod, setSelectedPeriod] = useState<LockPeriod>("flexible");
  const [isAnimating, setIsAnimating] = useState(autoPlay);
  const [userInteracted, setUserInteracted] = useState(false);
  const animationCompleted = useRef(false);

  // Get live EUR/USD exchange rate
  const { eurToUsd } = useExchangeRate();

  // Auto-typing animation effect
  useEffect(() => {
    if (!autoPlay || animationCompleted.current || userInteracted) return;

    const targetUsdc = "25000";
    const targetEurc = "15000";
    const targetPeriod: LockPeriod = "12months";

    let currentUsdc = "";
    let currentEurc = "";
    let step = 0;

    const animate = () => {
      // Phase 1: Type USDC (0-600ms)
      if (step < 60) {
        const progress = step / 60;
        const index = Math.floor(progress * targetUsdc.length);
        currentUsdc = targetUsdc.slice(0, index + 1);
        setUsdcAmount(currentUsdc);
      }
      // Phase 2: Pause (600-900ms)
      else if (step < 90) {
        // Keep USDC displayed
      }
      // Phase 3: Type EURC (900-1500ms)
      else if (step < 150) {
        const progress = (step - 90) / 60;
        const index = Math.floor(progress * targetEurc.length);
        currentEurc = targetEurc.slice(0, index + 1);
        setEurcAmount(currentEurc);
      }
      // Phase 4: Pause (1500-1800ms)
      else if (step < 180) {
        // Keep both displayed
      }
      // Phase 5: Select lock period (1800-2100ms)
      else if (step === 180) {
        setSelectedPeriod(targetPeriod);
      }
      // Phase 6: Final pause (2100-3000ms)
      else if (step < 300) {
        // Show final results
      }
      // Complete animation
      else {
        setIsAnimating(false);
        animationCompleted.current = true;
        return;
      }

      step++;
      requestAnimationFrame(animate);
    };

    const timer = setTimeout(() => {
      requestAnimationFrame(animate);
    }, 500); // Start after 500ms delay

    return () => clearTimeout(timer);
  }, [autoPlay, userInteracted]);

  // Handle user interaction - stop animation
  const handleUserInput = () => {
    if (isAnimating) {
      setIsAnimating(false);
      setUserInteracted(true);
      animationCompleted.current = true;
    }
  };

  // Calculate totals in USD (using live exchange rate)
  const totalDeposit = useMemo(() => {
    const usdc = parseFloat(usdcAmount) || 0;
    const eurc = parseFloat(eurcAmount) || 0;
    const eurcInUsd = eurc * eurToUsd;
    return usdc + eurcInUsd;
  }, [usdcAmount, eurcAmount, eurToUsd]);

  const effectiveAPY = useMemo(() => {
    // APY is same for all lock periods - based on USYC yield
    return baseAPY;
  }, [baseAPY]);

  const annualYield = useMemo(() => {
    return totalDeposit * (effectiveAPY / 100);
  }, [totalDeposit, effectiveAPY]);

  const monthlyYield = annualYield / 12;

  return (
    <div className="w-full max-w-[540px] mx-auto">
      {/* Vault Door Image - top section */}
      <div className="relative rounded-t-2xl overflow-hidden bg-gradient-to-b from-card/80 to-card/60 backdrop-blur-sm border border-border/30 border-b-0 p-6">
        <div className="text-center mb-3">
          <h3 className="font-bold text-xl lg:text-2xl text-foreground tracking-tight">
            Calculate Your Potential Earnings
          </h3>
        </div>

        {/* Vault door image */}
        <div className="flex justify-center items-center">
          <img
            src={vaultDoor}
            alt="Vault Door"
            className="w-full max-w-[240px] h-auto object-contain"
          />
        </div>
      </div>

      {/* Calculator Content */}
      <div className="space-y-4 rounded-b-2xl overflow-hidden bg-card/90 backdrop-blur-sm border border-border/30 p-5">
        {/* Input Fields - side by side */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="usdc" className="text-sm text-muted-foreground mb-1.5 block font-medium">
              USDC
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-base">
                $
              </span>
              <Input
                id="usdc"
                type="number"
                value={usdcAmount}
                onChange={(e) => {
                  handleUserInput();
                  setUsdcAmount(e.target.value);
                }}
                onFocus={handleUserInput}
                className="pl-7 h-11 text-base bg-background/60 border-border/40 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
                placeholder="100000"
                min="0"
                step="100"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="eurc" className="text-sm text-muted-foreground mb-1.5 block font-medium">
              EURC
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-base">
                €
              </span>
              <Input
                id="eurc"
                type="number"
                value={eurcAmount}
                onChange={(e) => {
                  handleUserInput();
                  setEurcAmount(e.target.value);
                }}
                onFocus={handleUserInput}
                className="pl-7 h-11 text-base bg-background/60 border-border/40 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
                placeholder="100000"
                min="0"
                step="100"
              />
            </div>
          </div>
        </div>

        {/* Lock Period Selector */}
        <div className="pt-2">
          <Label className="text-xs text-muted-foreground mb-2 block">
            Lock Period
          </Label>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(lockPeriodInfo) as LockPeriod[]).map((period) => {
              const info = lockPeriodInfo[period];
              const isSelected = selectedPeriod === period;
              return (
                <Button
                  key={period}
                  variant={isSelected ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    handleUserInput();
                    setSelectedPeriod(period);
                  }}
                  disabled={isAnimating && !userInteracted}
                  className={`flex flex-col h-auto py-2 px-3 transition-all ${
                    isSelected
                      ? "bg-primary text-primary-foreground"
                      : "border-border/50 hover:bg-muted"
                  }`}
                >
                  <span className="text-xs font-semibold">{info.name}</span>
                  <span className="text-[10px] opacity-80">
                    {info.pointsMultiplier}x Points
                  </span>
                </Button>
              );
            })}
          </div>
          {/* Always show info box to prevent layout shift */}
          <div className="mt-2 p-2 rounded border transition-colors min-h-[32px] flex items-center"
               style={{
                 backgroundColor: selectedPeriod === "flexible" ? "transparent" : "rgb(var(--primary) / 0.1)",
                 borderColor: selectedPeriod === "flexible" ? "rgb(var(--border) / 0.3)" : "rgb(var(--primary) / 0.2)"
               }}>
            <p className="text-xs text-muted-foreground">
              {selectedPeriod === "flexible" ? (
                <>
                  <TrendingUp className="w-3 h-3 inline mr-1" />
                  No lock - withdraw anytime, 1x Points
                </>
              ) : (
                <>
                  <Lock className="w-3 h-3 inline mr-1" />
                  {lockPeriodInfo[selectedPeriod].duration} lock = {lockPeriodInfo[selectedPeriod].pointsMultiplier}x Points
                </>
              )}
            </p>
          </div>
        </div>

        {/* Results */}
        <div className="space-y-3 pt-3 border-t border-border/40">
          <div className="flex justify-between items-center p-3 rounded-lg bg-green-500/10 border border-green-500/30">
            <div className="flex flex-col gap-1">
              <span className="text-sm font-semibold text-foreground">
                Annual Yield
              </span>
              <span className="text-xs text-green-600 dark:text-green-400">
                {effectiveAPY.toFixed(2)}% APY · ${monthlyYield.toLocaleString("en-US", {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })}/mo
              </span>
            </div>
            <div className="text-right">
              <div className="text-xl font-bold tabular-nums text-green-600 dark:text-green-400">
                +${annualYield.toLocaleString("en-US", {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })}
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center p-3 rounded-lg bg-primary/10 border border-primary/30">
            <span className="text-sm font-semibold text-foreground">
              Total After 1 Year
            </span>
            <span className="text-2xl font-bold tabular-nums text-primary">
              ${(totalDeposit + annualYield).toLocaleString("en-US", {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })}
            </span>
          </div>
        </div>

      </div>
    </div>
  );
};
