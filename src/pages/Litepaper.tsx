import { Button } from "@/components/ui/button";
import { ArrowLeft, Download } from "lucide-react";
import { useNavigate } from "react-router-dom";
import arcLogo from "@/assets/arc-logo.png";

const Litepaper = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <nav className="border-b border-border/30 bg-background/80 backdrop-blur-lg sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate("/documentation")}
              className="flex items-center gap-2 hover:text-primary transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back to Documentation</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Content */}
      <div className="container mx-auto px-6 py-12">
        <article className="max-w-4xl mx-auto space-y-12">
          {/* Cover */}
          <div className="text-center space-y-6 pb-8 border-b border-border/30">
            <img src={arcLogo} alt="Arc Treasury" className="w-20 h-20 mx-auto" />
            <h1 className="text-4xl lg:text-5xl font-bold">Arc Treasury</h1>
            <p className="text-xl text-muted-foreground">
              Earn sustainable yield on stablecoins with flexible and locked deposit options
            </p>
            <div className="text-sm text-muted-foreground">
              <p>Arc Testnet · November 2025</p>
            </div>
          </div>

          {/* Abstract */}
          <section className="space-y-4">
            <h2 className="text-3xl font-bold">Overview</h2>
            <p className="text-lg leading-relaxed text-muted-foreground">
              Arc Treasury is a decentralized treasury management protocol on Arc Network that enables users to earn yield on USDC and EURC stablecoins. Deposits are allocated to USYC (Hashnote Short Duration Yield), a tokenized money market fund backed by US Treasury bills, providing sustainable returns with institutional-grade security.
            </p>
          </section>

          {/* How It Works */}
          <section className="space-y-6">
            <h2 className="text-3xl font-bold">How It Works</h2>

            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold mb-3">1. Deposit</h3>
                <p className="text-lg leading-relaxed text-muted-foreground">
                  Connect your wallet and deposit USDC or EURC into the treasury vault. Your deposit is represented as vault shares, tracking your proportional ownership of the pool.
                </p>
              </div>

              <div>
                <h3 className="text-xl font-semibold mb-3">2. Yield Generation</h3>
                <p className="text-lg leading-relaxed text-muted-foreground">
                  Funds are deployed to USYC, earning yield from US Treasury bills. The NAV (Net Asset Value) of USYC increases over time as yield accrues, automatically increasing your vault share value.
                </p>
              </div>

              <div>
                <h3 className="text-xl font-semibold mb-3">3. Withdraw</h3>
                <p className="text-lg leading-relaxed text-muted-foreground">
                  Withdraw your principal plus earned yield anytime from flexible deposits, or at maturity from locked positions. Early withdrawal from locked positions incurs a 25% penalty on principal.
                </p>
              </div>
            </div>
          </section>

          {/* Deposit Options */}
          <section className="space-y-6">
            <h2 className="text-3xl font-bold">Deposit Options</h2>

            <div className="space-y-6">
              {/* Flexible Deposits */}
              <div className="p-6 rounded-xl bg-card border border-border/50">
                <h3 className="text-2xl font-semibold mb-4">Flexible Deposits</h3>
                <p className="text-lg text-muted-foreground mb-4">
                  Deposit and withdraw anytime with no lock-up period.
                </p>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Current APY</span>
                    <span className="text-xl font-bold text-primary">~4.2%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Minimum deposit</span>
                    <span className="font-semibold">None</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Lock period</span>
                    <span className="font-semibold">None</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Points multiplier</span>
                    <span className="font-semibold">1x</span>
                  </div>
                </div>
              </div>

              {/* Locked Positions */}
              <div>
                <h3 className="text-2xl font-semibold mb-4">Locked Positions</h3>
                <p className="text-lg text-muted-foreground mb-6">
                  Lock your funds for fixed periods to earn boosted APY and increased points multipliers. Early withdrawal available with 25% penalty on principal (earned yield not penalized).
                </p>

                <div className="grid md:grid-cols-3 gap-4">
                  {/* 1 Month Lock */}
                  <div className="p-5 rounded-xl bg-blue-500/10 border border-blue-500/20">
                    <div className="text-center mb-4">
                      <p className="text-sm text-muted-foreground mb-1">1 Month Lock</p>
                      <p className="text-3xl font-bold text-blue-400">4.85%</p>
                      <p className="text-xs text-muted-foreground">APY</p>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Boost</span>
                        <span className="font-semibold">+0.65%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Points</span>
                        <span className="font-semibold">1.5x</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Min deposit</span>
                        <span className="font-semibold">$10</span>
                      </div>
                    </div>
                  </div>

                  {/* 3 Months Lock */}
                  <div className="p-5 rounded-xl bg-purple-500/10 border border-purple-500/20">
                    <div className="text-center mb-4">
                      <p className="text-sm text-muted-foreground mb-1">3 Months Lock</p>
                      <p className="text-3xl font-bold text-purple-400">5.55%</p>
                      <p className="text-xs text-muted-foreground">APY</p>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Boost</span>
                        <span className="font-semibold">+1.35%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Points</span>
                        <span className="font-semibold">2x</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Min deposit</span>
                        <span className="font-semibold">$10</span>
                      </div>
                    </div>
                  </div>

                  {/* 12 Months Lock */}
                  <div className="p-5 rounded-xl bg-green-500/10 border border-green-500/20">
                    <div className="text-center mb-4">
                      <p className="text-sm text-muted-foreground mb-1">12 Months Lock</p>
                      <p className="text-3xl font-bold text-green-400">6.85%</p>
                      <p className="text-xs text-muted-foreground">APY</p>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Boost</span>
                        <span className="font-semibold">+2.65%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Points</span>
                        <span className="font-semibold">3x</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Min deposit</span>
                        <span className="font-semibold">$10</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Points System */}
          <section className="space-y-4">
            <h2 className="text-3xl font-bold">Points System</h2>
            <p className="text-lg leading-relaxed text-muted-foreground">
              Earn points based on your deposit amount and time locked. Points are calculated daily and can be boosted with locked positions or the Points Multiplier NFT.
            </p>

            <div className="p-6 rounded-xl bg-card border border-border/50">
              <h3 className="text-lg font-semibold mb-4">Points Calculation</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Base formula</span>
                  <code className="px-3 py-1 rounded bg-muted text-sm font-mono">
                    Points = Amount × Days × Multiplier
                  </code>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">NFT boost</span>
                  <span className="font-semibold text-primary">2x multiplier</span>
                </div>
              </div>
            </div>

            <div className="text-sm text-muted-foreground mt-4">
              <p>
                <strong>Example:</strong> $1,000 locked for 3 months (90 days) with 2x lock multiplier = 180,000 points. With NFT boost = 360,000 points.
              </p>
            </div>
          </section>

          {/* Referral System */}
          <section className="space-y-4">
            <h2 className="text-3xl font-bold">Referral System</h2>
            <p className="text-lg leading-relaxed text-muted-foreground">
              Share your unique referral code and earn rewards when referred users deposit into the vault. Track your referral stats in real-time from the dashboard.
            </p>
          </section>

          {/* Bridge Integration */}
          <section className="space-y-4">
            <h2 className="text-3xl font-bold">Native USDC Bridge</h2>
            <p className="text-lg leading-relaxed text-muted-foreground">
              Bridge USDC from Ethereum Sepolia to Arc Network using Circle's CCTP (Cross-Chain Transfer Protocol). No wrapped tokens - native USDC on both chains.
            </p>

            <div className="grid md:grid-cols-2 gap-4 mt-6">
              <div className="p-4 rounded-lg bg-card border border-border/50">
                <h3 className="font-semibold mb-2">Step 1: Get Testnet USDC</h3>
                <p className="text-sm text-muted-foreground">
                  Visit <a href="https://faucet.circle.com/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Circle Faucet</a> to receive free testnet USDC on Ethereum Sepolia
                </p>
              </div>
              <div className="p-4 rounded-lg bg-card border border-border/50">
                <h3 className="font-semibold mb-2">Step 2: Bridge to Arc</h3>
                <p className="text-sm text-muted-foreground">
                  Use the built-in bridge to transfer USDC from Sepolia to Arc Testnet (2-3 minute attestation)
                </p>
              </div>
            </div>
          </section>

          {/* Smart Contracts */}
          <section className="space-y-4">
            <h2 className="text-3xl font-bold">Smart Contracts</h2>
            <p className="text-lg leading-relaxed text-muted-foreground">
              All contracts are deployed on Arc Testnet and fully open-source.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border/30">
                    <th className="py-3 px-4 font-semibold">Contract</th>
                    <th className="py-3 px-4 font-semibold">Address</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  <tr className="border-b border-border/30">
                    <td className="py-3 px-4 font-medium">TreasuryVault</td>
                    <td className="py-3 px-4 font-mono text-xs">
                      <a
                        href="https://testnet.arcscan.app/address/0xe050d1353bf7f4d7f66ff4538333e03d7e52ad87"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        0x88cec...f2743
                      </a>
                    </td>
                  </tr>
                  <tr className="border-b border-border/30">
                    <td className="py-3 px-4 font-medium">USYCOracle</td>
                    <td className="py-3 px-4 font-mono text-xs">
                      <a
                        href="https://testnet.arcscan.app/address/0x9210289432a5c7d7c6506dae8c1716bb47f8d84c"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        0x0f5e0d...b3598
                      </a>
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-medium">PointsMultiplierNFT</td>
                    <td className="py-3 px-4 font-mono text-xs">
                      <a
                        href="https://testnet.arcscan.app/address/0x3eeca3180a2c0db29819ad007ff9869764b97419"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        0xa17af5...e3aee
                      </a>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Technology */}
          <section className="space-y-4">
            <h2 className="text-3xl font-bold">Technology Stack</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-card border border-border/50">
                <h3 className="font-semibold mb-2">Frontend</h3>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• React 18 + TypeScript</li>
                  <li>• Vite + TailwindCSS</li>
                  <li>• wagmi v2 + viem + RainbowKit</li>
                </ul>
              </div>
              <div className="p-4 rounded-lg bg-card border border-border/50">
                <h3 className="font-semibold mb-2">Smart Contracts</h3>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Solidity ^0.8.24</li>
                  <li>• OpenZeppelin libraries</li>
                  <li>• Hardhat development</li>
                </ul>
              </div>
              <div className="p-4 rounded-lg bg-card border border-border/50">
                <h3 className="font-semibold mb-2">Blockchain</h3>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Arc Testnet (Chain ID: 5042002)</li>
                  <li>• EVM-compatible</li>
                  <li>• Circle CCTP integration</li>
                </ul>
              </div>
              <div className="p-4 rounded-lg bg-card border border-border/50">
                <h3 className="font-semibold mb-2">Yield Source</h3>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Hashnote USYC</li>
                  <li>• US Treasury bills backed</li>
                  <li>• On-chain NAV oracle</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Risk Factors */}
          <section className="space-y-6">
            <h2 className="text-3xl font-bold">Risk Factors</h2>

            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <h3 className="text-lg font-semibold mb-2">⚠️ Testnet Deployment</h3>
                <p className="text-muted-foreground">
                  This is a testnet deployment using test tokens only. Do not deposit real assets. All yields and balances are simulated for testing purposes.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">Smart Contract Risk</h3>
                <p className="text-muted-foreground">
                  Smart contracts may contain bugs or vulnerabilities. Only deposit funds you can afford to lose.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">Yield Fluctuation</h3>
                <p className="text-muted-foreground">
                  APY is derived from US Treasury rates and USYC NAV changes. Returns may vary over time based on market conditions.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">Early Withdrawal Penalty</h3>
                <p className="text-muted-foreground">
                  Withdrawing locked positions before maturity incurs a 25% penalty on principal. Plan your liquidity needs accordingly.
                </p>
              </div>
            </div>
          </section>

          {/* Footer */}
          <section className="pt-8 border-t border-border/30">
            <div className="text-center space-y-4">
              <p className="text-lg font-semibold">
                Arc Treasury
              </p>
              <p className="text-sm text-muted-foreground">
                Sustainable yield for stablecoins on Arc Network
              </p>
              <div className="flex justify-center gap-4 text-sm">
                <a href="https://arctreasury.biz" className="text-primary hover:underline">
                  Website
                </a>
                <span className="text-muted-foreground">•</span>
                <a href="https://testnet.arcscan.app/address/0xe050d1353bf7f4d7f66ff4538333e03d7e52ad87" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  Explorer
                </a>
                <span className="text-muted-foreground">•</span>
                <a href="/documentation" className="text-primary hover:underline">
                  Docs
                </a>
              </div>
            </div>
          </section>

          {/* Disclaimer */}
          <section className="pt-6 border-t border-border/30">
            <p className="text-xs text-muted-foreground leading-relaxed text-center">
              <strong>Disclaimer:</strong> This document is for informational purposes only and does not constitute financial, investment, or legal advice. Arc Treasury is a testnet deployment for demonstration purposes. Cryptocurrency investments carry significant risk. APY rates are estimates based on current market conditions and are not guaranteed. Always conduct your own research before making investment decisions.
            </p>
          </section>
        </article>
      </div>
    </div>
  );
};

export default Litepaper;
