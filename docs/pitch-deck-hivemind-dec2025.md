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

## Infrastructure layer for on-chain US Treasury yield

**USDC yield from T-Bills. Built on Circle's L1. Live on testnet.**

*Prepared for Hivemind Capital — December 2025*

![bg right:40%](https://arctreasury.biz/logo.png)

---

# The Infrastructure Problem

## $270B in stablecoins with broken plumbing

Stablecoins represent the largest crypto use case, yet the infrastructure to make them productive is fragmented and inefficient.

| Current State | Problem |
|---------------|---------|
| **DeFi lending** | Variable rates, smart contract risk, complex UX |
| **TradFi rails** | Slow settlement, limited access, no crypto interop |
| **Cross-chain** | Fragmented liquidity, bridge security risks |

**Result:** Billions in idle USDC earning 0% while T-Bills yield 4%+

---

# The Solution

## Unified yield infrastructure on Circle's own L1

| Layer | Function | Tech |
|-------|----------|------|
| **Yield Layer** | USDC → T-Bill yield via USYC | Hashnote integration |
| **Bridge Layer** | Cross-chain settlement | Circle CCTP V2 |
| **Liquidity Layer** | Stablecoin AMM | USDC/EURC with real EUR/USD rate |

**Single protocol. Native USDC. Institutional-grade backing.**

> **USYC** = Hashnote's tokenized US Treasury fund. Issued by Circle International, backed by short-term T-Bills (~4% APY). Instant USDC redemption 24/7.

---

# Why This Matters for Infrastructure

## Circle's Arc = new financial rails

| Arc L1 Advantage | Infrastructure Benefit |
|------------------|----------------------|
| **Native USDC issuance** | No bridge risk, direct Circle backing |
| **CCTP V2 protocol** | Atomic cross-chain, no wrapped tokens |
| **Enterprise SLA** | Institutional uptime guarantees |
| **First L1 by stablecoin issuer** | $60B USDC, $110B+ CCTP volume |

*Building core infrastructure on Circle's strategic blockchain = aligned incentives*

---

# Technical Architecture

## Production-ready stack

```
User → Arc Treasury Frontend
         ↓
    Smart Contracts (11 deployed)
         ↓
    ┌─────────────────────────────────────┐
    │  Treasury Vault  │  CCTP Bridge    │
    │  (USYC yield)    │  (cross-chain)  │
    │                  │                  │
    │  Swap Pool       │  Points Engine  │
    │  (AMM)           │  (incentives)   │
    └─────────────────────────────────────┘
         ↓
    Circle Infrastructure
    (USDC, CCTP, Arc L1)
```

**Built & Tested:** Treasury Vault (upgradeable), CCTP V2 Bridge (Sepolia ↔ Arc ↔ Solana), AMM Swap (real EUR/USD rate), Points/NFT badges (1.2x-3x multipliers), Referral system (5 tiers).

**Pre-Mainnet:** Security audit • USYC institutional onboarding • Bridge (Base, Arb, Polygon) • DEX aggregator • Portfolio dashboard • Achievements • Points optimization • Admin tools.

**Post-Mainnet:** Auto-compound • SDK/API • Mobile app (PWA) • Additional yield integrations • Governance (post-TGE) • Institutional solutions.

**Core complete. 50+ testnet deployments. Development + Audit → Mainnet.**

---

# Traction — First Month Live

## Organic adoption, zero marketing spend

| Metric | Value | Note |
|--------|-------|------|
| **Transactions** | 1,269 | 30 days |
| **Volume** | $31M+ | Testnet USDC |
| **Active wallets** | 162 | Organic only |
| **Bridge operations** | 400+ | Cross-chain |
| **Points earned** | 290K+ | User engagement |

> *"The project is too early for direct investment from our side but we'll keep a very close eye out as you continue to scale."*
> — **David Shamash, Circle Ventures** (Dec 2025)

---

# Business Model

## Infrastructure fees at scale

| Revenue Stream | Fee | At $100M TVL |
|----------------|-----|--------------|
| Yield management fee | 5% of yield | $200K/year |
| Bridge settlement fees | 0.06% | $1.4M/year |
| Swap liquidity fees | 0.2% | $1M/year |
| **Total ARR** | | **$2.6M/year** |

**Scale Economics:**
- $10M TVL → $260K ARR (break-even)
- $100M TVL → $2.6M ARR (conservative)
- $500M TVL → $13M ARR (growth)
- $1B TVL → $26M ARR (Ondo-scale)

*Unit economics improve with scale — fixed infra costs, variable revenue. 80%+ margin at scale.*

---

# Market Opportunity

## Intersection of two massive trends

| Market | Size | Growth |
|--------|------|--------|
| Stablecoins | $273B | → $1.5T by 2030 |
| Tokenized Treasuries | $1B+ TVL | Fastest growing RWA |
| CCTP volume | $110B+ | Circle's bridge |

**Arc Treasury = infrastructure play at the intersection**

*First mover on Circle's own L1 = defensible position*

---

# Competitive Landscape

## Infrastructure differentiation

| Protocol | Approach | Our Advantage |
|----------|----------|---------------|
| **Ondo** ($600M) | Multi-chain, complex | Arc-native, simpler |
| **Mountain** | Single product | Full stack |
| **Aave/Compound** | Lending | Stable T-Bill yield |

**Why hard to replicate:**
- First Arc-native = preferred ecosystem partner
- Vertical integration (yield + bridge + swap)
- Direct Circle infrastructure relationship

---

# Team

## Technical founders, execution focus

| | |
|---|---|
| **Anton** — Founder & Lead Developer | **Robert** — Co-founder & Operations |
| Full-stack blockchain (5+ years) | COO at BonusBlock |
| 5 smart contracts, full frontend — solo build | Injective, Xion, Axelar, Theoriq |
| Base Batches 002, Zama FHE Track | BD & partnerships across L1/L2 |

**Lean team. Ship fast. Technical depth.**

---

# Investment Terms

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

**Flexible tiers:** $400K (6.7%) • $800K (13.3%) • $1.2M (20%) — all at $6M FDV

**Multiple investors welcome. Pro-rata at $6M FDV. Seed cap: $1.2M (20%).**

*Infrastructure pricing — product risk, not market risk*

---

# Use of Funds

## $1M deployment

| Category | Allocation | Purpose |
|----------|------------|---------|
| Security Audit | $150K (15%) | Trail of Bits / OpenZeppelin |
| USYC Integration | $100K (10%) | Institutional onboarding |
| Engineering | $250K (25%) | 6 hires Y1 |
| Legal & Entity | $80K (8%) | Georgia LLC, compliance |
| Marketing | $150K (15%) | Developer relations |
| Operations | $120K (12%) | Infrastructure costs |
| Contingency | $150K (15%) | Buffer |

*Allocations are indicative estimates. Final breakdown negotiable with lead investor.*

---

# Future Funding Rounds

| Round | Amount | FDV | Trigger |
|-------|--------|-----|---------|
| **Seed** (current) | $1.2M | $6M | 20% tokens |
| **Strategic** | $2-3M | $15-25M | Post-mainnet, ecosystem partners |
| **Public / TGE** | — | $40-60M | Post-mainnet |

*Seed investors positioned for 3-10x upside to Strategic, 7-10x to TGE.*

---

# Roadmap

## Path to mainnet and scale

| Timeline | Milestone |
|----------|-----------|
| Q1 2026 | Seed close, entity setup |
| Q2 2026 | Security audit, USYC institutional |
| **Q3 2026** | **Mainnet launch on Arc** |
| Q4 2026 | $5-15M TVL target |
| 2027 | Multi-chain expansion via CCTP |
| **2027+** | **Token launch (TGE)** |

*Timeline dependent on Arc L1 mainnet launch by Circle. Dates may shift accordingly.*

---

# Hivemind Portfolio Fit

## Why this aligns with your thesis

| Hivemind Focus | Arc Treasury |
|----------------|--------------|
| **Payment Rails** | Critical USDC infrastructure via Circle's CCTP V2 — like RD Technologies |
| **Real World Assets** | T-Bill yields on-chain via USYC, the largest tokenized Treasury fund |
| **Crypto Infrastructure** | Foundational DeFi on Circle's institutional-grade L1 — like GFO-X, Hiro |
| **Institutional Grade** | Circle-backed yield, compliant structure, enterprise infrastructure |

**Your thesis on "institutionalizing digital assets" matches our approach.**

---

# Why Invest Now?

1. **Working infrastructure** — not a whitepaper
2. **First mover on Arc** — Circle's strategic L1
3. **Real yield source** — US T-Bills, not token inflation
4. **Conservative entry** — $6M FDV, 20-40x potential
5. **Technical team** — ship fast, deep blockchain expertise

**Early infrastructure bet on Circle's ecosystem expansion.**

---

# Let's Talk

## We're building yield infrastructure for Circle's L1

| | |
|---|---|
| **Live testnet** | arctreasury.biz |
| **Audit-ready** | Q2 2026 |
| **Seed open** | $6M FDV |

**Contact:**
- Email: info@arctreasury.biz
- Twitter: [@arctreasury](https://x.com/arctreasury)

*Confidential — Prepared for Hivemind Capital, December 2025*
