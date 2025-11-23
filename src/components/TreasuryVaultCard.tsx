import React from "react";
import { Shield, Lock, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCountAnimation } from "@/hooks/useCountAnimation";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { TREASURY_CONTRACTS, SUPPORTED_NETWORKS } from "@/lib/constants";
import vaultDoor from "@/assets/vault-door.png";

interface VaultBalance {
  usdc: number;
  eurc: number;
  usyc: number;
}

interface TreasuryVaultCardProps {
  balance?: VaultBalance;
  onDeposit?: () => void;
  onWithdraw?: () => void;
  interactive?: boolean;
  size?: "hero" | "dashboard";
  isAllowlisted?: boolean;
  showPreviewCaption?: boolean;
  showVaultBackground?: boolean;
  apy?: number; // Real APY from Hashnote API
}

const TreasuryVaultCardComponent = ({
  balance = { usdc: 0, eurc: 0, usyc: 0 },
  onDeposit,
  onWithdraw,
  interactive = false,
  size = "hero",
  isAllowlisted = true,
  showPreviewCaption = false,
  showVaultBackground = false,
  apy = 4.2, // Fallback APY
}: TreasuryVaultCardProps) => {
  // Animated counters with staggered delays
  const animatedUsdc = useCountAnimation(balance.usdc, 1200, 0);
  const animatedEurc = useCountAnimation(balance.eurc, 1200, 400);

  // Calculate simulated annual yield based on real APY
  const totalBalance = animatedUsdc + animatedEurc;
  const simulatedYield = totalBalance * (apy / 100);
  const animatedYield = useCountAnimation(simulatedYield, 1200, 800);

  const totalUSD = animatedUsdc + animatedEurc + (isAllowlisted ? animatedYield : 0);
  const isHero = size === "hero";

  // Different layout when vault background is shown
  if (showVaultBackground) {
    return (
      <div className="w-full max-w-[500px] mx-auto">
        {/* Vault Door Image - top section */}
        <div className="relative rounded-t-2xl overflow-hidden bg-gradient-to-b from-card/80 to-card/60 backdrop-blur-sm border border-border/30 border-b-0 p-8">
          <div className="text-center mb-4">
            <h3 className="font-bold tracking-wider text-lg lg:text-xl text-foreground">
              ARC TREASURY VAULT
            </h3>
            <p className="text-xs text-muted-foreground font-light">
              Safe Balance • On-Chain Digital Vault
            </p>
          </div>

          {/* Vault door image - maintains aspect ratio */}
          <div className="flex justify-center items-center">
            <img
              src={vaultDoor}
              alt="Vault Door"
              className="w-full max-w-[280px] h-auto object-contain"
            />
          </div>
        </div>

        {/* Content below vault */}
        <div className="space-y-3 rounded-b-2xl overflow-hidden bg-card/90 backdrop-blur-sm border border-border/30 p-6">
          {/* Balances */}
          <div className="flex justify-between items-center p-3 rounded-lg bg-background/60 border border-border/40 animate-fade-in">
            <span className="text-sm font-medium text-foreground">USDC</span>
            <span className="text-lg font-semibold tabular-nums text-foreground">${Math.round(animatedUsdc).toLocaleString("en-US")}</span>
          </div>
          <div className="flex justify-between items-center p-3 rounded-lg bg-background/60 border border-border/40 animate-fade-in" style={{ animationDelay: "0.4s" }}>
            <span className="text-sm font-medium text-foreground">EURC</span>
            <span className="text-lg font-semibold tabular-nums text-foreground">€{Math.round(animatedEurc).toLocaleString("en-US")}</span>
          </div>
          <div className="flex justify-between items-center p-3 rounded-lg bg-background/60 border border-border/40 animate-fade-in" style={{ animationDelay: "0.8s" }}>
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-foreground">
                Simulated Yield
              </span>
              <span className="text-xs text-green-600 dark:text-green-400">
                {apy.toFixed(2)}% APY from USYC
              </span>
            </div>
            <span className="text-lg font-semibold tabular-nums text-primary">
              +${Math.round(animatedYield).toLocaleString("en-US")}</span>
          </div>

          {/* Total */}
          <div className="pt-3 border-t border-border/40">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-foreground/80">Total USD Equivalent</span>
              <span className="text-2xl font-bold text-primary">${Math.round(totalUSD).toLocaleString("en-US")}</span>
            </div>
          </div>

          {/* Preview Caption */}
          {showPreviewCaption && (
            <div className="pt-3 border-t border-border/30">
              <p className="text-xs text-muted-foreground text-center font-light leading-relaxed">
                Preview values shown when wallet is not connected.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Original layout when vault background is NOT shown
  return (
    <div
      className={`
        relative overflow-hidden rounded-xl metallic-gradient
        border border-glass-border/30
        ${isHero ? "p-8 lg:p-10" : "p-6 lg:p-8"}
        ${interactive ? "arc-glow hover:shadow-glow-lg transition-all duration-300" : "arc-glow"}
      `}
    >
      {/* Subtle background pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-transparent" />
      </div>

      {/* Content */}
      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
                <Shield className="w-5 h-5 text-primary" />
              </div>
              <h3 className={`font-semibold tracking-wide ${isHero ? "text-xl lg:text-2xl" : "text-lg lg:text-xl"}`}>
                ARC TREASURY VAULT
              </h3>
            </div>
            <p className="text-sm text-muted-foreground font-light">
              Safe Balance • On-Chain Digital Vault
            </p>
          </div>
          <Lock className="w-5 h-5 text-primary/60" />
        </div>

        {/* Balances */}
        <div className="space-y-4 mb-8">
          <div className="flex justify-between items-center p-4 rounded-lg border border-border/50 bg-background/40 animate-fade-in">
            <span className="text-sm font-medium text-muted-foreground">USDC</span>
            <span className="text-lg font-semibold tabular-nums">${Math.round(animatedUsdc).toLocaleString("en-US")}</span>
          </div>
          <div className="flex justify-between items-center p-4 rounded-lg border border-border/50 bg-background/40 animate-fade-in" style={{ animationDelay: "0.4s" }}>
            <span className="text-sm font-medium text-muted-foreground">EURC</span>
            <span className="text-lg font-semibold tabular-nums">€{Math.round(animatedEurc).toLocaleString("en-US")}</span>
          </div>
          <div className="flex justify-between items-center p-4 rounded-lg border border-border/50 bg-background/40 animate-fade-in" style={{ animationDelay: "0.8s" }}>
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-muted-foreground">
                Simulated Yield
              </span>
              <span className="text-xs text-green-600 dark:text-green-400">
                {apy.toFixed(2)}% APY from USYC
              </span>
            </div>
            <span className="text-lg font-semibold tabular-nums text-primary">
              +${Math.round(animatedYield).toLocaleString("en-US")}</span>
          </div>
        </div>

        {/* Total */}
        <div className="pt-6 border-t border-primary/20 mb-6">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-muted-foreground">Total USD Equivalent</span>
            <span className="text-2xl font-bold text-primary">${Math.round(totalUSD).toLocaleString("en-US")}</span>
          </div>
        </div>

        {/* Action Buttons (for dashboard) */}
        {interactive && (
          <TooltipProvider>
            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={onDeposit}
                variant="default"
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
              >
                Deposit
              </Button>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={onWithdraw}
                    variant="outline"
                    className="border-primary/30 hover:bg-primary/10 font-medium"
                  >
                    Withdraw
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs max-w-[200px]">
                    Only your deposited amount can be withdrawn. Simulated yield is not withdrawable.
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        )}

        {/* Security Notice / Preview Caption */}
        <div className="mt-6 pt-6 border-t border-border/30">
          {showPreviewCaption ? (
            <p className="text-xs text-muted-foreground text-center font-light leading-relaxed">
              Preview values shown when wallet is not connected.
            </p>
          ) : interactive ? (
            <>
              <p className="text-xs text-muted-foreground text-center font-light leading-relaxed mb-2">
                Assets stored securely on Arc Testnet. Withdraw anytime.
              </p>
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <span>Contract:</span>
                <a
                  href={`${SUPPORTED_NETWORKS.arcTestnet.explorerUrl}/address/${TREASURY_CONTRACTS.TreasuryVault}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1 font-mono"
                >
                  {TREASURY_CONTRACTS.TreasuryVault.slice(0, 6)}...{TREASURY_CONTRACTS.TreasuryVault.slice(-4)}
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </>
          ) : null}
        </div>
      </div>

      {/* Glow accent line */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
    </div>
  );
};

// Memoized export to prevent unnecessary re-renders
export const TreasuryVaultCard = React.memo(TreasuryVaultCardComponent, (prevProps, nextProps) => {
  // Only re-render if balance, APY, or interactive state changes
  return (
    prevProps.balance.usdc === nextProps.balance.usdc &&
    prevProps.balance.eurc === nextProps.balance.eurc &&
    prevProps.balance.usyc === nextProps.balance.usyc &&
    prevProps.apy === nextProps.apy &&
    prevProps.interactive === nextProps.interactive &&
    prevProps.isAllowlisted === nextProps.isAllowlisted &&
    prevProps.size === nextProps.size &&
    prevProps.showVaultBackground === nextProps.showVaultBackground
  );
});
