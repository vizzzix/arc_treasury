import { Button } from "@/components/ui/button";
import { WalletConnect } from "@/components/WalletConnect";
import { UserMenu } from "@/components/UserMenu";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAccount } from "wagmi";
import { useUSYCPrice } from "@/hooks/useUSYCPrice";
import arcLogo from "@/assets/arc-logo.png";

const Litepaper = () => {
  const navigate = useNavigate();
  const { isConnected } = useAccount();
  const { apy } = useUSYCPrice();
  const netAPY = (apy * 0.95).toFixed(2); // Net APY after 5% platform fee

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Animated gradient background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute top-0 -left-40 w-80 h-80 bg-primary/20 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob" />
        <div className="absolute top-0 -right-40 w-80 h-80 bg-purple-500/20 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000" />
        <div className="absolute -bottom-40 left-1/2 w-80 h-80 bg-blue-500/20 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000" />
      </div>

      {/* Header */}
      <header className="border-b border-border/20 sticky top-0 bg-background/60 backdrop-blur-xl z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/")}
                className="hover:bg-white/10"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <img src={arcLogo} alt="Arc Treasury" className="w-8 h-8" />
              <h1 className="text-2xl font-bold">Litepaper</h1>
            </div>
            <div className="flex items-center gap-3">
              {isConnected ? <UserMenu /> : <WalletConnect />}
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-6 py-12">
        <article className="max-w-3xl mx-auto space-y-10">
          {/* Cover */}
          <div className="text-center space-y-4 pb-8 border-b border-white/10">
            <img src={arcLogo} alt="Arc Treasury" className="w-16 h-16 mx-auto" />
            <h1 className="text-4xl font-bold">Arc Treasury</h1>
            <p className="text-lg text-muted-foreground">
              Sustainable yield on stablecoins via US Treasury Bills
            </p>
            <p className="text-xs text-muted-foreground">Arc Testnet · November 2025</p>
          </div>

          {/* Overview */}
          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-primary">Overview</h2>
            <p className="text-muted-foreground leading-relaxed">
              Arc Treasury is a yield vault on Arc Network. Deposit USDC/EURC → converted to USYC via Hashnote Teller → earn ~{netAPY}% APY from US Treasury Bills. Real on-chain integration, institutional-grade yield.
            </p>
          </section>

          {/* USYC */}
          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-primary">What is USYC?</h2>
            <p className="text-muted-foreground leading-relaxed">
              USYC = Hashnote Short Duration Yield Fund. Tokenized money market fund investing in reverse repo on US Government securities. Regulated by BMA and CIMA.
            </p>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="p-5 rounded-2xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10">
                <h3 className="font-semibold mb-3">Fund Details</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Currency</span><span>USDC</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Performance Fee</span><span>10%</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Redemption Fee</span><span>0.1%</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Subscription</span><span>0%</span></div>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10">
                <h3 className="font-semibold mb-3">Key Benefits</h3>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>• Instant on-chain subscribe/redeem 24/7</p>
                  <p>• No credit intermediaries</p>
                  <p>• Assets in reverse repo (safe)</p>
                  <p>• Transparent pricing via oracle</p>
                </div>
              </div>
            </div>
          </section>

          {/* How It Works */}
          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-primary">How It Works</h2>
            <div className="p-5 rounded-2xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10">
              <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
                <span className="px-3 py-1.5 rounded-lg bg-primary/10 font-medium">USDC</span>
                <span className="text-muted-foreground">→</span>
                <span className="px-3 py-1.5 rounded-lg bg-blue-500/10 font-medium">Arc Treasury</span>
                <span className="text-muted-foreground">→</span>
                <span className="px-3 py-1.5 rounded-lg bg-green-500/10 font-medium">USYC</span>
                <span className="text-muted-foreground">→</span>
                <span className="px-3 py-1.5 rounded-lg bg-yellow-500/10 font-medium text-green-400">~{netAPY}% APY</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              *APY variable, based on ~{apy.toFixed(1)}% USYC yield minus 5% platform fee
            </p>
          </section>

          {/* Deposit Options */}
          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-primary">Deposit Options</h2>
            <p className="text-muted-foreground">
              All deposits earn same APY. Locks give bonus Points (not extra yield).
            </p>

            <div className="rounded-2xl overflow-hidden border border-white/10">
              <table className="w-full text-sm">
                <thead className="bg-white/5">
                  <tr>
                    <th className="py-3 px-4 text-left font-medium">Type</th>
                    <th className="py-3 px-4 text-left font-medium">Lock</th>
                    <th className="py-3 px-4 text-left font-medium">APY</th>
                    <th className="py-3 px-4 text-left font-medium">Points</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  <tr><td className="py-3 px-4">Flexible</td><td className="py-3 px-4 text-muted-foreground">None</td><td className="py-3 px-4 text-primary font-medium">~{netAPY}%</td><td className="py-3 px-4">1x</td></tr>
                  <tr className="bg-blue-500/5"><td className="py-3 px-4">1 Month</td><td className="py-3 px-4 text-muted-foreground">30 days</td><td className="py-3 px-4 text-primary font-medium">~{netAPY}%</td><td className="py-3 px-4 text-blue-400 font-medium">1.5x</td></tr>
                  <tr className="bg-purple-500/5"><td className="py-3 px-4">3 Months</td><td className="py-3 px-4 text-muted-foreground">90 days</td><td className="py-3 px-4 text-primary font-medium">~{netAPY}%</td><td className="py-3 px-4 text-purple-400 font-medium">2x</td></tr>
                  <tr className="bg-green-500/5"><td className="py-3 px-4">12 Months</td><td className="py-3 px-4 text-muted-foreground">365 days</td><td className="py-3 px-4 text-primary font-medium">~{netAPY}%</td><td className="py-3 px-4 text-green-400 font-medium">3x</td></tr>
                </tbody>
              </table>
            </div>

            <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-sm">
              <strong>Early Withdrawal:</strong> 25% penalty on principal. Yield can be claimed anytime.
            </div>
          </section>

          {/* Points */}
          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-primary">Points System</h2>
            <div className="p-5 rounded-2xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Daily</span><code className="px-2 py-0.5 rounded bg-white/5 text-xs">1 pt = $10 × 1 day × multiplier</code></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Deposit bonus</span><code className="px-2 py-0.5 rounded bg-white/5 text-xs">1 pt per $100</code></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Referral</span><span className="text-blue-400">10% of referral's points</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">NFT boost</span><span className="text-primary">1.2x multiplier</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Minimum</span><span className="text-yellow-400">$100 for points</span></div>
              </div>
            </div>
          </section>

          {/* Business Model */}
          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-primary">Business Model</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="p-5 rounded-2xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10">
                <h3 className="font-semibold mb-3">Revenue</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Platform fee</span><span className="text-primary font-medium">5% of yield</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Early withdrawal</span><span className="font-medium">25% penalty</span></div>
                </div>
              </div>
              <div className="p-5 rounded-2xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10">
                <h3 className="font-semibold mb-3">Distribution</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Users</span><span className="text-green-400 font-medium">95% of yield</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Protocol</span><span className="font-medium">5% of yield</span></div>
                </div>
              </div>
            </div>
          </section>

          {/* Roadmap */}
          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-primary">Roadmap 2026</h2>
            <div className="space-y-3">
              <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-xs font-medium">Q1</span>
                  <span className="font-medium">Mainnet Launch</span>
                </div>
                <p className="text-xs text-muted-foreground">Arc Mainnet, USYC whitelist, audit. Target: $1-5M TVL</p>
              </div>
              <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-xs font-medium">Q2</span>
                  <span className="font-medium">Growth</span>
                </div>
                <p className="text-xs text-muted-foreground">Marketing, Aave/Pendle strategies. Target: $10-25M TVL</p>
              </div>
              <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 text-xs font-medium">Q3</span>
                  <span className="font-medium">ARC Token</span>
                </div>
                <p className="text-xs text-muted-foreground">Governance token, points conversion, DAO. Target: $50M TVL</p>
              </div>
              <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 text-xs font-medium">Q4</span>
                  <span className="font-medium">Scale</span>
                </div>
                <p className="text-xs text-muted-foreground">Cross-chain, institutions, more RWA. Target: $100M TVL</p>
              </div>
            </div>
          </section>

          {/* Risks */}
          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-primary">Risks</h2>
            <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-sm">
              <strong>Testnet Only:</strong> Test tokens with no real value. Do not deposit real assets.
            </div>
            <div className="text-sm text-muted-foreground space-y-2">
              <p>• <strong>Smart Contract Risk:</strong> May contain bugs. Only deposit what you can lose.</p>
              <p>• <strong>Yield Fluctuation:</strong> APY from Treasury rates, varies over time.</p>
              <p>• <strong>Early Withdrawal:</strong> 25% penalty. Plan liquidity needs.</p>
            </div>
          </section>

          {/* Footer */}
          <section className="pt-8 border-t border-white/10 text-center space-y-3">
            <p className="font-semibold">Arc Treasury</p>
            <p className="text-sm text-muted-foreground">Sustainable yield on Arc Network</p>
            <div className="flex justify-center gap-4 text-sm">
              <a href="https://arctreasury.biz" className="text-primary hover:underline">Website</a>
              <span className="text-muted-foreground">•</span>
              <a href="https://testnet.arcscan.app/address/0x17ca5232415430bC57F646A72fD15634807bF729" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Explorer</a>
              <span className="text-muted-foreground">•</span>
              <a href="/faq" className="text-primary hover:underline">FAQ</a>
            </div>
          </section>

          {/* Disclaimer */}
          <section className="pt-6 border-t border-white/10">
            <p className="text-xs text-muted-foreground text-center">
              <strong>Disclaimer:</strong> Informational purposes only. Testnet deployment, not financial advice. APY estimates not guaranteed.
            </p>
          </section>
        </article>
      </main>
    </div>
  );
};

export default Litepaper;
