import { useParams, Navigate } from "react-router-dom";

// Valid tokens for accessing cheat sheets
const VALID_TOKENS = ["robert-hivemind-dec8"];

const CallCheatSheet = () => {
  const { token } = useParams<{ token: string }>();

  if (!token || !VALID_TOKENS.includes(token)) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary mb-2">🎯 Investor Call Cheat Sheet</h1>
          <p className="text-xl text-muted-foreground">Kayla Phillips — Hivemind Capital</p>
          <div className="mt-4 inline-block px-4 py-2 rounded-full bg-primary/10 text-primary font-medium">
            📅 Monday, Dec 8 | 7:00 AM PST (18:00 MSK)
          </div>
        </div>

        {/* Call Structure */}
        <Section title="⏱️ CALL STRUCTURE (30 min)" color="gray">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
            <TimeBlock time="0:00-2:00" label="Intro & pleasantries" />
            <TimeBlock time="2:00-7:00" label="Project overview" />
            <TimeBlock time="7:00-12:00" label="Demo (screen share)" />
            <TimeBlock time="12:00-15:00" label="Team & roadmap" />
            <TimeBlock time="15:00-20:00" label="Business model & ask" />
            <TimeBlock time="20:00-28:00" label="Q&A from Kayla" />
            <TimeBlock time="28:00-30:00" label="Our questions & next steps" />
          </div>
        </Section>

        {/* Full Opening Script */}
        <Section title="📢 FULL INTRO SCRIPT (5 min)" color="blue">
          <div className="space-y-4">
            <ScriptBlock title="Opening" content="Hi Kayla, thanks for taking the time to meet with us. I'm Robert, co-founder of Arc Treasury. I'll give you a quick overview of what we're building and then happy to dive into any questions." />

            <ScriptBlock title="The Problem" content="Right now, there's over <strong>$270 billion</strong> sitting in stablecoins, mostly earning zero yield. Users have two bad options: either keep USDC idle, or put it into DeFi lending protocols with smart contract risk and variable rates that can drop to near-zero." />

            <ScriptBlock title="Our Solution" content="Arc Treasury solves this by offering <strong>real, stable yield from US Treasury Bills</strong> — currently around 4% APY — through a simple deposit interface. We're building on Circle's new Arc blockchain, which gives us native USDC integration and early ecosystem positioning." />

            <ScriptBlock title="How It Works" content="The flow is simple:<br/>1. User deposits USDC into our vault<br/>2. We convert it to USYC through Hashnote's Teller contract<br/>3. USYC is backed by US Treasury reverse repo — the safest yield source<br/>4. User earns ~4% APY with one click<br/><br/>On top of this, we've built a multi-chain bridge using Circle's CCTP protocol — supporting Sepolia, Arc, and Solana (6 directions) — plus an AMM for USDC/EURC swaps. All live on testnet today." />

            <ScriptBlock title="Democratizing Access" highlight content="Here's what makes this powerful: <strong>Direct USYC access requires institutional investor status, KYC, and a $100K minimum</strong>. That locks out 99% of crypto users.<br/><br/>Arc Treasury removes these barriers — <strong>any USDC holder can access T-Bill yields</strong> through our vault. We're democratizing access to the safest yield source in traditional finance." />

            <ScriptBlock title="Why Arc?" content="Arc is Circle's own Layer 1 blockchain. Building here means:<br/>• <strong>Native USDC</strong>, not bridged tokens<br/>• <strong>Direct relationship</strong> with the largest stablecoin issuer<br/>• <strong>First mover advantage</strong> in a new ecosystem<br/>• <strong>Alignment with Circle's institutional focus</strong>" />

            <ScriptBlock title="Current Status" highlight content="Unlike most projects at seed stage, we don't have a whitepaper — we have a <strong>working product</strong>. Everything I just described is live on Arc Testnet today:<br/>• Treasury vault earning real USYC yield<br/>• Locked positions with 1/3/12 month terms<br/>• Multi-chain CCTP bridge: Sepolia ↔ Arc ↔ Solana (6 directions)<br/>• Stablecoin swap AMM<br/>• Points system, NFT badges, leaderboards — all functional<br/>• Battle-tested: 50+ testnet deployments<br/><br/>You can try it right now at <strong>arctreasury.biz</strong>. This isn't a pitch deck project — this is a full-stack DeFi product ready for mainnet." />
          </div>
        </Section>

        {/* Team Details */}
        <Section title="👥 TEAM" color="purple">
          <div className="grid md:grid-cols-2 gap-4">
            <TeamCard
              name="Anton"
              role="Founder & Lead Developer"
              twitter="@claimpilot"
              points={[
                "Full-stack blockchain developer (5+ years)",
                "Built Arc Treasury solo: smart contracts + full frontend",
                "Battle-tested: 50+ testnet deployments",
                "Base Batches 002 participant",
                "Zama FHE Builder Track",
                "Built Stable2Pay — POS for Stable Network"
              ]}
            />
            <TeamCard
              name="Robert"
              role="Co-founder & Operations"
              twitter="@Robsvr"
              points={[
                "COO at BonusBlock — Web3 growth platform",
                "Worked with: Injective, Xion, Axelar, Theoriq",
                "BD & partnerships across L1/L2 ecosystems",
                "Managed teams of 5-15 people",
                "Business development, partnerships, investor relations"
              ]}
            />
          </div>
          <div className="mt-4 p-3 rounded-lg bg-muted/30 text-sm">
            <strong>Ready to hire:</strong> SMM Manager, Market Researcher, Junior Developer
          </div>
        </Section>

        {/* Key Numbers - Expanded */}
        <Section title="📊 KEY NUMBERS" color="green">
          <div className="grid md:grid-cols-2 gap-4">
            <InfoCard title="Traction (1st month, $0 marketing)" emoji="📈" color="green">
              <table className="w-full text-sm">
                <tbody>
                  <tr><td className="py-1">Transactions</td><td className="text-right font-bold">1,269</td></tr>
                  <tr><td className="py-1">Volume processed</td><td className="text-right font-bold">$31M+</td></tr>
                  <tr><td className="py-1">Active wallets</td><td className="text-right font-bold">162</td></tr>
                  <tr><td className="py-1">Points earned</td><td className="text-right font-bold">290K+</td></tr>
                  <tr><td className="py-1">Referrals</td><td className="text-right font-bold">24+</td></tr>
                </tbody>
              </table>
            </InfoCard>
            <InfoCard title="Revenue @ $100M TVL" emoji="💰" color="yellow">
              <table className="w-full text-sm">
                <tbody>
                  <tr><td className="py-1">Vault fee (5% of yield)</td><td className="text-right">$200K/yr</td></tr>
                  <tr><td className="py-1">Bridge fee (0.06%)</td><td className="text-right">$1.4M/yr</td></tr>
                  <tr><td className="py-1">Swap fee (0.2%)</td><td className="text-right">$1M/yr</td></tr>
                  <tr className="border-t border-border"><td className="py-2 font-bold">TOTAL</td><td className="text-right font-bold text-primary text-lg">$2.6M/year</td></tr>
                </tbody>
              </table>
            </InfoCard>
          </div>
          <div className="mt-4 p-3 rounded-lg bg-green-500/10 border border-green-500/30 text-sm text-center">
            <strong>Market:</strong> $273B stablecoins → <strong>$1.5T by 2030</strong> | CCTP: $110B+ processed | T-Bill protocols: $1B+ TVL
          </div>
        </Section>

        {/* Investment Ask - Expanded */}
        <Section title="💵 INVESTMENT ASK" color="purple">
          <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div className="text-center p-2 rounded-lg bg-background/50">
                <div className="text-muted-foreground text-xs">Target</div>
                <div className="font-bold text-lg">$1M</div>
              </div>
              <div className="text-center p-2 rounded-lg bg-background/50">
                <div className="text-muted-foreground text-xs">Minimum</div>
                <div className="font-bold text-lg">$600K</div>
              </div>
              <div className="text-center p-2 rounded-lg bg-background/50">
                <div className="text-muted-foreground text-xs">Token</div>
                <div className="font-bold text-lg">15-20%</div>
              </div>
              <div className="text-center p-2 rounded-lg bg-background/50">
                <div className="text-muted-foreground text-xs">FDV</div>
                <div className="font-bold text-lg">$5-6M</div>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mt-3">
              <div className="text-center"><span className="text-muted-foreground">Instrument:</span> <strong>SAFT</strong></div>
              <div className="text-center"><span className="text-muted-foreground">Vesting:</span> <strong>6mo + 18mo</strong></div>
              <div className="text-center"><span className="text-muted-foreground">Previous:</span> <strong>$0 (bootstrapped)</strong></div>
              <div className="text-center"><span className="text-muted-foreground">Lead:</span> <strong>In discussions</strong></div>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-3 text-center italic">
            Seed pricing reflects product risk, not market risk — built, tested, aligned.
          </p>
        </Section>

        {/* Use of Funds */}
        <Section title="💸 USE OF FUNDS ($1M)" color="blue">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <FundBox label="Security Audit" amount="$150K" percent={15} />
            <FundBox label="USYC Integration" amount="$100K" percent={10} />
            <FundBox label="Team (6 hires)" amount="$250K" percent={25} />
            <FundBox label="Legal & Entity" amount="$80K" percent={8} />
            <FundBox label="Marketing" amount="$150K" percent={15} />
            <FundBox label="Operations" amount="$120K" percent={12} />
            <FundBox label="Contingency" amount="$150K" percent={15} />
          </div>

          {/* Team Salaries Breakdown */}
          <div className="mt-4 p-3 rounded-lg bg-purple-500/10 border border-purple-500/30">
            <div className="font-semibold text-sm mb-2">👥 Team Salaries ($250K) — Year 1</div>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground border-b border-border/30">
                  <td className="py-1">Role</td>
                  <td className="text-right">Monthly</td>
                  <td className="text-right">Start</td>
                  <td className="text-right">Y1 Cost</td>
                </tr>
              </thead>
              <tbody>
                <tr><td className="py-1">Founder/Developer</td><td className="text-right">$6,000</td><td className="text-right">Mo 1</td><td className="text-right">$72K</td></tr>
                <tr><td className="py-1">Co-founder/PM</td><td className="text-right">$4,000</td><td className="text-right">Mo 1</td><td className="text-right">$48K</td></tr>
                <tr><td className="py-1">Operations Director</td><td className="text-right">$3,500</td><td className="text-right">Mo 2</td><td className="text-right">$38.5K</td></tr>
                <tr><td className="py-1">Accountant (part-time)</td><td className="text-right">$800</td><td className="text-right">Mo 2</td><td className="text-right">$8.8K</td></tr>
                <tr><td className="py-1">Senior Developer</td><td className="text-right">$5,000</td><td className="text-right">Mo 4</td><td className="text-right">$45K</td></tr>
                <tr><td className="py-1">Junior Developer</td><td className="text-right">$2,500</td><td className="text-right">Mo 7</td><td className="text-right">$15K</td></tr>
                <tr className="border-t border-border/30 font-semibold"><td className="py-1">Total (Core Team)</td><td></td><td></td><td className="text-right text-primary">$227K</td></tr>
              </tbody>
            </table>
            <div className="mt-3 pt-2 border-t border-border/20">
              <div className="text-xs text-muted-foreground mb-1">Ready to step in (from contingency/marketing):</div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="p-1.5 rounded bg-background/30 text-center">
                  <div className="font-medium">SMM Manager</div>
                  <div className="text-muted-foreground">$1.5-2K/mo</div>
                </div>
                <div className="p-1.5 rounded bg-background/30 text-center">
                  <div className="font-medium">Market Researcher</div>
                  <div className="text-muted-foreground">$1-1.5K/mo</div>
                </div>
                <div className="p-1.5 rounded bg-background/30 text-center">
                  <div className="font-medium">Community Mgr</div>
                  <div className="text-muted-foreground">$1.5-2K/mo</div>
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2 italic">Below-market rates — founders take risk for equity upside. Georgia rates 2-3x cheaper than US/EU.</p>
          </div>

          {/* Operations & Travel Breakdown */}
          <div className="mt-4 p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
            <div className="font-semibold text-sm mb-2">✈️ Operations & Travel ($120K)</div>
            <div className="grid md:grid-cols-3 gap-3 text-xs">
              <div>
                <div className="font-medium mb-1">Conferences ($25-30K)</div>
                <ul className="text-muted-foreground space-y-0.5">
                  <li>• Token2049 Dubai: $5-8K</li>
                  <li>• Token2049 Singapore: $6-10K</li>
                  <li>• ETH Denver/CC: $4-6K</li>
                  <li>• Circle events: $2-4K</li>
                  <li>• Smaller events: $4-6K</li>
                </ul>
              </div>
              <div>
                <div className="font-medium mb-1">Travel ($20-25K)</div>
                <ul className="text-muted-foreground space-y-0.5">
                  <li>• Investor meetings (US/EU): 4x $3K</li>
                  <li>• Partner meetings: 5x $2K</li>
                  <li>• Team meetups: 3x $1.5K</li>
                </ul>
              </div>
              <div>
                <div className="font-medium mb-1">Office & Infra ($20K)</div>
                <ul className="text-muted-foreground space-y-0.5">
                  <li>• Co-working: $6-10K/yr</li>
                  <li>• Equipment: $3-5K</li>
                  <li>• Software/SaaS: $4-6K/yr</li>
                  <li>• RPC nodes: $1.5-2.5K/yr</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Marketing Breakdown */}
          <div className="mt-4 p-3 rounded-lg bg-pink-500/10 border border-pink-500/30">
            <div className="font-semibold text-sm mb-2">📣 Marketing ($150K)</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              <div className="text-center p-2 rounded bg-background/50"><div className="font-bold">$50K</div><div className="text-muted-foreground">KOL campaigns</div></div>
              <div className="text-center p-2 rounded bg-background/50"><div className="font-bold">$40K</div><div className="text-muted-foreground">Paid ads (CT, etc)</div></div>
              <div className="text-center p-2 rounded bg-background/50"><div className="font-bold">$30K</div><div className="text-muted-foreground">PR & content</div></div>
              <div className="text-center p-2 rounded bg-background/50"><div className="font-bold">$30K</div><div className="text-muted-foreground">Community incentives</div></div>
            </div>
          </div>

          {/* Legal Breakdown */}
          <div className="mt-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
            <div className="font-semibold text-sm mb-2">⚖️ Legal & Entity ($80K)</div>
            <div className="grid md:grid-cols-2 gap-3 text-xs">
              <div>
                <div className="font-medium mb-1">Georgian LLC (~$5K) — Q1 2026</div>
                <ul className="text-muted-foreground space-y-0.5">
                  <li>• Registration: $2-3K</li>
                  <li>• VZP status: $0.5-1K</li>
                  <li>• Bank accounts: $0.5-1K</li>
                </ul>
              </div>
              <div>
                <div className="font-medium mb-1">Token Entity (~$75K) — Q4 2026+</div>
                <ul className="text-muted-foreground space-y-0.5">
                  <li>• BVI/Cayman entity: $15-25K</li>
                  <li>• Token legal opinions: $20-30K</li>
                  <li>• SAFT documentation: $10-15K</li>
                  <li>• Ongoing counsel: $5-10K</li>
                </ul>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Two entities: Georgian LLC (operations, 0% tax) + BVI/Cayman (token issuance). Standard crypto structure.</p>
          </div>

          {/* Georgia Info */}
          <div className="mt-4 p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
            <div className="font-semibold text-sm mb-2">🇬🇪 Why Georgia (Country)?</div>
            <div className="grid grid-cols-4 gap-2 text-xs text-center">
              <div><div className="font-bold text-primary">0%</div>Corporate tax</div>
              <div><div className="font-bold text-primary">1-2 days</div>Registration</div>
              <div><div className="font-bold text-primary">VZP</div>Crypto-friendly</div>
              <div><div className="font-bold text-primary">Web3 Hub</div>Growing</div>
            </div>
          </div>
        </Section>

        {/* Roadmap */}
        <Section title="🗺️ ROADMAP 2026-2027" color="cyan">
          <div className="space-y-2 text-sm">
            <RoadmapItem quarter="Q1 2026" items={["Seed close", "Georgian LLC", "Team expansion"]} />
            <RoadmapItem quarter="Q2 2026" items={["Security audit", "USYC institutional tier", "Arc mainnet prep"]} />
            <RoadmapItem quarter="Q3 2026" items={["MAINNET LAUNCH 🚀", "Target $1-5M TVL"]} highlight />
            <RoadmapItem quarter="Q4 2026" items={["Growth push", "Target $5-15M TVL", "Token legal prep"]} />
            <RoadmapItem quarter="2027" items={["Multi-chain (Base, Arbitrum)", "$50-100M TVL", "TOKEN LAUNCH (TGE) 🎯"]} />
          </div>
        </Section>

        {/* 10 Talking Points */}
        <Section title="🔑 10 TALKING POINTS (запомнить!)" color="primary">
          <ol className="space-y-2 text-sm">
            {[
              { point: '"Real yield, real T-Bills"', desc: 'not DeFi ponzinomics' },
              { point: '"Circle\'s own blockchain"', desc: 'strategic positioning' },
              { point: '"Working product TODAY"', desc: 'not just an idea' },
              { point: '"Conservative valuation"', desc: '$5-6M FDV, 20-40x upside' },
              { point: '"Audit is priority #1"', desc: 'security first' },
              { point: '"Georgia = legitimate & efficient"', desc: 'not offshore hiding' },
              { point: '"Full stack DeFi"', desc: 'vault + bridge + swap + points' },
              { point: '"Organic traction"', desc: '1,269 txns, $31M, 162 wallets — $0 spend' },
              { point: '"Circle Ventures watching us"', desc: '"too early" but "keeping close eye"' },
              { point: '"Full transparency"', desc: 'monthly reports, quarterly calls' },
            ].map((item, i) => (
              <li key={i} className="flex gap-3 items-start">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-bold">
                  {i + 1}
                </span>
                <div>
                  <span className="font-semibold text-primary">{item.point}</span>
                  <span className="text-muted-foreground"> — {item.desc}</span>
                </div>
              </li>
            ))}
          </ol>
        </Section>

        {/* Objections - Expanded */}
        <Section title="❓ IF THEY ASK... (Objections)" color="orange">
          <div className="space-y-3">
            <Objection q='"The team is small"' answer="Two people built a complete DeFi product — treasury vault, bridge, swap, points system, NFT badges — all working on testnet. That's not small team problems, that's <strong>exceptional execution</strong>. With funding, we'll expand strategically: director, accountant, 2 more developers. Many successful DeFi protocols started with 2-3 person teams (Uniswap, Compound early days)." />
            <Objection q='"Arc is unproven"' answer="That's exactly the opportunity. Arc is Circle's strategic bet — they're not going to abandon their own L1. Being early means <strong>first mover advantage</strong> and potential Circle ecosystem support. Low competition now vs. Ethereum where it's saturated." />
            <Objection q='"No audit yet"' answer="Correct — that's our <strong>#1 use of funds</strong>. We're not launching mainnet without a proper audit. We've been conservative and transparent about this. $150K allocated for multiple audits + bug bounty." />
            <Objection q='"$5-6M FDV seems high for seed"' answer="It's actually <strong>conservative</strong> for DeFi seed rounds. Ondo raised at $20M+, Mountain at higher. We're pricing for early believers who want meaningful upside. At $100M TVL and $2M revenue, $5-6M seed valuation gives <strong>20-40x potential</strong>." />
            <Objection q='"What if yield rates drop?"' answer="T-Bill yields are set by the Fed. Even if rates drop to 2%, that's still better than 0% on idle USDC. And we have <strong>multiple revenue streams</strong> — bridge and swap fees don't depend on yield rates." />
            <Objection q='"Why Georgia?"' answer="Crypto-friendly, tax-efficient (0% on retained), fast setup (1-2 days), low costs. It's becoming a Web3 hub. We're not trying to hide — we want a <strong>legitimate, compliant structure</strong>. Georgia offers that without excessive bureaucracy." />
          </div>
        </Section>

        {/* Questions for Kayla */}
        <Section title="🤝 QUESTIONS FOR KAYLA" color="blue">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold mb-2 text-sm">About Hivemind:</h4>
              <ol className="space-y-1 text-sm list-decimal list-inside text-muted-foreground">
                <li>What's Hivemind's typical check size for seed?</li>
                <li>Do you lead rounds or prefer to co-invest?</li>
                <li>What's your investment timeline to term sheet?</li>
                <li>What portfolio companies in DeFi/yield space?</li>
              </ol>
            </div>
            <div>
              <h4 className="font-semibold mb-2 text-sm">About Us:</h4>
              <ol className="space-y-1 text-sm list-decimal list-inside text-muted-foreground" start={5}>
                <li>What would you need to see to move forward?</li>
                <li>What concerns do you have about Arc Treasury?</li>
                <li>Do you have relationships at Circle?</li>
                <li>What metrics do you prioritize for DeFi?</li>
              </ol>
            </div>
          </div>
        </Section>

        {/* Investor Transparency */}
        <Section title="🔒 INVESTOR TRANSPARENCY (mention!)" color="green">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
            <div className="p-2 rounded-lg bg-green-500/10">✓ Monthly financial reports</div>
            <div className="p-2 rounded-lg bg-green-500/10">✓ Quarterly investor calls</div>
            <div className="p-2 rounded-lg bg-green-500/10">✓ Real-time TVL dashboard</div>
            <div className="p-2 rounded-lg bg-green-500/10">✓ On-chain transaction tracking</div>
            <div className="p-2 rounded-lg bg-green-500/10">✓ Open communication channel</div>
            <div className="p-2 rounded-lg bg-green-500/10">✓ Full audit disclosure</div>
          </div>
        </Section>

        {/* Circle Quote */}
        <div className="my-8 p-4 rounded-xl bg-blue-500/10 border border-blue-500/30">
          <p className="italic text-foreground/90 mb-2 text-lg">
            "The project is too early for direct investment from our side but we'll keep a very close eye out as you continue to scale."
          </p>
          <p className="text-primary font-medium">
            — David Shamash, Circle Ventures (Dec 2025)
          </p>
        </div>

        {/* Competitive Edge */}
        <Section title="⚔️ COMPETITIVE ADVANTAGE" color="red">
          <div className="grid md:grid-cols-2 gap-3 text-sm">
            <div className="p-3 rounded-lg bg-muted/30">
              <strong>vs Ondo ($600M TVL):</strong> Arc-native, lower fees, gamified UX
            </div>
            <div className="p-3 rounded-lg bg-muted/30">
              <strong>vs Mountain Protocol:</strong> Native CCTP, no 3rd-party infra
            </div>
            <div className="p-3 rounded-lg bg-muted/30">
              <strong>vs Aave/Compound:</strong> Stable T-Bill yield vs variable
            </div>
            <div className="p-3 rounded-lg bg-muted/30">
              <strong>Our Moat:</strong> First in Arc = preferred Circle partner
            </div>
          </div>
        </Section>

        {/* Links */}
        <Section title="🔗 LINKS" color="gray">
          <div className="flex flex-wrap gap-4 text-sm">
            <a href="https://arctreasury.biz" target="_blank" rel="noopener noreferrer"
               className="px-4 py-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
              🌐 arctreasury.biz
            </a>
            <a href="https://arctreasury.biz/pitch/investor-seed-2025" target="_blank" rel="noopener noreferrer"
               className="px-4 py-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
              📊 Pitch Deck
            </a>
            <a href="https://x.com/arctreasury" target="_blank" rel="noopener noreferrer"
               className="px-4 py-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
              🐦 @arctreasury
            </a>
            <a href="https://x.com/claimpilot" target="_blank" rel="noopener noreferrer"
               className="px-4 py-2 rounded-lg bg-muted/30 text-muted-foreground hover:bg-muted/50 transition-colors">
              Anton: @claimpilot
            </a>
            <a href="https://x.com/Robsvr" target="_blank" rel="noopener noreferrer"
               className="px-4 py-2 rounded-lg bg-muted/30 text-muted-foreground hover:bg-muted/50 transition-colors">
              Robert: @Robsvr
            </a>
          </div>
        </Section>

        {/* Footer */}
        <div className="text-center text-muted-foreground text-sm mt-12 pb-8">
          <p className="text-2xl mb-2">🚀</p>
          <p>Good luck with the call!</p>
        </div>
      </div>
    </div>
  );
};

