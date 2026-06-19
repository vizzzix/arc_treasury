# Circle 2026 Cohort 2 — Grant Application Draft

---

## Applicant Details

| Field | Value |
|-------|-------|
| **Primary contact first name** | `[ЗАПОЛНИТЬ]` |
| **Primary contact last name** | `[ЗАПОЛНИТЬ]` |
| **Email address** | vizzzix@gmail.com |
| **Company Legal Entity Name** | `[ЗАПОЛНИТЬ]` (если нет юрлица — можно "Arc Treasury") |
| **Company DBA name** | Arc Treasury |
| **Founder names, roles, bios** | `[ЗАПОЛНИТЬ — см. шаблон ниже]` |
| **Project website** | https://arctreasury.biz |
| **Project X handle** | @arctreasury |
| **Founders location** | `[Имя Фамилия]`, Founder & CEO, Olsztyn, Warmian-Masurian, Poland |
| **Business location (country)** | Poland |
| **Is business incorporated?** | No |

### Founder Bio Template

> **[Имя Фамилия]**, Founder & CEO
>
> Full-stack blockchain developer with experience building DeFi protocols and smart contracts. Built Arc Treasury from concept to working testnet product as a solo founder — designing and implementing the full stack including Solidity contracts (UUPS proxy vault with 14 upgrades), React frontend, Vercel serverless backend, and Circle wallet integrations. Background in [ЗАПОЛНИТЬ: предыдущий опыт, образование, лет в индустрии].

---

## Project Abstract

**Project Name:** Arc Treasury

**One-liner (max 200 chars):**
> A yield vault on Arc Network that converts USDC/EURC deposits into USYC (tokenized US Treasury Bills), with integrated AMM swap pool and cross-chain CCTP bridge.

---

### What problem are you solving and why is it important?

Stablecoin holders face a dilemma: holding USDC/EURC earns zero yield, while accessing institutional-grade treasury yields requires complex DeFi interactions, multiple protocols, and significant technical knowledge. Meanwhile, Arc Network — Circle's own L1 blockchain — lacks native DeFi infrastructure for users to put their stablecoins to work.

This is critical because:
- **$140B+ in USDC** sits idle across chains earning nothing for holders
- Arc Network, despite being purpose-built for stablecoins, has minimal DeFi applications in its early stage
- Traditional treasury bill yields (4-5% APY) remain inaccessible to most crypto users without centralized intermediaries
- Users bridging to Arc have no incentive to keep assets on-chain without productive use cases

### What is your solution to that problem?

