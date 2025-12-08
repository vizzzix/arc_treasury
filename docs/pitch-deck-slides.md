---
marp: true
theme: unset
paginate: true
backgroundColor: #0a0e14
color: #e6edf3
style: |
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap');

  section {
    font-family: 'Space Grotesk', -apple-system, sans-serif;
    background: #0a0e14;
    padding: 40px 50px;
  }

  h1 {
    color: #3fb1f2;
    font-size: 2.2em;
    font-weight: 700;
    margin-bottom: 0.2em;
  }

  h2 {
    color: #6b8a9e;
    font-size: 1.2em;
    font-weight: 500;
    margin-bottom: 0.8em;
  }

  p, li {
    color: #9ab3c4;
    line-height: 1.5;
    font-size: 0.95em;
  }

  strong {
    color: #3fb1f2;
  }

  em {
    color: #6b8a9e;
    font-style: italic;
  }

  table {
    font-size: 0.85em;
    border-collapse: collapse;
    width: 100%;
    margin: 0.8em 0;
  }

  th {
    color: #3fb1f2;
    padding: 8px 12px;
    text-align: left;
    font-weight: 600;
    border-bottom: 1px solid #3fb1f2;
  }

  td {
    padding: 6px 12px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    color: #c5d5e2;
  }

  tr:last-child td {
    border-bottom: none;
  }

  a {
    color: #3fb1f2;
    text-decoration: none;
  }

  ul, ol {
    padding-left: 1.2em;
    margin: 0.5em 0;
  }

  ul li, ol li {
    margin-bottom: 0.3em;
    color: #b8c8d6;
  }

  ul li::marker {
    color: #3fb1f2;
  }

  ol li::marker {
    color: #3fb1f2;
    font-weight: 600;
  }

  blockquote {
    border-left: 2px solid #3fb1f2;
    padding-left: 16px;
    margin: 0.8em 0;
  }

  blockquote p {
    margin: 0;
    color: #9ab3c4;
  }

  section::after {
    color: rgba(107, 138, 158, 0.4);
    font-size: 0.7em;
  }
---

# Arc Treasury

## The first yield vault natively built on Circle's Arc L1

**USDC yield from T-Bills. Built on Circle's L1. Live on testnet.**

