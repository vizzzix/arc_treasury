import { Card, CardContent } from "@/components/ui/card";
import { ExternalLink, TrendingUp } from "lucide-react";
import { useUSYCPrice } from "@/hooks/useUSYCPrice";
import { TREASURY_CONTRACTS, SUPPORTED_NETWORKS } from "@/lib/constants";
import { Skeleton } from "@/components/ui/skeleton";

export const USYCOraclePanel = () => {
  const { price: apiPrice, apy, lastUpdated, isLoading: isLoadingAPY } = useUSYCPrice();

  // Format last updated time (handles Unix timestamp or ISO string)
  const formatLastUpdated = (timestamp: string) => {
    if (!timestamp) return '';
    // Handle Unix timestamp (seconds) or ISO string
    const numTimestamp = Number(timestamp);
    const date = !isNaN(numTimestamp) ? new Date(numTimestamp * 1000) : new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <Card className="p-6 space-y-6 border-border/50">
      <div>
        <h3 className="font-semibold mb-3">USYC Price</h3>
        {isLoadingAPY ? (
          <Skeleton className="h-8 w-32" />
        ) : (
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-primary">${apiPrice.toFixed(6)}</span>
            <span className="text-sm text-muted-foreground">per USYC</span>
          </div>
        )}
        {apiPrice > 0 && lastUpdated && (
          <p className="text-xs text-muted-foreground mt-1">
            Updated {formatLastUpdated(lastUpdated)}
          </p>
        )}
      </div>

      {/* APY Display */}
      <div className="pt-4 border-t border-border/30">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">Current APY</span>
          <TrendingUp className="w-4 h-4 text-green-500" />
        </div>
        {isLoadingAPY ? (
          <Skeleton className="h-7 w-24" />
        ) : (
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-green-500">{apy.toFixed(2)}%</span>
            <span className="text-xs text-muted-foreground">annually</span>
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-1">
          Based on USYC NAV
        </p>
      </div>

      <div className="p-4 rounded-lg bg-muted/50 border border-border/50">
        <p className="text-xs text-muted-foreground leading-relaxed">
          On Arc Testnet, yield is simulated via USYC NAV oracle. In mainnet, the vault treasury operator will mint/redeem real USYC via Circle.
        </p>
      </div>

      <div className="space-y-2 pt-4 border-t border-border/30">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">USYCOracle</span>
          <a
            href={`${SUPPORTED_NETWORKS.arcTestnet.explorerUrl}/address/${TREASURY_CONTRACTS.USYCOracle}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline flex items-center gap-1"
          >
            View on ArcScan
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">TreasuryVault</span>
          <a
            href={`${SUPPORTED_NETWORKS.arcTestnet.explorerUrl}/address/${TREASURY_CONTRACTS.TreasuryVault}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline flex items-center gap-1"
          >
            View on ArcScan
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </Card>
  );
};