Arc Treasury provides a one-click yield vault that automatically converts USDC/EURC deposits into USYC (Hashnote's tokenized US Treasury fund), delivering ~4.2% net APY backed by real US government securities. The platform combines three core products:

1. **Yield Vault** — Deposit USDC or EURC, earn treasury-backed yield with flexible or locked positions (1/3/12 months). Smart contract handles USYC conversion via Hashnote Teller, oracle-based pricing, and automated yield accrual. 5% platform fee, 95% goes to users.

2. **USDC/EURC Swap Pool** — AMM with 0.2% fee for instant stablecoin conversion, with LP positions earning points. Provides essential liquidity infrastructure for Arc.

3. **Cross-Chain Bridge** — CCTP V2 integration enabling seamless transfers between Ethereum Sepolia ↔ Arc and Solana Devnet ↔ Arc, for both MetaMask and custodial Circle Wallet users.

Key differentiator: **dual wallet architecture** — users can access all features either through MetaMask (self-custody) or through Circle's Programmable Wallets with Google OAuth login (zero-friction onboarding, no seed phrases).

### Why hasn't this problem been solved yet?

- **Arc is a new chain** — launched recently as Circle's dedicated L1 for stablecoins. The DeFi ecosystem is nascent, giving early builders a unique opportunity
- **USYC integration complexity** — connecting to Hashnote's Teller contract requires understanding entitlements, oracle pricing, and proper decimal handling across tokens (USDC 18 dec on Arc vs. USYC/EURC 6 dec)
- **Dual wallet UX challenge** — supporting both MetaMask and Circle Programmable Wallets in a single DeFi interface requires careful architecture to handle server-side transaction execution alongside client-side signing
- **Regulatory clarity** — tokenized treasuries are only now becoming viable with proper regulatory frameworks, and USYC's regulated structure (BMA/CIMA oversight) makes this possible

### Why are you and your team uniquely suited to solve this problem?

`[ЗАПОЛНИТЬ — усилить личным опытом]`

As a solo founder, I've built a production-grade product over 7 months (318 commits, ~30K lines of code) that demonstrates deep integration with Circle's entire product suite:
- **14 vault contract upgrades** — iterating rapidly from basic deposits to locked positions, EURC support, dynamic fees, oracle integration, and gas-optimized deposit management
- **4 Circle products integrated** — USDC, CCTP V2, Programmable Wallets, and Gateway webhooks — all working in production-grade code, not proof-of-concept
- **Full-stack execution** — 94 frontend files, 21 API endpoints, 11 smart contracts, 18 database tables, Telegram bot, on-chain indexer, blog — all built and maintained by one developer
- **First mover on Arc** — building actively on Arc Testnet since November 2025, with intimate knowledge of the chain's architecture (native USDC as gas, 18 decimal precision, USYC/Hashnote integration)

---

## Product Alignment Track

| Question | Answer |
|----------|--------|
| **Is your project currently live in production?** | Yes — live on Arc Testnet at https://arctreasury.biz since November 2025 with fully functional vault, swap, bridge, and wallet system. 7 months of continuous development (318 commits). Preparing for mainnet launch. |
| **Are you live on Arc?** | Yes — all smart contracts deployed and operational on Arc Testnet (chain ID 5042002) |
| **Other chains currently live on** | Ethereum Sepolia (CCTP bridge endpoint), Solana Devnet (Circle Bridge Kit integration) |

### Deployed Smart Contract Addresses (Arc Testnet, Chain ID 5042002)

| Contract | Address | Description |
|----------|---------|-------------|
| TreasuryVault (UUPS Proxy) | `0x17ca5232415430bC57F646A72fD15634807bF729` | Yield vault — current impl V14 |
| StablecoinSwapV2 | `0x3a5964ce5cd8b09e55af9323a894e78bdd7f04bf` | USDC/EURC AMM pool, 0.2% fee |
| EURC (SwapEURC) | `0x742b2d045d430fe718b57046645ba33295914b69` | Mintable EURC for swap pool, 6 dec |
| USYC | `0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C` | Hashnote yield token, 6 dec |
| USYCOracle | `0xfe51166b831cd55737a1e1231a811ada0d7b3378` | USYC price oracle |
| EarlySupporterBadge | `0xb26a5b1d783646a7236ca956f2e954e002bf8d13` | NFT badge, 1.2x points multiplier |
| Entitlements | `0xcc205224862c7641930c87679e98999d23c26113` | USYC allowlist manager |
| USYC Teller | `0x9fdF14c5B14173D74C08Af27AebFf39240dC105A` | USDC ↔ USYC conversion |
| USDC (native) | `0x3600000000000000000000000000000000000000` | Native gas token, 18 dec |

**CCTP V2 Contracts (same addresses on both chains):**

| Contract | Address | Notes |
|----------|---------|-------|
| TokenMessenger | `0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA` | Sepolia domain=0, Arc domain=26 |
| MessageTransmitter | `0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275` | — |
| USDC (Sepolia) | `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` | 6 dec |

**Explorer:** https://testnet.arcscan.app

### Other Chains Currently Live On

- **Ethereum Sepolia** — CCTP V2 bridge endpoint (burn/mint USDC between Sepolia ↔ Arc)
- **Solana Devnet** — Bridge via Circle Bridge Kit SDK (BridgeSolana page)

### Circle Products Currently Integrated

- [x] **USDC** — Native gas token on Arc (18 dec), core of vault deposits/withdrawals, swap pool, and bridge operations
- [x] **CCTP** — V2 cross-chain bridge: Sepolia ↔ Arc (domain 0 ↔ 26) via TokenMessenger + MessageTransmitter contracts + Circle Attestation API
- [x] **Programmable Wallets** — Developer Controlled Wallets with Google OAuth / Email OTP login. Two wallets per user (Sepolia + Arc, same EOA). All vault/swap/bridge operations supported server-side via Circle contractExecution API
- [x] **Circle Gateway** — Webhook subscriptions for bridge deposit/mint notifications (gateway.deposit.finalized, gateway.mint.finalized)

### Circle Products Planned for Integration

- [ ] **Circle Mint** — For institutional on/off-ramp when moving to mainnet
- [ ] **EURC** — Already integrated via custom SwapEURC contract; plan to use Circle's official EURC on Arc mainnet
- [ ] **Smart Contract Platform** — Expand Programmable Wallets capabilities for automated yield strategies

---

## Milestones and Timelines

### Milestone 1: Security Audit & Mainnet Preparation (Month 1-2)

**Details:**
- Complete professional smart contract audit of TreasuryVaultV14 and StablecoinSwapV2
- Obtain USYC whitelist/entitlements for mainnet Hashnote Teller
- Deploy all contracts to Arc Mainnet
- Migrate from testnet EURC to official Circle EURC
- End-to-end testing on mainnet with real assets
- **Deliverable:** Audited contracts live on Arc Mainnet, functional vault accepting real USDC deposits

### Milestone 2: Production Launch & Circle Wallet Onboarding (Month 2-3)

**Details:**
- Launch production environment with mainnet contracts
- Enable Circle Programmable Wallet sign-ups (Google OAuth + Email OTP) on mainnet
- Integrate CCTP V2 mainnet bridge (Ethereum ↔ Arc)
- Implement Circle Gateway webhooks for real-time bridge monitoring
- Marketing launch: Twitter campaign, referral system activation, community building
- **Deliverable:** Public launch with dual wallet support (MetaMask + Circle), live CCTP bridge, target $1M TVL

### Milestone 3: Growth & Advanced Strategies (Month 3-6)

**Details:**
- Add multi-strategy yield options (Aave, Pendle integration when available on Arc)
- Implement advanced LP strategies for USDC/EURC pool
- Expand bridge to additional chains via CCTP (Solana mainnet, Polygon, Arbitrum)
- Launch governance points → token conversion program
- Institutional onboarding via Circle Mint integration
- **Deliverable:** $5-10M TVL, 500+ active users, multi-chain bridge operational

---

## Project Traction and Roadmap

### Current Traction

**Development (since November 2025 — 7 months of active building):**
- **318 commits** across 7 months of continuous development
- **~28,700 lines** of TypeScript/React code + **~1,900 lines** of Solidity
- **167 source files**: 94 frontend (React), 21 API endpoints, 11 smart contracts (5 interfaces), 28 UI components, 12 pages, 21 custom hooks, 2 bots, 8 blog files, 3 indexer files
- **18 Supabase tables** powering real-time data layer
- **Peak activity:** 154 commits in December 2025 (initial build), 103 commits in February 2026 (Circle integrations)

**Product completeness:**
- **Fully functional testnet product** live at https://arctreasury.biz — all features operational
- **9 smart contracts** deployed on Arc Testnet (vault proxy + V14 impl, swap V2, oracle, badge, entitlements, teller, EURC)
- **14 vault contract iterations** — rapid development cycle from basic deposits → locked positions → EURC support → dynamic fees → oracle integration → gas-optimized storage
- **4 Circle products integrated:** USDC, CCTP V2, Programmable Wallets, Gateway webhooks
- **Dual wallet system** working end-to-end: MetaMask (self-custody) + Circle Wallets (Google OAuth / Email OTP)
- **Complete feature set:** yield vault (flexible + locked 1/3/12mo), AMM swap pool (USDC/EURC), CCTP bridge (EVM + Solana), referral system (5 tiers), points/leaderboard (time-weighted), Telegram monitoring bot, blog (Next.js + MDX)
- **Infrastructure:** Supabase Realtime backend, Vercel serverless (21 API endpoints), automated monitoring bot, on-chain indexer

### Are you funded?

No — bootstrapped. This grant would be the first external funding.

### Technical Roadmap

| Timeline | Milestone | Circle Integration |
|----------|-----------|-------------------|
| **Month 1-2** | Smart contract audit + Arc Mainnet deployment | USDC mainnet, CCTP V2 mainnet, Programmable Wallets mainnet |
| **Month 2-3** | Public launch, marketing, community growth | Circle Gateway webhooks, official EURC integration |
| **Month 3-4** | Multi-strategy yield, expanded bridge | CCTP to Solana/Polygon/Arbitrum mainnet |
| **Month 4-6** | Institutional features, governance token | Circle Mint for on/off-ramp |

### How will this grant support your technical roadmap?

The grant will directly fund three critical milestones:

1. **Smart Contract Audit ($15-25K)** — Professional security audit is the primary blocker for mainnet launch. Cannot deploy a yield vault managing real assets without third-party verification.

2. **Infrastructure & Operations ($5-10K)** — Mainnet RPC nodes, Supabase Pro tier, Vercel Pro, domain/SSL, monitoring services for production-grade reliability.

3. **Growth & Marketing ($5-10K)** — Community incentives, liquidity bootstrapping, content creation, and partnership development to reach critical TVL mass on Arc.

Without this grant, mainnet launch timeline extends by 6+ months due to audit costs alone. With it, we can launch on Arc Mainnet within 8 weeks and begin driving real TVL to Circle's ecosystem.

---

## Deck and Demo

| Field | Value |
|-------|-------|
| **Video demo** | `[НУЖНО ЗАПИСАТЬ — см. требования ниже]` |
| **Investor deck** | `[НУЖНО ПОДГОТОВИТЬ]` |

### Video Demo Requirements Checklist

The video (max 5 min) must include:

- [ ] **Codebase walkthrough:** Show Circle integration code
  - `src/providers/CircleWalletProvider.tsx` — Circle Wallet OAuth flow
  - `api/vault.ts` — Circle contractExecution API calls
  - `api/bridge.ts` — CCTP V2 via Circle SDK
  - `src/hooks/useBridgeCCTP.ts` — Client-side CCTP with wagmi/viem
  - `api/gateway-webhook.ts` — Circle Gateway webhooks
  - `contracts/contracts/TreasuryVaultV14.sol` — Vault smart contract
  - `src/lib/constants.ts` — All contract addresses and CCTP config

- [ ] **Integration demo:** Show user flows
  - Google OAuth login → Circle Wallet creation
  - Deposit USDC into vault (both MetaMask and Circle Wallet)
  - Swap USDC → EURC via AMM pool
  - Bridge USDC from Sepolia to Arc via CCTP
  - Points/leaderboard system
  - Transaction history with real-time updates

---

## Additional Questions (Circle Follow-up)

### Public Analytics Dashboard

No public Dune dashboard yet — Arc Testnet is not indexed by Dune. On-chain activity can be verified directly via Arc Testnet Explorer:

- **Vault contract:** https://testnet.arcscan.app/address/0x17ca5232415430bC57F646A72fD15634807bF729
- **Swap contract:** https://testnet.arcscan.app/address/0x3a5964ce5cd8b09e55af9323a894e78bdd7f04bf
- **Badge NFT:** https://testnet.arcscan.app/address/0xb26a5b1d783646a7236ca956f2e954e002bf8d13

Internal analytics are tracked via Supabase (18 tables): transaction history, bridge feed, swap events, liquidity events, user points, balance snapshots. A public-facing analytics dashboard is on the roadmap for post-mainnet launch.

### Circle Developer Console Email

vizzzix@gmail.com (Admin/owner, active since November 11, 2025)

### Circle Products — Current & Planned Integration

**Currently Integrated (live on testnet, verified in codebase):**

| Product | Status | Implementation |
|---------|--------|---------------|
| **USDC** | Live | Native gas token on Arc (18 dec). Used in vault deposits/withdrawals, swap pool, bridge, all transaction types |
| **CCTP V2** | Live | Cross-chain bridge Sepolia ↔ Arc (domains 0 ↔ 26). TokenMessenger + MessageTransmitter + Circle Attestation API (`iris-api-sandbox.circle.com`) |
| **Programmable Wallets** | Live | Developer Controlled Wallets via Circle API. Google OAuth + Email OTP login. Two wallets per user (Sepolia + Arc, same EOA). Server-side `contractExecution` for all vault/swap/bridge operations |
| **Circle Gateway** | Live | Webhook subscriptions for bridge notifications (`gateway.deposit.finalized`, `gateway.mint.finalized`). Endpoint: `api/gateway-webhook.ts` |
| **EURC** | Live | Custom testnet EURC (SwapEURC) for USDC/EURC AMM pool. Plan to migrate to official Circle EURC on mainnet |

**Planned Integration (post-grant):**

| Product | Timeline | Purpose |
|---------|----------|---------|
| **Circle Mint** | Month 3-4 | Institutional USDC on/off-ramp for mainnet users |
| **CCTP Mainnet (multi-chain)** | Month 3-6 | Expand bridge to Ethereum, Solana, Polygon, Arbitrum mainnets |
| **Official EURC (Arc Mainnet)** | Month 1-2 | Replace testnet SwapEURC with Circle's official EURC |
| **Compliance Engine** | Month 4-6 | KYC/AML for institutional vault deposits |

---

## Conflict of Interest

**No** — No actual, potential, or perceived conflict of interest with Circle or its subsidiaries. No financial, business, advisory, family, or personal relationships with Circle employees, officers, directors, or contractors.

---

## Notes

### Fields requiring your input: `[ЗАПОЛНИТЬ]`
1. First name, last name
2. Company Legal Entity Name (or write "Arc Treasury" if no legal entity)
3. Founder bio — your background, years of experience, education
4. Your location: City, Country
5. Business location country
6. Усилить секцию "Why are you uniquely suited" личным опытом

### Materials to prepare:
1. **Video demo** (max 5 min) — codebase walkthrough + live product demo
2. **Investor deck** — можно сделать на основе Litepaper + roadmap из этого документа
