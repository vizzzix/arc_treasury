import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, RefreshCw } from "lucide-react";
import { getStrategyRecommendation } from "@/services/aiService";
import { useWallet } from "@/contexts/WalletContext";

interface AIRecommendationProps {
  onApplyStrategy?: (allocations: { USDC: number; EURC: number; XSGD: number }) => void;
}

const AIRecommendation = ({ onApplyStrategy }: AIRecommendationProps) => {
  const { balance } = useWallet();
  const [loading, setLoading] = useState(false);
  const [recommendation, setRecommendation] = useState<any>(null);

  const loadRecommendation = async () => {
    setLoading(true);
    try {
      const result = await getStrategyRecommendation({
        walletBalance: balance || "0",
        riskTolerance: "Moderate",
        goal: "Balanced returns"
      });
      
      if (result) {
        setRecommendation(result);
      }
    } catch (error) {
      console.error("Failed to load AI recommendation:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Auto-load on mount if API key is available
    if (import.meta.env.VITE_OPENAI_API_KEY) {
      loadRecommendation();
    }
  }, []);

  if (!import.meta.env.VITE_OPENAI_API_KEY) {
    return null; // Hide if no API key configured
  }

  return (
    <Card className="relative p-6 border border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5 overflow-hidden">
      {/* Animated gradient orb */}
      <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/20 rounded-full blur-3xl" />
      
      <div className="relative">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">AI Recommendation</h3>
              <p className="text-xs text-muted-foreground">Powered by OpenAI</p>
            </div>
          </div>
          
          {recommendation && (
            <Button
              variant="ghost"
              size="sm"
              onClick={loadRecommendation}
              disabled={loading}
              className="gap-1"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <span className="ml-2 text-sm text-muted-foreground">Analyzing your profile...</span>
          </div>
        ) : recommendation ? (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-background/50 border border-border/50">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-primary">{recommendation.strategy} Strategy</span>
                <span className="text-xs px-2 py-1 rounded-full bg-success/10 text-success border border-success/20">
                  {recommendation.expectedAPY} APY
                </span>
              </div>
              
              <div className="flex items-center gap-4 text-sm mb-3">
                <span className="text-muted-foreground">
                  💵 {recommendation.allocations.USDC}% USDC
                </span>
                <span className="text-muted-foreground">
                  💶 {recommendation.allocations.EURC}% EURC
                </span>
                <span className="text-muted-foreground">
                  💴 {recommendation.allocations.XSGD}% XSGD
                </span>
              </div>
              
              <p className="text-sm text-muted-foreground leading-relaxed">
                {recommendation.reasoning}
              </p>
            </div>

            {onApplyStrategy && (
              <Button
                onClick={() => onApplyStrategy(recommendation.allocations)}
                className="w-full gap-2 bg-gradient-to-r from-primary to-accent hover:opacity-90"
              >
                <Sparkles className="w-4 h-4" />
                Apply AI Strategy
              </Button>
            )}
          </div>
        ) : (
          <div className="text-center py-4">
            <Button
              onClick={loadRecommendation}
              variant="outline"
              className="gap-2"
            >
              <Sparkles className="w-4 h-4" />
              Get AI Recommendation
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
};

export default AIRecommendation;

