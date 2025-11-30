import { createConfig, http, fallback } from 'wagmi'
import { mainnet, sepolia, base, baseSepolia, arcTestnet as arcTestnetChain } from 'wagmi/chains'
import { injected, walletConnect } from 'wagmi/connectors'

// Get your free Project ID at https://cloud.walletconnect.com/
const WALLETCONNECT_PROJECT_ID = '396138e333541ea7c840e5ebc7102499'

// Re-export official Arc Testnet chain from viem/chains
export const arcTestnet = arcTestnetChain

// Fallback HTTP transport for Arc Testnet with multiple RPC endpoints
// Automatically switches to next endpoint on rate limit errors (429)
const arcTestnetHttp = fallback([
  http('https://rpc.testnet.arc.network', {
    retryCount: 1,
    timeout: 30000,
  }),
  http('https://rpc.blockdaemon.testnet.arc.network', {
    retryCount: 1,
    timeout: 30000,
  }),
  http('https://rpc.drpc.testnet.arc.network', {
    retryCount: 1,
    timeout: 30000,
  }),
  http('https://rpc.quicknode.testnet.arc.network', {
    retryCount: 1,
    timeout: 30000,
  }),
]);

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
