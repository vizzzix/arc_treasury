# Arc Treasury - AI Assistant Project Prompt

## 🎯 Project Overview

Arc Treasury is an AI-powered stablecoin treasury management platform built on Arc Network. It provides automated portfolio rebalancing, yield generation, and zero-fee swaps for USDC/EURC/XSGD tokens.

---

## 🏗️ Tech Stack

### Smart Contracts
- **Language:** Solidity 0.8.20
- **Framework:** Hardhat
- **Libraries:** OpenZeppelin
- **Network:** Arc Testnet (Chain ID: 5042002)
- **RPC:** https://rpc.testnet.arc.network

### Frontend
- **Framework:** React 18 + TypeScript + Vite
- **Styling:** TailwindCSS + shadcn/ui components
- **Web3:** ethers.js v6
- **Charts:** Recharts
- **Routing:** react-router-dom
- **State:** Context API (WalletContext, TreasuryContext, ThemeContext, PointsContext)

### Deployment
- **Smart Contracts:** Hardhat → Arc Testnet
- **Frontend:** Vercel
- **Storage:** localStorage (for user preferences, metadata, points)

---

## 📋 Current Architecture

### Smart Contracts (Deployed)

1. **AITreasury.sol** (`0x0B7950Ec78d5f7B53B120c889F83a6bd1fB0da59`)
   - Main contract for treasury management
   - Handles deposits, withdrawals, rebalancing
   - Supports multiple tokens per treasury
   - Auto-yield integration

2. **SwapRouter.sol** (`0xB6bdf5FCB0b17bB1b75CFF664d9eb311F8B977D7`)
   - Custom AMM for stablecoin swaps
   - Configurable exchange rates
   - Zero fees for swaps < $100

3. **YieldAggregator.sol** (`0x87E9EB8f48D147e2E15F81bE1a158eF61262CffC`)
   - Yield farming aggregator
   - Share-based system
   - Configurable APY rates

4. **StrategyManager.sol** (`0xEB3F374404048C2fE852a978bB390EE67d7f8500`)
   - Preset strategies (Conservative, Balanced, Aggressive)

5. **MockERC20 Tokens**
   - USDC: `0x260c4725760ecB414f2a4b7f191DdE36A0797483`
   - EURC: `0xb0a3f4d67BB1EFBf4a9C506226c5d705e1CdBbBD`
   - XSGD: `0xE5a859A422ee4570D713b98Bb8cC99ee277b021a`

### Frontend Pages

1. **Landing** (`/`) - Marketing page
2. **Dashboard** (`/dashboard`) - View treasury, balances, actions
3. **Create Treasury** (`/create`) - 4-step wizard for creating treasuries
4. **Analytics** (`/analytics`) - Charts and performance metrics
5. **Settings** (`/settings`) - User profile, email, Twitter, 2FA
6. **Referrals** (`/referrals`) - Referral program, stats, rewards
7. **Not Found** (`/*`) - 404 page

---

## 🎮 User Flow

### First-Time User
1. Lands on `/` (Landing page)
2. Clicks "Launch App" → `/dashboard`
3. Connects MetaMask wallet
4. Sees "No Treasury Yet" prompt
5. Clicks "Create Treasury" → `/create`
6. **Step 1:** Enters name + chooses emoji avatar
7. **Step 2:** Selects strategy (Conservative/Balanced/Aggressive)
8. **Step 3:** Fine-tunes allocation percentages
9. **Step 4:** Configures auto-yield & rebalance threshold
10. Creates treasury → Redirects to `/dashboard`
11. Clicks "Get Test Tokens" to mint USDC/EURC/XSGD
12. Makes first deposit → Earns points ⭐

### Returning User
1. Opens `/dashboard`
2. Sees Treasury balance (in contract) + Wallet balance
3. Can Deposit, Withdraw, or Rebalance
4. Checks Points in wallet dropdown
5. Shares referral link from `/referrals`
6. Manages profile in `/settings`

---

## 💰 Key Features