// Components
const Section = ({ title, color, children }: { title: string; color: string; children: React.ReactNode }) => (
  <div className="mb-8">
    <h2 className="text-lg font-bold mb-4 pb-2 border-b border-border/50">
      {title}
    </h2>
    {children}
  </div>
);

const TimeBlock = ({ time, label }: { time: string; label: string }) => (
  <div className="p-2 rounded-lg bg-muted/30 text-center">
    <div className="text-xs text-muted-foreground">{time}</div>
    <div className="text-sm font-medium">{label}</div>
  </div>
);

const ScriptBlock = ({ title, content, highlight }: { title: string; content: string; highlight?: boolean }) => (
  <div className={`p-4 rounded-lg ${highlight ? 'bg-primary/10 border border-primary/30' : 'bg-muted/30'}`}>
    <div className="font-semibold text-sm text-primary mb-2">{title}</div>
    <div className="text-sm text-foreground/90 leading-relaxed" dangerouslySetInnerHTML={{ __html: content }} />
  </div>
);

const TeamCard = ({ name, role, twitter, points }: { name: string; role: string; twitter: string; points: string[] }) => (
  <div className="p-4 rounded-xl bg-muted/20 border border-border/30">
    <div className="flex justify-between items-start mb-2">
      <div>
        <h4 className="text-lg font-bold text-primary">{name}</h4>
        <p className="text-sm text-muted-foreground">{role}</p>
      </div>
      <span className="text-xs text-muted-foreground">{twitter}</span>
    </div>
    <ul className="space-y-1 text-sm">
      {points.map((p, i) => <li key={i} className="text-foreground/80">• {p}</li>)}
    </ul>
  </div>
);

