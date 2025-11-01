# 🏦 Arc Treasury

AI-powered stablecoin treasury management platform on Arc Network. Automated portfolio rebalancing, zero-fee swaps, and yield generation for USDC/EURC/XSGD.

## Features

- **Automated Rebalancing** - AI-driven portfolio optimization with custom strategies
- **Zero-Fee Swaps** - Custom AMM for USDC/EURC/XSGD exchanges
- **Yield Generation** - Automated yield aggregation (5-12% APY simulation)
- **Modern UI** - React + TypeScript + TailwindCSS with Web3 integration

## Tech Stack

**Smart Contracts**
- Solidity 0.8.20
- OpenZeppelin libraries
- Hardhat development environment

**Frontend**
- React 18 + TypeScript
- ethers.js v6
- TailwindCSS + shadcn/ui
- Recharts for analytics

## Deployed Contracts (Arc Testnet)

```
AITreasury:      0x0B7950Ec78d5f7B53B120c889F83a6bd1fB0da59
SwapRouter:      0xB6bdf5FCB0b17bB1b75CFF664d9eb311F8B977D7
YieldAggregator: 0x87E9EB8f48D147e2E15F81bE1a158eF61262CffC
StrategyManager: 0xEB3F374404048C2fE852a978bB390EE67d7f8500

Test Tokens:
USDC:            0x260c4725760ecB414f2a4b7f191DdE36A0797483
EURC:            0xb0a3f4d67BB1EFBf4a9C506226c5d705e1CdBbBD
XSGD:            0xE5a859A422ee4570D713b98Bb8cC99ee277b021a
```

**Network:** Arc Testnet  
**RPC:** `https://rpc.testnet.arc.network`  
**Chain ID:** `5042002`

## Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Compile smart contracts
npm run compile

# Deploy to Arc Testnet
npm run deploy:testnet
```

## Project Structure

```
arc-treasury/
├── contracts/          # Solidity smart contracts
│   ├── AITreasury.sol
│   ├── SwapRouter.sol
│   ├── YieldAggregator.sol
│   └── StrategyManager.sol
├── scripts/            # Deployment scripts
├── src/                # React frontend
│   ├── components/
│   ├── contexts/
│   ├── pages/
│   └── contracts/      # ABIs and addresses
└── hardhat.config.cjs  # Hardhat configuration
```

## Smart Contracts

### AITreasury.sol
Main treasury management contract handling deposits, withdrawals, and strategy execution.

### SwapRouter.sol
Custom AMM for zero-fee token swaps between USDC, EURC, and XSGD.

### YieldAggregator.sol
Automated staking and yield generation with configurable APY rates.

### StrategyManager.sol
Rebalancing strategy management with pre-built templates (Conservative, Balanced, Aggressive).

## Usage

1. **Connect Wallet** - Add Arc Testnet to MetaMask and connect
2. **Get Test Tokens** - Request USDC from [Circle Faucet](https://faucet.circle.com)
3. **Create Treasury** - Select strategy and deposit stablecoins
4. **Manage Portfolio** - Swap tokens, view balances, monitor yield

## Roadmap

**Phase 1 (Complete)** ✅
- Core smart contracts
- Frontend MVP
- Arc Testnet deployment
- Basic rebalancing strategies

**Phase 2 (In Progress)**
- Chainlink price feeds
- Automated rebalancing with Keepers
- Transaction history
- Performance analytics

**Phase 3 (Planned)**
- Multi-treasury support
- Custom strategy builder
- Real DeFi protocol integrations
- Mainnet deployment

## Development

### Environment Setup

Create `.env` file:
```env
PRIVATE_KEY=your_private_key_here
ARC_RPC_URL=https://rpc.testnet.arc.network
```

### Deploy Contracts

```bash
# Deploy to Arc Testnet
npm run deploy:testnet

# Deploy locally
npm run node        # Terminal 1
npm run deploy      # Terminal 2
```

### Build Frontend

```bash
npm run build
npm run preview
```

## Security

- OpenZeppelin audited libraries
- ReentrancyGuard on all state-changing functions
- Ownable access control
- Open-source and auditable code

## License

MIT License - see [LICENSE](LICENSE) file

## Links

- **Twitter**: [@claimpilot](https://x.com/claimpilot)
- **GitHub**: [vizzzix/arc_treasury](https://github.com/vizzzix/arc_treasury)
- **Arc Network**: [https://arc.network](https://arc.network)

---

Built for the Arc Network ecosystem 🚀