### 1. Treasury Management
- **One treasury per wallet address** (stored in localStorage)
- Treasury has: name, avatar, address, creation date
- Can create new (old one remains on-chain but hidden)
- Can remove from dashboard (doesn't delete on-chain)

### 2. Dual Balance Display
- **Wallet Balance (💳):** Tokens in MetaMask
- **Treasury Balance (🏦):** Tokens in smart contract
- User deposits from Wallet → Treasury
- User withdraws from Treasury → Wallet

### 3. Points & Gamification
- **Deposit:** 1 point per $100
- **Withdraw:** 0.5 points per $100
- **Referral signup:** 100 points
- **Referral deposit:** 5% of amount as points
- **Holding:** 0.1 points/day per $100 (future)
- Points stored in localStorage

### 4. Referral System
- Unique code per wallet (first 6 chars of address)
- Referral link: `https://arc-treasury.vercel.app?ref=B66D42`
- Auto-applies when user connects wallet
- Tracks referrals and earnings in localStorage

### 5. Theme System
- Dark mode (default)
- Light mode (toggle in navbar)
- Saved in localStorage

---

## 🔧 Technical Details

### localStorage Structure
```javascript
// Per user (address):
treasury_${address}             // Treasury contract address
treasury_metadata_${address}    // {name, avatar, createdAt, owner, address}
points_${address}               // {total, depositPoints, withdrawPoints, referralPoints, holdingPoints}
referral_${address}             // {code, referredBy, referrals[], earnings}
profile_${address}              // {email, twitter, twoFactorEnabled, notificationsEnabled}
theme                           // "light" | "dark"
```

### Smart Contract Interactions

**Create Treasury:**
```typescript
contract.createTreasury(
  [USDC, EURC, XSGD],           // tokens
  [5000, 3000, 2000],           // allocations (basis points: 50%, 30%, 20%)
  500,                           // rebalanceThreshold (5% = 500 basis points)
  true                           // autoYield
)
```

**Deposit:**
```typescript
1. token.approve(AITreasury, amount)
2. AITreasury.deposit(treasuryAddress, token, amount)
3. addDepositPoints(amount) // Frontend
```

**Withdraw:**
```typescript
1. AITreasury.withdraw(treasuryAddress, token, amount)
2. addWithdrawPoints(amount) // Frontend
```

---

## 🎨 Design System

### Colors (HSL)
- **Primary:** `217 91% 60%` (Electric Blue)
- **Accent:** `142 76% 36%` (Green)
- **Success:** `142 76% 36%` (Green)
- **Warning:** `38 92% 50%` (Orange)
- **Background Dark:** `222 47% 11%`
- **Background Light:** `220 20% 97%`

### Key CSS Classes
- `.glass-card` - Glassmorphism effect
- `.modern-card` - Card with gradient + hover shimmer
- `.gradient-text` - Blue→Cyan→Green gradient text
- `.glow-effect` - Subtle glow (minimal, not pulsing)

---

## 🐛 Known Issues & Solutions

### Issue 1: Official Arc USDC Not Working
**Problem:** Arc's native USDC (`0x3600...0000`) has special behavior incompatible with standard ERC-20 `transferFrom`

**Solution:** Using MockERC20 tokens for testing
- Mock tokens have standard ERC-20 interface
- Include `mint()` function for easy testing
- "Get Test Tokens" button mints 1000 of each token

### Issue 2: Balance Not Showing
**Problem:** `getTokenBalance` returns 0 even when user has tokens

**Solutions implemented:**
- Added detailed console logging
- Added manual refresh button
- Added 300ms delay for contract initialization
- Added loading states

### Issue 3: Deposit Fails with "Transfer Amount Exceeds Balance"
**Possible causes:**
- User trying to deposit more than balance
- Approve not working correctly
- Contract compatibility issues

**Debug approach:**
- Check console logs for approve transaction
- Verify allowance after approve
- Ensure using correct token decimals (6 for stablecoins)

---

## 🚀 What Works

✅ Wallet connection (MetaMask)
✅ Treasury creation with name & avatar
✅ 4-step wizard with helpful tips
✅ Points system (deposit/withdraw rewards)
✅ Referral system (auto-apply from URL)
✅ Settings page (email, Twitter, 2FA placeholder)
✅ Theme toggle (dark/light mode)
✅ Dual balance display (Wallet + Treasury)
✅ Test token minting (Get Test Tokens button)
✅ Responsive design
✅ Toast notifications

---

## 🎯 What Needs Work

### High Priority
1. **Fix Deposit Functionality**
   - Debug why approve/deposit fails
   - Add better error messages
   - Show transaction progress

2. **Treasury Balance Display**
   - Currently may show 0 even after deposit
   - Need to fetch from contract correctly
   - Add refresh mechanism

3. **Withdraw Functionality**
   - Ensure it works after deposits succeed
   - Test with actual treasury balances

### Medium Priority
1. **Transaction History**
   - Show recent deposits/withdrawals
   - Link to ArcScan explorer

2. **Rebalancing Logic**
   - Test auto-rebalancing
   - Show rebalance history

3. **Multi-Treasury Support**
   - Allow users to have multiple treasuries
   - Switch between them easily

### Low Priority
1. **Email Integration**
   - Actually send notifications
   - Verify email addresses

2. **2FA Implementation**
   - Real two-factor authentication
   - Not just a toggle

3. **Real Yield Integration**
   - Connect to Aave/Compound
   - Show actual APY from protocols

---

## 📝 Instructions for GPT

When helping with this project:

1. **Always use official Arc docs** for token addresses and network info
2. **Check contract ABIs** before making calls
3. **Test with mock tokens** first (they have mint function)
4. **Add console.log** for debugging Web3 interactions
5. **Use 6 decimals** for USDC/EURC/XSGD
6. **Save user data** to localStorage, not blockchain
7. **Keep UI clean** - minimal glow effects, no excessive animations
8. **Separate concerns** - Dashboard = view, Create = wizard, Settings = config
9. **Add helpful tips** to guide users
10. **Always validate** input before contract calls

---

## 🔑 Important Notes

### Security
- **NEVER commit private keys** to Git
- **NEVER hardcode** sensitive data in code
- Use environment variables for deployment keys
- Always delete temp files with keys after use

### Arc Network Specifics
- **USDC is used for gas** on Arc (not ETH)
- Official Arc USDC has dual nature (18 decimals native, 6 decimals ERC-20)
- For testing, use mock tokens to avoid compatibility issues
- Arc Testnet faucet: https://faucet.circle.com

### Data Persistence
- **On-chain:** Treasury structure, balances, transactions
- **localStorage:** User preferences, points, referrals, metadata
- **Never delete** on-chain data (immutable)
- **Can hide/show** treasuries via localStorage

---

## 🎁 Future Enhancements

### Phase 2
- [ ] Chainlink Price Feeds for real FX rates
- [ ] Chainlink Keepers for auto-rebalancing
- [ ] Real DeFi protocol integrations (Aave, Compound)
- [ ] Transaction history with filtering
- [ ] Portfolio performance charts
- [ ] Email notifications

### Phase 3
- [ ] Multi-treasury dashboard
- [ ] Custom strategy builder
- [ ] Social features (share strategies)
- [ ] Leaderboards (points competition)
- [ ] NFT badges for achievements
- [ ] Cross-chain support
- [ ] Mobile app

---

## 📊 Success Metrics

- Total Value Locked (TVL)
- Number of active treasuries
- User retention rate
- Points earned (engagement)
- Referral conversion rate
- Average deposit size
- Rebalancing frequency

---

## 🐛 Common Debugging Steps

### Web3 Issues
1. Open browser console (F12)
2. Check for red errors
3. Look for transaction hashes
4. Verify on ArcScan: https://testnet.arcscan.app
5. Check contract addresses in console logs
6. Verify wallet is on Arc Testnet

### Balance Issues
1. Click refresh button
2. Check console for `getTokenBalance` logs
3. Verify token contract address
4. Try "Get Test Tokens" if balance is 0
5. Check allowance if deposit fails

### Contract Errors
1. Read error message carefully
2. Check if token is supported: `contract.supportedTokens(token)`
3. Verify treasury exists and user is owner
4. Check if exchange rates are set for swaps

---

## 💬 How to Describe Issues to GPT

### Good Example:
```
I'm getting this error when trying to deposit:
"execution reverted: ERC20: transfer amount exceeds balance"

Transaction data: 0x8340f549...
User wallet: 0xB66D...81cb
Token: USDC (0x3600...0000)
Amount: 5 USDC

Console shows:
- ✅ Approve succeeded
- ❌ Deposit failed on transferFrom

What could be wrong with the official Arc USDC integration?
```

### Bad Example:
```
Deposit doesn't work
```

---

## 🎯 Project Goals

### Primary Goal
Build a production-ready DeFi treasury management platform that:
- Automates stablecoin portfolio balancing
- Generates passive yield
- Provides zero-fee swaps for small amounts
- Has excellent UX with helpful guidance

### Target Users
- DAO treasuries
- International businesses (FX exposure)
- Retail investors (passive management)
- Crypto-native users seeking yield

### Competitive Advantage
- **vs Uniswap:** Automated (no manual swaps)
- **vs Yearn:** Stablecoin-focused (less risky)
- **vs Curve:** Simpler UX + zero fees for small amounts

---

## 📖 Documentation Links

- **Arc Network Docs:** https://docs.arc.network
- **Arc Testnet Explorer:** https://testnet.arcscan.app
- **Contract Addresses:** https://docs.arc.network/arc/references/contract-addresses
- **Circle Faucet:** https://faucet.circle.com
- **GitHub:** https://github.com/vizzzix/arc_treasury
- **Twitter:** https://x.com/claimpilot

---

## 🔄 Typical Development Workflow

1. **Read the issue/request carefully**
2. **Check current code** (read relevant files)
3. **Understand the architecture** (contexts, components, contracts)
4. **Make focused changes** (don't rewrite everything)
5. **Test locally** if possible
6. **Build:** `npm run build`
7. **Deploy:** `vercel --prod --token <token> --yes`
8. **Never commit** Vercel tokens or private keys
9. **Clean up** temporary files after use

---

## ⚠️ Important Constraints

### DO
- ✅ Use mock tokens for testing (have mint function)
- ✅ Add helpful tooltips and tips for users
- ✅ Validate input before contract calls
- ✅ Log extensively for debugging
- ✅ Keep UI clean and minimal
- ✅ Separate concerns (Dashboard ≠ Create)
- ✅ Use localStorage for user data
- ✅ Add loading states everywhere

### DON'T
- ❌ Use official Arc USDC (incompatible with our contracts)
- ❌ Delete on-chain data (it's immutable)
- ❌ Add excessive animations/glow effects
- ❌ Commit sensitive data to Git
- ❌ Mix Dashboard and Create functionality
- ❌ Assume user has tokens (add "Get Test Tokens")
- ❌ Skip validation (always check inputs)

---

## 🧪 Testing Checklist

Before saying "it works":
- [ ] Connect wallet (MetaMask)
- [ ] Check both theme modes (dark/light)
- [ ] Click "Get Test Tokens" (should mint 1000 each)
- [ ] Create treasury (all 4 steps)
- [ ] Verify treasury appears in Dashboard
- [ ] Make deposit (check wallet & treasury balances)
- [ ] Make withdrawal
- [ ] Check points increased
- [ ] Copy referral link
- [ ] Test referral flow (new incognito window)
- [ ] Check Settings page saves data
- [ ] View on ArcScan (links work)

---

## 💡 Design Philosophy

### UI/UX Principles
1. **Clarity over cleverness** - Users should instantly understand what to do
2. **Guide, don't overwhelm** - Show tips at the right moments
3. **Progressive disclosure** - Step-by-step wizard, not all at once
4. **Immediate feedback** - Toast notifications for all actions
5. **Reversible actions** - Can always go back/undo
6. **Helpful defaults** - Balanced strategy, 5% threshold, auto-yield ON

### Visual Style
- **Dark theme:** Deep blue-black background, electric blue accents
- **Light theme:** Soft blue-white background, maintaining brand colors
- **Glassmorphism:** Backdrop blur, subtle borders, shadows
- **Minimal animations:** Only where helpful (loading spinners, hover scale)
- **Emojis:** Used for visual hierarchy, not decoration

---

## 🔮 Context for GPT

You are helping build a production DeFi application. The user is technical but may not know all Solidity/Web3 details. 

**Your role:**
- Fix bugs efficiently
- Suggest improvements
- Explain technical decisions
- Add helpful user guidance
- Keep code clean and maintainable

**When in doubt:**
- Add more logging
- Ask clarifying questions
- Test with mock tokens first
- Check Arc Network documentation
- Validate assumptions with console output

---

## 📞 Contact

- Twitter: [@claimpilot](https://x.com/claimpilot)
- GitHub: [vizzzix/arc_treasury](https://github.com/vizzzix/arc_treasury)

---

**Last Updated:** November 1, 2025

**Current Status:** MVP deployed, testing deposit/withdraw functionality with mock tokens. Points and referral systems implemented. Working on bug fixes and UX improvements.