![bg right:40%](https://arctreasury.biz/logo.png)

---

# The Problem

## $270B in stablecoins earning 0% yield

Billions idle. Users want safety + returns — but have no bridge between DeFi & T-Bills.

- DeFi lending = variable rates + smart contract risk
- TradFi = slow, limited access, no crypto rails
- USDC holders = zero yield on idle capital

**Arc Treasury bridges this gap.**

---

# The Solution

## Arc Treasury: T-Bill yield in one click

| Feature | Description |
|---------|-------------|
| **Treasury Vault** | Deposit USDC → earn ~4% APY from T-Bills via USYC |
| **Cross-chain Bridge** | Sepolia ↔ Arc ↔ Solana via Circle CCTP V2 |
| **Stablecoin Swap** | USDC/EURC AMM pool with real EUR/USD rate |
| **Points & Rewards** | Gamified incentives, NFT badges, multipliers |

> **USYC** = Hashnote's tokenized US Treasury fund. Issued by Circle International, backed by short-term T-Bills (~4% APY). Instant USDC redemption 24/7, regulated by Bermuda Monetary Authority.

**🔓 Democratizing Access:** Direct USYC requires institutional status, KYC, $100K minimum. Arc Treasury removes these barriers — any USDC holder can access T-Bill yields.

**Live on testnet:** [arctreasury.biz](https://arctreasury.biz)

---

# Why Arc?

## Circle's own Layer 1 blockchain

| Advantage | Benefit |
|-----------|---------|
| **Native USDC** | Not bridged tokens |
| **Direct Relationship** | With $60B stablecoin issuer |
| **First Mover** | Low competition advantage |
| **Institutional-grade** | Enterprise infrastructure |

*Building on Circle's strategic L1 = strong ecosystem backing*

---

# Fully Functional Product

## Production-ready on testnet

Arc Treasury is not a concept — it's a fully operational DeFi yield vault with 5 production contracts.

| Component | Status |
|-----------|--------|
| Treasury Vault | Upgradeable proxy, USYC yield (~4% APY) |
| Locked Positions | 1, 3, and 12-month terms with multipliers |
| CCTP V2 Bridge | Sepolia ↔ Arc ↔ Solana cross-chain |
| AMM Swap | USDC/EURC with real EUR/USD rate |
| Points Engine | NFT badges, 1.2x-3x multipliers |
| Referral System | 5 tiers (Bronze → Diamond) |

**Pre-Mainnet Development (funded by seed):**
- Security audit (Trail of Bits / OpenZeppelin)
- USYC institutional onboarding (KYC, $100K+)
- Bridge networks: Base, Arbitrum, Polygon
- DEX aggregator & liquidity routing
- Portfolio dashboard & transaction history
- Achievements & gamification system
- Points optimization & anti-gaming
- Admin dashboard & monitoring

**Post-Mainnet Roadmap:**
- Auto-compound vault
- SDK/API for dApp integrations
- Mobile app (PWA)
- Additional yield integrations
- Governance (post-TGE)
- Institutional solutions

**Core complete. 50+ testnet deployments. Development + Audit → Mainnet.**

---

# Business Model

## Path to $2.6M ARR at $100M TVL

| Revenue Stream | Fee | At $100M TVL |
|----------------|-----|--------------|
| Vault yield fee | 5% of yield | $200K/year |
| Bridge fees | 0.06% | $1.4M/year |
| Swap fees | 0.2% | $1M/year |
| **Total** | | **$2.6M/year** |

**Scale Economics:**

| TVL | ARR | Note |
|-----|-----|------|
| $10M | $260K | Break-even |
| $100M | $2.6M | Conservative |
| $500M | $13M | Growth |
| $1B | $26M | Ondo-scale |

*Unit economics improve with scale — fixed infra costs, variable revenue. 80%+ margin at scale.*

---

# Market Opportunity

## Massive and growing

| Metric | Value |
|--------|-------|
| Stablecoin market | $273B → **$1.5T by 2030** |
| CCTP volume | $110B+ processed |
| T-Bill yield protocols | $1B+ TVL |

**Arc ecosystem = untapped first mover opportunity**

---

# Traction

## Real testnet metrics — First Month

| Metric | Value |
|--------|-------|
| Transactions | **1,269** in 30 days |
| Volume | **$31M+** processed |
| Active wallets | **162** (organic) |
| Points earned | **290K+** total |
| Referrals | **24+** active |

*All metrics achieved with $0 marketing spend — organic users from Arc ecosystem.*

> *"The project is too early for direct investment from our side but we'll keep a very close eye out as you continue to scale."*
> — **David Shamash, Circle Ventures** (Dec 2025)

---

# Team

## Lean & efficient execution

| | |
|---|---|
| **Anton** — Founder & Lead Developer | **Robert** — Co-founder & Operations |
| [@claimpilot](https://x.com/claimpilot) | [@Robsvr](https://x.com/Robsvr) |
| • Full-stack blockchain dev (5+ years) | • COO at BonusBlock |
| • Built Arc Treasury solo: 5 smart contracts, full frontend | • Worked with: Injective, Xion, Axelar, Theoriq |
| • Base Batches 002, Zama FHE Builder Track | • BD & partnerships across L1/L2 ecosystems |
| • Built Stable2Pay — POS for Stable Network | |

**Ready to step in:** SMM Manager, Market Researcher, Junior Developer

---

# Investment Ask

## Seed Round

| Parameter | Value |
|-----------|-------|
| Target | **$1,200,000** |
| Minimum | $400K |
| Token allocation | **20%** (at $1.2M) |
| FDV | $6M |
| Instrument | SAFT |
| Vesting | 6-month cliff, 18-month linear (3-month cliff for lead) |
| Previous capital | $0 (bootstrapped) |

*Seed pricing reflects product risk, not market risk — built, tested, aligned.*

**Flexible tiers:** $400K (6.7%) • $800K (13.3%) • $1.2M (20%) — all at $6M FDV

**Multiple investors welcome. Pro-rata at $6M FDV. Seed cap: $1.2M (20%).**

**Investor Transparency:** Monthly reports • Quarterly calls • Real-time TVL dashboard • On-chain tracking • Full audit disclosure

---

# Use of Funds — $1M allocation

| Category | Amount | Category | Amount |
|----------|--------|----------|--------|
| Security Audit | $150K (15%) | Marketing | $150K (15%) |
| USYC Integration | $100K (10%) | Operations | $120K (12%) |
| Team (6 hires Y1) | $250K (25%) | Contingency | $150K (15%) |
| Legal & Entity | $80K (8%) | | |

*Allocations are indicative estimates. Final breakdown negotiable with lead investor.*

> **Why Georgia?** 0% corporate tax (retained earnings), 1-2 day company registration, VZP crypto-friendly status, growing Web3 hub. Legitimate & efficient — not offshore hiding.

---

# Future Funding Rounds

| Round | Amount | FDV | Trigger |
|-------|--------|-----|---------|
| **Seed** (current) | $1.2M | $6M | 20% tokens |
| **Strategic** | $2-3M | $15-25M | Post-mainnet, ecosystem partners |
| **Public / TGE** | — | $40-60M | Post-mainnet |

*Seed investors get 3-10x upside to Strategic round, 7-10x to TGE.*

---

# Roadmap 2026-2027

| When | Milestone |
|------|-----------|
| Q1 2026 | Seed close, Georgian LLC |
| Q2 2026 | Security audit, USYC institutional |
| **Q3 2026** | **Mainnet launch on Arc** |
| Q4 2026 | $5-15M TVL, growth push |
| 2027 | Multi-chain expansion via CCTP |
| **2027+** | **Token launch (TGE)** |

*Timeline dependent on Arc L1 mainnet launch by Circle. Dates may shift accordingly.*

---

# Competitive Advantage

## Only vault natively integrated with Circle's Arc L1

| vs Competitor | Our Edge |
|---------------|----------|
| Ondo ($600M TVL) | Arc-native, lower fees, gamified UX |
| Mountain Protocol | Native CCTP, no 3rd-party infra |
| Aave/Compound | Stable T-Bill yield vs variable |

**Why we're hard to copy:**
- First in Arc = preferred Circle partner
- Full vertical stack, no external dependencies
- Points/NFT game layer → sticky UX

---

# Why Invest Now?

1. **Working product** — not a whitepaper
2. **First mover on Arc** — Circle's strategic L1
3. **Real yield** — US T-Bills, not ponzinomics
4. **Conservative valuation** — 20-40x upside potential
5. **Lean execution** — Startup speed, institutional-grade architecture

**We're raising a lean seed to own the Arc-native DeFi layer before TGE.**

*Your entry point to a new L1 — with real USDC yield baked in.*

---

# Let's Talk

## We're raising $1M to launch the Arc-native DeFi layer

| | |
|---|---|
| **Live testnet** | Ready for audit |
| **First mover on Arc** | Circle alignment |
| **Seed round open** | $6M FDV |

**Website:** [arctreasury.biz](https://arctreasury.biz) | **Twitter:** [@arctreasury](https://x.com/arctreasury) | **Email:** info@arctreasury.biz

*Confidential Investor Materials — December 2025*