const InfoCard = ({ title, emoji, color, children }: { title: string; emoji: string; color: string; children: React.ReactNode }) => (
  <div className={`p-4 rounded-xl bg-${color}-500/10 border border-${color}-500/30`}>
    <h3 className="font-semibold mb-3">{emoji} {title}</h3>
    {children}
  </div>
);

const FundBox = ({ label, amount, percent }: { label: string; amount: string; percent: number }) => (
  <div className="p-3 rounded-lg bg-muted/30 text-center">
    <div className="text-xs text-muted-foreground">{label}</div>
    <div className="font-bold">{amount}</div>
    <div className="text-xs text-primary">{percent}%</div>
  </div>
);

const RoadmapItem = ({ quarter, items, highlight }: { quarter: string; items: string[]; highlight?: boolean }) => (
  <div className={`flex gap-4 p-3 rounded-lg ${highlight ? 'bg-primary/10 border border-primary/30' : 'bg-muted/20'}`}>
    <div className={`font-bold ${highlight ? 'text-primary' : 'text-muted-foreground'} w-20 flex-shrink-0`}>{quarter}</div>
    <div className="flex-1">
      {items.map((item, i) => (
        <span key={i}>
          {item}
          {i < items.length - 1 && <span className="text-muted-foreground"> • </span>}
        </span>
      ))}
    </div>
  </div>
);

const Objection = ({ q, answer }: { q: string; answer: string }) => (
  <details className="group bg-muted/20 rounded-lg">
    <summary className="cursor-pointer p-3 font-medium text-orange-400 hover:text-orange-300 transition-colors">
      {q}
    </summary>
    <div className="px-4 pb-4 text-sm text-muted-foreground" dangerouslySetInnerHTML={{ __html: answer }} />
  </details>
);

export default CallCheatSheet;
