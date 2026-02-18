import { createConfig, http, fallback } from 'wagmi'
import { mainnet, sepolia, base, baseSepolia, arcTestnet as arcTestnetChain } from 'wagmi/chains'
import { injected, walletConnect } from 'wagmi/connectors'

const WALLETCONNECT_PROJECT_ID = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || ''

// Re-export official Arc Testnet chain from viem/chains
export const arcTestnet = arcTestnetChain

// Centralized Arc Testnet RPC URL: Alchemy primary, public fallback
const ALCHEMY_ARC_RPC = import.meta.env.VITE_ALCHEMY_ARC_RPC || ''
const PUBLIC_ARC_RPC = 'https://rpc.testnet.arc.network'
export const ARC_RPC_URL = ALCHEMY_ARC_RPC || PUBLIC_ARC_RPC

// Fallback HTTP transport for Arc Testnet
// Alchemy primary → public RPC fallback
const arcTestnetHttp = ALCHEMY_ARC_RPC
  ? fallback([
      http(ALCHEMY_ARC_RPC, { retryCount: 1, timeout: 30000 }),
      http(PUBLIC_ARC_RPC, { retryCount: 1, timeout: 30000 }),
    ])
  : http(PUBLIC_ARC_RPC, { retryCount: 1, timeout: 30000 });

export const config = createConfig({
  chains: [mainnet, sepolia, base, baseSepolia, arcTestnetChain],
  connectors: [
    injected(), // Supports MetaMask, Rabby, and other injected wallets
    walletConnect({
      projectId: WALLETCONNECT_PROJECT_ID,
      metadata: {
        name: 'Arc Treasury',
        description: 'Earn yield from US Treasury Bills',
        url: 'https://arctreasury.biz',
        icons: ['https://arctreasury.biz/arc-logo.png'],
      },
      showQrModal: true, // Shows QR code modal for mobile
    }),
  ],
  transports: {
    [mainnet.id]: http(),
    [sepolia.id]: http(),
    [base.id]: http(),
    [baseSepolia.id]: http(),
    [arcTestnetChain.id]: arcTestnetHttp, // Use custom transport with retry logic
  },
})
