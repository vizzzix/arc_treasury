/**
 * Network and token constants for Arc Treasury
 *
 * Circle CCTP V2 - Bridge between Ethereum Sepolia and Arc Testnet
 */

// Migration flag - set to true during V4 → V5 migration
// When true: deposits and locks are disabled, only withdrawals allowed
export const MIGRATION_IN_PROGRESS = false;

// Show success banner after migration completion (can be removed after a few days)
export const SHOW_MIGRATION_SUCCESS = false;

// USYC Whitelist pending - V5 vault waiting for Circle/Hashnote to add to allowlist
// When true: deposits and locks are disabled, only withdrawals allowed
export const USYC_WHITELIST_PENDING = false;

// EURC deposits disabled - Circle EURC requires whitelist on Arc Testnet
// When true: EURC deposits show "Coming Soon" message
export const EURC_DEPOSITS_DISABLED = false;

// CCTP Contract Addresses for manual minting (Testnet)
export const CCTP_CONTRACTS = {
  arcTestnet: {
    MessageTransmitter: '0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275' as `0x${string}`,
    TokenMessenger: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA' as `0x${string}`,
    TokenMinter: '0xb43db544E2c27092c107639Ad201b3dEfAbcF192' as `0x${string}`,
  },
  ethereumSepolia: {
    // CCTP V2 contracts for Sepolia
    MessageTransmitter: '0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275' as `0x${string}`,
    TokenMessenger: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA' as `0x${string}`,
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
    type: 'evm' as const,
  },
  ethereumSepolia: {
    name: 'Ethereum Sepolia',
    chainId: 11155111,
    bridgeKitChain: 'Ethereum_Sepolia' as const,
    isTestnet: true,
    explorerUrl: 'https://sepolia.etherscan.io',
    type: 'evm' as const,
  },
  solanaDevnet: {
    name: 'Solana Devnet',
    chainId: 0, // Solana doesn't use chainId
    bridgeKitChain: 'Solana_Devnet' as const,
    isTestnet: true,
    explorerUrl: 'https://explorer.solana.com/?cluster=devnet',
    type: 'solana' as const,
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

// USYC Teller contract (USDC/USYC conversion via Circle/Hashnote)
export const USYC_TELLER_ADDRESS = '0x9fdF14c5B14173D74C08Af27AebFf39240dC105A' as `0x${string}`;

// Deployed Treasury Vault contracts on Arc Testnet
// Updated: 2025-11-27 - V8 with permanent points system
export const TREASURY_CONTRACTS = {
  USYCOracle: '0x4b4b1dad50f07def930ba2b17fdcb0e565dae4e9' as `0x${string}`, // Oracle for USYC price
  TreasuryVault: '0x17ca5232415430bC57F646A72fD15634807bF729' as `0x${string}`, // V8 Proxy: Upgradeable vault with permanent points
  TreasuryVaultV4: '0x34d504dda5bcd436d4d86ef9b3930ea8c0cd8b2f' as `0x${string}`, // V4: Deprecated, funds returned to users
  EarlySupporterBadge: '0xb26a5b1d783646a7236ca956f2e954e002bf8d13' as `0x${string}`, // Early Supporter Badge + 1.2x multiplier (max 5000)
  // Swap Pool contracts - deployed 2025-11-29
  SwapEURC: '0x742b2d045d430fe718b57046645ba33295914b69' as `0x${string}`, // Mintable EURC for swap pool
  StablecoinSwap: '0x3a5964ce5cd8b09e55af9323a894e78bdd7f04bf' as `0x${string}`, // USDC/EURC AMM swap pool (0.2% fee)
} as const;

// Guild.xyz configuration for sybil protection
export const GUILD_CONFIG = {
  guildId: 'arctreasury',
  roleId: 'early-supporter', // Role that grants mint access
  apiUrl: 'https://api.guild.xyz/v2',
} as const;

// Token contract addresses on Arc Testnet
export const TOKEN_ADDRESSES = {
  // Arc Testnet
  arcTestnet: {
    USDC: '0x3600000000000000000000000000000000000000' as `0x${string}`, // Native currency
    EURC: '0x742b2d045d430fe718b57046645ba33295914b69' as `0x${string}`, // SwapEURC (mintable) - same as swap pool, uses 6 decimals
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

// Circle CCTP Domain IDs (for attestation API)
export const CCTP_DOMAINS = {
  ethereumSepolia: 0, // Ethereum Sepolia domain
  arcTestnet: 26, // Arc Testnet domain
  solanaDevnet: 5, // Solana Devnet domain
} as const;

// Circle Attestation API - use proxy to avoid CORS
// Format: /api/circle?action=messages&domain={domain}&transactionHash={hash}
export const CIRCLE_ATTESTATION_API = '/api/circle?action=messages' as const;

// Estimated bridge times (in minutes)
export const BRIDGE_ESTIMATED_TIME = {
  FAST: 1, // ~1 minute for testnet fast transfers
  SLOW: 15, // ~15 minutes for standard transfers
} as const;

