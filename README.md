# Arc Treasury

<div align="center">
  <h3>Earn Yield on Your Stablecoins</h3>
  <p>Professional DeFi treasury management on Arc Network</p>
  <p>
    <a href="https://arctreasury.biz">🌐 Live App</a> •
    <a href="https://testnet.arcscan.app/address/0xe050d1353bf7f4d7f66ff4538333e03d7e52ad87">📜 Smart Contract</a>
  </p>
</div>

---

## Overview

Arc Treasury is a decentralized treasury management protocol that enables users to earn sustainable yield on their USDC and EURC stablecoins. Built on Arc Network, it provides two flexible deposit options to match your liquidity needs.

## Features

### 💰 Flexible Deposits
- Deposit USDC or EURC anytime
- Withdraw instantly with no lock-up period
- Earn real-time USYC APY (based on US Treasury rates)
- Perfect for liquid savings

### 🔒 Locked Positions
Earn boosted yields by locking your funds for fixed periods:
- **1 Month Lock**: Base APY × 1.17 (+17% boost)
- **3 Months Lock**: Base APY × 1.35 (+35% boost)
- **12 Months Lock**: Base APY × 1.69 (+69% boost)

Early withdrawal available with 25% penalty on principal.

### 🎯 Referral System
- Share your unique referral code
- Earn rewards when friends deposit
- Track your referral stats in real-time

### 🌉 Native USDC Bridge
- Bridge USDC from Ethereum Sepolia to Arc Network
- Powered by Circle's CCTP protocol
- No wrapped tokens - native USDC on both chains
- 2-step process with automatic attestation

## How It Works

1. **Get USDC on Arc Network**
   - Get free testnet USDC from [Circle Faucet](https://faucet.circle.com/)
   - Bridge from Ethereum Sepolia using the built-in bridge

2. **Connect Your Wallet**
   - Click "Connect Wallet" in the top right
   - Approve the connection (MetaMask, Rabby, etc.)

3. **Choose Your Strategy**
   - **Flexible**: Deposit and withdraw anytime
   - **Locked**: Higher APY for fixed lock periods

4. **Watch Your Balance Grow**
   - Yield accumulates in real-time
   - Track all positions from your dashboard

## Smart Contracts (Arc Testnet)

| Contract | Address | Explorer |
|----------|---------|----------|
| TreasuryVault | `0xe050d1353bf7f4d7f66ff4538333e03d7e52ad87` | [View](https://testnet.arcscan.app/address/0xe050d1353bf7f4d7f66ff4538333e03d7e52ad87) |
| USYCOracle | `0x9210289432a5c7d7c6506dae8c1716bb47f8d84c` | [View](https://testnet.arcscan.app/address/0x9210289432a5c7d7c6506dae8c1716bb47f8d84c) |
| PointsMultiplierNFT | `0x3eeca3180a2c0db29819ad007ff9869764b97419` | [View](https://testnet.arcscan.app/address/0x3eeca3180a2c0db29819ad007ff9869764b97419) |

## Technology Stack

- **Frontend**: React 18, TypeScript, TailwindCSS
- **Web3**: wagmi v2, viem, RainbowKit
- **Bridge**: Circle CCTP (Cross-Chain Transfer Protocol)
- **Blockchain**: Arc Network Testnet (Chain ID: 5042002)
- **Yield Source**: USYC (Circle's tokenized money market fund)

## Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Architecture

### Yield Generation
Deposits are allocated to USYC (Hashnote Short Duration Yield), a tokenized money market fund by Circle. The treasury tracks the NAV (Net Asset Value) of USYC to calculate real-time yield.

### Locked Positions
Users can lock funds for 1, 3, or 12 months to earn boosted APY. Each locked position tracks:
- Initial deposit amount and token type
- Lock period and unlock timestamp
- Accumulated yield based on USYC performance
- Current position value

### Points System
Users earn points based on deposit amount and duration:
```
Points = Deposit Amount (USD) × Days Deposited
```

Points can be boosted 2x by holding the Multiplier NFT.

## Security

- All smart contracts deployed on Arc Network
- User funds stored in audited vault contract
- Non-custodial - you control your keys
- Transparent on-chain yield calculations

**⚠️ Testnet Notice**: This is a testnet deployment. Use only test tokens. Do not deposit real assets.

## FAQ

**Q: Is this real money?**
A: No, this is deployed on Arc Testnet for testing purposes. All yields and tokens are simulated.

**Q: Can I withdraw my locked positions early?**
A: Yes, but a 25% penalty is applied to the principal amount. Earned yield is not penalized.

**Q: How is APY calculated?**
A: APY is derived from USYC's Net Asset Value changes, updated hourly via on-chain oracle.

**Q: What are the fees?**
A: The platform may charge a small management fee to cover operational costs.

## Links

- **Website**: https://arctreasury.biz
- **Bridge**: Built-in USDC bridge from Ethereum Sepolia
- **Faucet**: https://faucet.circle.com/ (testnet USDC)
- **Arc Network**: https://arc.network

## License

© 2025 Arc Treasury. All rights reserved.
