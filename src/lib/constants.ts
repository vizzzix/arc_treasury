/**
 * Network and token constants for Arc Treasury
 *
 * Circle CCTP V2 - Bridge between Ethereum Sepolia and Arc Testnet
 */

// CCTP Contract Addresses for manual minting (Testnet)
export const CCTP_CONTRACTS = {
  arcTestnet: {
    MessageTransmitter: '0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275' as `0x${string}`,
    TokenMessenger: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA' as `0x${string}`,
    TokenMinter: '0xb43db544E2c27092c107639Ad201b3dEfAbcF192' as `0x${string}`,
  },
  ethereumSepolia: {
    MessageTransmitter: '0xaCF1ceeF35caAc005e15888dDb8A3515C41B4872' as `0x${string}`,
    TokenMessenger: '0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5' as `0x${string}`,
  },
} as const;

// Arc Bridge Contract - Custom bridge wrapper for Sepolia → Arc Testnet
// This is NOT the standard CCTP TokenMessenger - it's Arc's custom bridge
export const ARC_BRIDGE_CONTRACT = '0xC5567a5E3370d4DBfB0540025078e283e36A363d' as `0x${string}`;

// Supported networks for bridging (CCTP V2 Testnet)
// Note: Circle Bridge Kit SDK automatically resolves CCTP contract addresses based on bridgeKitChain
// Arc Testnet CCTP contracts (Domain 26):
// - TokenMessengerV2: 0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA
// - MessageTransmitterV2: 0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275
// - TokenMinterV2: 0xb43db544E2c27092c107639Ad201b3dEfAbcF192
// - MessageV2: 0xbaC0179bB358A8936169a63408C8481D582390C4
export const SUPPORTED_NETWORKS = {
  arcTestnet: {
    name: 'Arc Testnet',
    chainId: 5042002,
    bridgeKitChain: 'Arc_Testnet' as const, // Bridge Kit automatically resolves CCTP contracts for this chain
    isTestnet: true,
    explorerUrl: 'https://testnet.arcscan.app',
  },
  ethereumSepolia: {
    name: 'Ethereum Sepolia',
    chainId: 11155111,
    bridgeKitChain: 'Ethereum_Sepolia' as const,
    isTestnet: true,
    explorerUrl: 'https://sepolia.etherscan.io',
  },
} as const;

// Token symbols
export const TOKENS = {
  USDC: 'USDC',
  EURC: 'EURC',
  USYC: 'USYC',
} as const;

// USYC Allowlist addresses
export const USYC_ALLOWLIST = [
  '0xB66D4229Bb5A82De94610d63677cF5370e6a81cb',
] as const;

// USYC Reference APY (simulated yield rate)
export const USYC_REFERENCE_APY = 4.2;

// USYC Entitlements contract (manages allowlist on Arc Testnet)
export const ENTITLEMENTS_ADDRESS = '0xcc205224862c7641930c87679e98999d23c26113' as `0x${string}`;

// Deployed Treasury Vault contracts on Arc Testnet
// Updated: 2025-11-21 - V2 with lock periods, early withdrawal penalties, and boosted points
export const TREASURY_CONTRACTS = {
  USYCOracle: '0x9210289432a5c7d7c6506dae8c1716bb47f8d84c' as `0x${string}`, // Oracle for USYC price
  TreasuryVault: '0xe050d1353bf7f4d7f66ff4538333e03d7e52ad87' as `0x${string}`, // V2: Lock periods + early withdrawal + boosted points
  PointsMultiplierNFT: '0x3eeca3180a2c0db29819ad007ff9869764b97419' as `0x${string}`, // NFT for 2x points multiplier (max supply: 2000)
} as const;

// Token contract addresses on Arc Testnet
export const TOKEN_ADDRESSES = {
  // Arc Testnet
  arcTestnet: {
    USDC: '0x3600000000000000000000000000000000000000' as `0x${string}`, // Native currency
    EURC: '0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a' as `0x${string}`, // EURC on Arc Testnet - Main EURC token contract, uses 6 decimals
    USYC: '0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C' as `0x${string}`, // USYC on Arc Testnet - Main USYC token contract, uses 6 decimals
  },
  // Ethereum Sepolia
  ethereumSepolia: {
    USDC: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' as `0x${string}`,
    EURC: '0x08210F9170F89Ab7658F0B5E3fF39b0E03C594D4' as `0x${string}`, // EURC on Sepolia
  },
} as const;

// Token decimals
export const TOKEN_DECIMALS = {
  USDC: 18, // Native USDC on Arc Testnet uses 18 decimals (native currency / wei)
  EURC: 6, // EURC uses 6 decimals
  USYC: 6, // USYC uses 6 decimals (typically)
} as const;

// Bridge transfer speed options
export const TRANSFER_SPEED = {
  FAST: 'FAST' as const,
  SLOW: 'SLOW' as const,
} as const;

// Estimated bridge times (in minutes)
export const BRIDGE_ESTIMATED_TIME = {
  FAST: 1, // ~1 minute for testnet fast transfers
  SLOW: 15, // ~15 minutes for standard transfers
} as const;

