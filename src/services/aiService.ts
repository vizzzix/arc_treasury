import { toast } from "sonner";

interface AIRecommendation {
  strategy: string;
  allocations: { USDC: number; EURC: number; XSGD: number };
  reasoning: string;
  riskLevel: "Conservative" | "Balanced" | "Aggressive";
  expectedAPY: string;
}

interface PortfolioAnalysis {
  health: "Good" | "Warning" | "Critical";
  suggestions: string[];
  rebalanceNeeded: boolean;
  riskAssessment: string;
}

const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;

/**
 * Get AI-powered strategy recommendation based on user context
 */
export async function getStrategyRecommendation(
  userContext?: {
    walletBalance?: string;
    riskTolerance?: string;
    goal?: string;
  }
): Promise<AIRecommendation | null> {
  if (!OPENAI_API_KEY) {
    console.warn("OpenAI API key not configured");
    return null;
  }

  try {
    const prompt = `You are a DeFi treasury advisor for Arc Network (a stablecoin-native blockchain).

User Context:
- Wallet Balance: ${userContext?.walletBalance || "Unknown"}
- Risk Tolerance: ${userContext?.riskTolerance || "Moderate"}
- Investment Goal: ${userContext?.goal || "Balanced returns"}

Available stablecoins on Arc:
- USDC (US Dollar) - Most stable, global reserve currency
- EURC (Euro) - European market exposure
- XSGD (Singapore Dollar) - Asia-Pacific exposure

Recommend ONE of these strategies:
1. Conservative (70% USDC, 20% EURC, 10% XSGD) - Low risk, 3-5% APY
2. Balanced (50% USDC, 30% EURC, 20% XSGD) - Medium risk, 5-8% APY
3. Aggressive (30% USDC, 40% EURC, 30% XSGD) - Higher risk, 8-12% APY

Respond in JSON format:
{
  "strategy": "Balanced",
  "allocations": {"USDC": 50, "EURC": 30, "XSGD": 20},
  "reasoning": "Short explanation (max 2 sentences)",
  "riskLevel": "Balanced",
  "expectedAPY": "5-8%"
}`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a DeFi treasury advisor. Always respond with valid JSON only, no markdown.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 300,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error("No response from AI");
    }

    // Parse JSON (remove markdown if present)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Invalid JSON response");
    }

    const recommendation: AIRecommendation = JSON.parse(jsonMatch[0]);
    return recommendation;
  } catch (error: any) {
    console.error("AI recommendation error:", error);
    toast.error("AI recommendation failed. Using default strategy.");
    return null;
  }
}

/**
 * Analyze current portfolio and provide AI insights
 */
export async function analyzePortfolio(
  currentAllocations: { USDC: number; EURC: number; XSGD: number },
  targetAllocations: { USDC: number; EURC: number; XSGD: number },
  totalValue: number
): Promise<PortfolioAnalysis | null> {
  if (!OPENAI_API_KEY) {
    return null;
  }

  try {
    const prompt = `Analyze this stablecoin treasury portfolio on Arc Network:

Current Allocations:
- USDC: ${currentAllocations.USDC}%
- EURC: ${currentAllocations.EURC}%
- XSGD: ${currentAllocations.XSGD}%

Target Allocations:
- USDC: ${targetAllocations.USDC}%
- EURC: ${targetAllocations.EURC}%
- XSGD: ${targetAllocations.XSGD}%

Total Value: $${totalValue}

Provide analysis in JSON:
{
  "health": "Good|Warning|Critical",
  "suggestions": ["suggestion 1", "suggestion 2"],
  "rebalanceNeeded": true|false,
  "riskAssessment": "One sentence assessment"
}`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a DeFi portfolio analyst. Respond with JSON only.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.5,
        max_tokens: 250,
      }),
    });

    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      return null;
    }

    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error("Portfolio analysis error:", error);
    return null;
  }
}

/**
 * Get AI explanation for a specific treasury action
 */
export async function getActionExplanation(
  action: "deposit" | "withdraw" | "rebalance",
  amount: string,
  token: string
): Promise<string | null> {
  if (!OPENAI_API_KEY) {
    return null;
  }

  try {
    const prompts = {
      deposit: `Explain in 1 sentence why depositing ${amount} ${token} into a treasury is a good move for passive income.`,
      withdraw: `Explain in 1 sentence when it's appropriate to withdraw ${amount} ${token} from a treasury.`,
      rebalance: `Explain in 1 sentence why rebalancing a stablecoin portfolio is important for risk management.`,
    };

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a helpful DeFi advisor. Be concise and friendly.",
          },
          {
            role: "user",
            content: prompts[action],
          },
        ],
        temperature: 0.7,
        max_tokens: 100,
      }),
    });

    const data = await response.json();
    return data.choices[0]?.message?.content || null;
  } catch (error) {
    console.error("AI explanation error:", error);
    return null;
  }
}

