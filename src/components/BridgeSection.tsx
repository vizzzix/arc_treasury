import { Button } from "@/components/ui/button";
import { ArrowRight, Info } from "lucide-react";
import ethereumIcon from "@/assets/ethereum-icon.png";
import baseIcon from "@/assets/base-icon.png";
import arcIcon from "@/assets/arc-icon.png";
import usdcIcon from "@/assets/usdc-icon.png";

interface BridgeSectionProps {
  onBridgeClick: () => void;
}

export const BridgeSection = ({ onBridgeClick }: BridgeSectionProps) => {
  return (
    <section className="py-20 lg:py-32 border-b border-border/30">
      <div className="container mx-auto px-6">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h2 className="text-4xl lg:text-5xl font-bold mb-4">
              Bring Your USDC to Arc
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Use Circle's official Cross-Chain Transfer Protocol to move USDC from Ethereum or Base to Arc Network.
            </p>
          </div>

          {/* Main Content */}
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left: Bridge Button & Info */}
            <div className="space-y-6">
              <Button
                onClick={onBridgeClick}
                size="lg"
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xl px-8 py-8 shadow-glow-lg hover:shadow-glow transition-all"
              >
                Bridge USDC → Arc
                <ArrowRight className="ml-2 w-6 h-6" />
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                Powered by <span className="font-semibold text-foreground">Circle CCTP</span>. Safe, verified, and official.
              </p>

              {/* Network Icons */}
              <div className="flex justify-center gap-4 pt-4">
                <div className="p-3 rounded-lg bg-card border border-border hover:border-primary/30 transition-colors">
                  <img src={ethereumIcon} alt="Ethereum" className="w-8 h-8 opacity-70" />
                </div>
                <div className="p-3 rounded-lg bg-card border border-border hover:border-primary/30 transition-colors">
                  <img src={baseIcon} alt="Base" className="w-8 h-8 opacity-70" />
                </div>
                <div className="p-3 rounded-lg bg-card border border-border hover:border-primary/30 transition-colors">
                  <img src={arcIcon} alt="Arc" className="w-8 h-8" />
                </div>
                <div className="p-3 rounded-lg bg-card border border-border hover:border-primary/30 transition-colors">
                  <img src={usdcIcon} alt="USDC" className="w-8 h-8" />
                </div>
              </div>
            </div>

            {/* Right: Flow Illustration */}
            <div className="p-8 rounded-xl bg-card border border-border/50">
              <div className="flex items-center justify-between gap-4">
                {/* From Networks */}
                <div className="space-y-3 flex-1">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-background/60 border border-border/50">
                    <img src={ethereumIcon} alt="Ethereum" className="w-6 h-6" />
                    <span className="text-sm font-medium">Ethereum</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-background/60 border border-border/50">
                    <img src={baseIcon} alt="Base" className="w-6 h-6" />
                    <span className="text-sm font-medium">Base</span>
                  </div>
                </div>

                {/* Arrow */}
                <div className="flex flex-col items-center gap-2">
                  <ArrowRight className="w-8 h-8 text-primary" />
                  <span className="text-xs text-muted-foreground font-medium">CCTP</span>
                </div>

                {/* To Network */}
                <div className="flex-1">
                  <div className="flex items-center gap-3 p-4 rounded-lg bg-primary/5 border border-primary/30">
                    <img src={arcIcon} alt="Arc" className="w-8 h-8" />
                    <div>
                      <div className="text-sm font-semibold">Arc Network</div>
                      <div className="text-xs text-muted-foreground">Destination</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* USYC Note */}
          <div className="mt-12 p-6 rounded-xl bg-muted/50 border border-border/50">
            <div className="flex gap-3">
              <Info className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="font-semibold text-sm">Note about USYC</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  USYC is a yield-bearing institutional token. It is only available for allowlisted wallets. 
                  If your wallet is not allowlisted, you will only see USDC and EURC.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
