import { ExternalLink, TrendingUp, Activity } from "lucide-react";
import { useUSYCPrice } from "@/hooks/useUSYCPrice";
import { TREASURY_CONTRACTS, SUPPORTED_NETWORKS } from "@/lib/constants";
import { Skeleton } from "@/components/ui/skeleton";

export const USYCOraclePanel = () => {
  const { price: apiPrice, apy, lastUpdated, isLoading: isLoadingAPY } = useUSYCPrice();

  // Format last updated time (handles Unix timestamp or ISO string)
  const formatLastUpdated = (timestamp: string) => {
    if (!timestamp) return '';
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
    <div className="p-5 rounded-2xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 backdrop-blur-sm">
      <div className="flex items-center gap-2 mb-4">
        <Activity className="w-4 h-4 text-muted-foreground" />
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">USYC Oracle</h3>
      </div>

      {/* Price & APY */}
      <div className="space-y-3 mb-4">
        <div className="p-3 rounded-xl bg-white/5 border border-white/10">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">Price</span>
            {apiPrice > 0 && lastUpdated && (
              <span className="text-[10px] text-muted-foreground">{formatLastUpdated(lastUpdated)}</span>
            )}
          </div>
          {isLoadingAPY ? (
            <Skeleton className="h-6 w-24" />
          ) : (
            <span className="text-lg font-semibold">${apiPrice.toFixed(4)}</span>
          )}
        </div>

        <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/20">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">APY</span>
            <TrendingUp className="w-3 h-3 text-green-500" />
          </div>
          {isLoadingAPY ? (
            <Skeleton className="h-6 w-20" />
          ) : (
            <span className="text-lg font-semibold text-green-500">{apy.toFixed(2)}%</span>
          )}
        </div>
      </div>

      {/* Links */}
      <div className="space-y-1 pt-3 border-t border-white/10">
        <a
          href={`${SUPPORTED_NETWORKS.arcTestnet.explorerUrl}/address/${TREASURY_CONTRACTS.USYCOracle}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between text-xs text-muted-foreground hover:text-primary transition-colors"
        >
          <span>Oracle Contract</span>
          <ExternalLink className="w-3 h-3" />
        </a>
        <a
          href={`${SUPPORTED_NETWORKS.arcTestnet.explorerUrl}/address/${TREASURY_CONTRACTS.TreasuryVault}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between text-xs text-muted-foreground hover:text-primary transition-colors"
        >
          <span>Vault Contract</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
};

