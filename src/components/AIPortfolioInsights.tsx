import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, TrendingUp, AlertTriangle, CheckCircle, Loader2, RefreshCw } from "lucide-react";
import { analyzePortfolio } from "@/services/aiService";

interface AIPortfolioInsightsProps {
  currentAllocations: { USDC: number; EURC: number; XSGD: number };
  targetAllocations: { USDC: number; EURC: number; XSGD: number };
  totalValue: number;
}

const AIPortfolioInsights = ({ 
  currentAllocations, 
  targetAllocations, 
  totalValue 
}: AIPortfolioInsightsProps) => {
  const [analysis, setAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const loadAnalysis = async () => {
    setLoading(true);
    const result = await analyzePortfolio(currentAllocations, targetAllocations, totalValue);
    setAnalysis(result);
    setLoading(false);
  };

  useEffect(() => {
    if (import.meta.env.VITE_OPENAI_API_KEY && totalValue > 0) {
      loadAnalysis();
    }
  }, [totalValue]);

  if (!import.meta.env.VITE_OPENAI_API_KEY) return null;

  return (
    <Card className="p-6 border border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">AI Portfolio Insights</h3>
            <p className="text-xs text-muted-foreground">Real-time analysis</p>
          </div>
        </div>
        
        {analysis && (
          <Button
            variant="ghost"
            size="sm"
            onClick={loadAnalysis}
            disabled={loading}
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-4">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Analyzing portfolio...</span>
        </div>
      ) : analysis ? (
        <div className="space-y-4">
          {/* Health Status */}
          <div className="flex items-center gap-2 p-3 rounded-xl bg-background/50">
            {analysis.health === "Good" ? (
              <CheckCircle className="w-5 h-5 text-success" />
            ) : analysis.health === "Warning" ? (
              <AlertTriangle className="w-5 h-5 text-warning" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-destructive" />
            )}
            <div>
              <span className="font-medium text-sm">Portfolio Health</span>
              <p className={`text-xs ${
                analysis.health === "Good" ? "text-success" : 
                analysis.health === "Warning" ? "text-warning" : "text-destructive"
              }`}>
                {analysis.health}
              </p>
            </div>
          </div>

          {/* Risk Assessment */}
          <p className="text-sm text-muted-foreground leading-relaxed">
            {analysis.riskAssessment}
          </p>

          {/* Suggestions */}
          {analysis.suggestions && analysis.suggestions.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recommendations</p>
              <ul className="space-y-2">
                {analysis.suggestions.map((suggestion: string, i: number) => (
                  <li key={i} className="text-sm flex items-start gap-2 p-2 rounded-lg bg-background/50">
                    <TrendingUp className="w-4 h-4 mt-0.5 flex-shrink-0 text-primary" />
                    <span className="text-muted-foreground">{suggestion}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Rebalance Alert */}
          {analysis.rebalanceNeeded && (
            <div className="p-3 rounded-xl bg-warning/10 border border-warning/20 text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-warning" />
              <span>Portfolio drift detected. Consider rebalancing.</span>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-4">
          <Button
            onClick={loadAnalysis}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <Sparkles className="w-4 h-4" />
            Get AI Analysis
          </Button>
        </div>
      )}
    </Card>
  );
};

export default AIPortfolioInsights;

