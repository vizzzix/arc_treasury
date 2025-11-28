import { createConfig, http, fallback } from 'wagmi'
import { mainnet, sepolia, base, baseSepolia, arcTestnet as arcTestnetChain } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'

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
  ],
  transports: {
    [mainnet.id]: http(),
    [sepolia.id]: http(),
    [base.id]: http(),
    [baseSepolia.id]: http(),
    [arcTestnetChain.id]: arcTestnetHttp, // Use custom transport with retry logic
  },
})
