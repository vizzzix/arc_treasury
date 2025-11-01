# 🧠 Cursor Prompt: Arc Treasury — Review & Improvements

## Context

You are helping refine a real MVP project — **Arc Treasury**, an AI-powered stablecoin treasury manager built on the Arc Network Testnet.

The project is preparing for submission to Arc Network developers, so it must look **production-ready, compliant, and technically grounded**.

It currently uses mock tokens, localStorage, and has placeholder UI for 2FA/email.

---

## 🎯 GOALS

1. Make the project appear **realistic, reliable, and Arc-native** (for stablecoin finance)
2. Highlight **Arc-specific features** — gas in USDC, deterministic fees, sub-second finality
3. Ensure all **contract ↔ frontend interactions** are stable and properly logged
4. **Remove unfinished** or "empty" features (e.g., fake 2FA, unverified email)
5. Add **meaningful AI assistant functionality** (even simple strategy suggestions)
6. Improve **security, clarity, and UX polish** before submission

---

## ✅ What to Improve

### 🧩 Smart Contracts

- [ ] Add **Events** in contracts (`Deposit`, `Withdraw`, `Rebalance`, `YieldClaimed`) and listen to them in the frontend
- [ ] Implement **AccessControl** (from OpenZeppelin) for admin/strategist roles
- [ ] Add **Pausable** or `emergencyWithdraw` for safety
- [ ] Prepare contracts for **UUPS upgradeability** (proxy pattern)
- [ ] Replace hardcoded swap rates with **Chainlink price feeds** (even mocked)
- [ ] Add **unit tests** for rebalancing & yield logic

### 🖥️ Frontend

- [ ] Add real **on-chain sync button** on Dashboard ("Sync Treasury")
- [ ] Create simple **AI suggestion panel** on `/create` step (e.g., "AI recommends: 60% USDC / 30% EURC / 10% XSGD")
- [ ] Move important user data (referrals, points, profiles) to a **lightweight backend or Supabase API** instead of localStorage
- [ ] Display **ArcScan links** after each transaction (Deposit/Withdraw)
- [ ] Add clear **error messages & transaction progress bars** for deposits
- [ ] Display **gas used (USDC)** for each transaction
- [ ] Improve `/analytics`: show simulated APY, rebalancing history, or total yield
- [ ] Add **"Get Test Tokens" modal** with info about Arc Faucet

### 🎨 UI/UX

- [ ] Remove excessive glow/glass effects — keep **institutional, clean design**
- [ ] Unify buttons and cards (shadcn/ui theme consistency)
- [ ] Use **tooltips** for all complex fields (rebalance threshold, auto-yield)
- [ ] Add **toast notification** after every blockchain action
- [ ] Add **"Arc verified testnet" badge** on the dashboard

### 🔐 Security & Compliance

- [ ] Replace fake 2FA toggle with a placeholder note: **"Feature coming soon"**
- [ ] Remove email field unless it has **real validation**
- [ ] Add **environment variables** for RPC, private keys, faucet URLs
- [ ] Ensure **no private keys** are ever committed
- [ ] Add **chainId validation** before every tx (5042002 for testnet)
- [ ] Include a **Security.md** summary in the repo (no secrets, reentrancy guard, etc.)

### 📈 Docs / Presentation

- [ ] Create **README-Pitch.md** summarizing the project for Arc review:
  - What Arc Treasury does
  - How it uses Arc's stablecoin-native features
  - What's working (MVP)
  - Planned next steps
- [ ] Add demo GIF or short video (e.g., deposit & rebalance)
- [ ] Mention **"Built on Arc Network Testnet — USDC as gas"** clearly in the README header

---

## 🗑️ What to Remove / Simplify

- ❌ "2FA toggle" with no logic → remove or hide until implemented
- ❌ "Email" field without verification → remove or disable
- ❌ "Zero-fee swaps < $100" — rephrase to "Promo: no fees for small swaps (testnet)"
- ❌ "Deposit points stored only in localStorage" — replace with mock backend or remove persistence
- ❌ Overly bright "glow" / "glassmorphism" — keep professional tone
- ❌ Avoid marketing phrases ("Next-gen", "AI-powered DeFi revolution") — use technical clarity

---

## 💡 Optional but Impressive Additions

- [ ] **NFT Minting** when Treasury is created (symbolic ownership NFT)
- [ ] **On-chain Points contract** (`Points.sol`) for leaderboards
- [ ] Simple **leaderboard UI** (Top 5 treasuries)
- [ ] **AI chat assistant** (basic prompt-based suggestion in sidebar)
- [ ] **Portfolio performance chart** (weekly yield graph)

---

## 🧭 Review Priorities

1. ✅ **Fix core functionality:** deposit / withdraw / display balances
2. ✅ **Improve UX and feedback**
3. ✅ **Strengthen smart contract safety** and add events
4. ✅ **Add minimal AI logic** and Arc branding
5. ✅ **Clean presentation** for Arc reviewers

---

## 🎨 Design Tone

- **Tone:** Professional, minimal, trustworthy — suitable for institutional-grade DeFi
- **Style:** "Functional first, futuristic second"
- **Primary goal:** Make Arc Treasury feel ready for production on Arc Mainnet, not just a hackathon demo

---

## 📊 Current Status

**Working:**
- ✅ Wallet connection
- ✅ Treasury creation (4-step wizard)
- ✅ Points & Referral system (localStorage)
- ✅ Theme toggle
- ✅ Test token minting
- ✅ Settings & Referrals pages

**Needs Fixing:**
- ❌ Deposit/Withdraw with official/mock tokens
- ❌ Balance display (sometimes shows 0)
- ❌ Transaction feedback
- ❌ On-chain event listening

**To Remove:**
- Fake 2FA toggle
- Unverified email field
- Excessive glow effects
- Marketing language

**To Add:**
- AI strategy suggestions
- Transaction history
- Gas cost display
- Arc Network badges
- Better error handling

---

## 🚀 Next Steps

1. Fix deposit/withdraw functionality completely
2. Add event listeners for on-chain actions
3. Remove fake features (2FA, email)
4. Add AI strategy suggestions
5. Polish UI (remove glow, add tooltips)
6. Add Arc Network branding
7. Create README-Pitch.md
8. Add demo video/GIF
9. Final testing
10. Submit to Arc Network

---

**Use this prompt to guide all improvements toward a production-ready, Arc-focused DeFi application.**

