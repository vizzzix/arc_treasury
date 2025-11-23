import { useState, useCallback, useRef, useEffect } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { SUPPORTED_NETWORKS, TRANSFER_SPEED, CCTP_CONTRACTS, TOKEN_ADDRESSES } from '@/lib/constants';
import { TOKEN_MESSENGER_ABI, MESSAGE_TRANSMITTER_ABI, ERC20_ABI, CCTP_DOMAIN_IDS } from '@/lib/cctp-abis';
import { toast } from 'sonner';
import { createPublicClient, http, parseUnits, formatUnits } from 'viem';
import { sepolia } from 'viem/chains';
import { defineChain } from 'viem';

type BridgeNetwork = keyof typeof SUPPORTED_NETWORKS;
type TransferSpeed = typeof TRANSFER_SPEED.FAST | typeof TRANSFER_SPEED.SLOW;

// Helper function to safely stringify objects with BigInt values
const safeStringify = (obj: any): string => {
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === 'bigint') {
      return value.toString() + 'n';
    }
    return value;
  }, 2);
};

interface BridgeParams {
  fromNetwork: BridgeNetwork;
  toNetwork: BridgeNetwork;
  amount: string;
  transferSpeed?: TransferSpeed; // Optional, defaults to FAST
}

interface BridgeTransaction {
  hash: string;
  network: string;
  explorerUrl: string;
  status: 'pending' | 'success' | 'failed';
  step: string;
}

interface BridgeState {
  isBridging: boolean;
  error: string | null;
  result: any | null;
  transactions: BridgeTransaction[];
}

// Helper function to check transaction status by hash
const checkTransactionStatusHelper = async (
  txHash: string,
  network: BridgeNetwork
): Promise<'success' | 'failed' | 'pending'> => {
  try {
    let publicClient;

    if (network === 'ethereumSepolia') {
      publicClient = createPublicClient({
        chain: sepolia,
        transport: http('https://ethereum-sepolia-rpc.publicnode.com', { timeout: 5000 }),
      });
    } else if (network === 'arcTestnet') {
      const arcTestnet = defineChain({
        id: 5042002,
        name: 'Arc Testnet',
        nativeCurrency: { name: 'Ethereum', symbol: 'ETH', decimals: 18 },
        rpcUrls: {
          default: { http: ['https://rpc.testnet.arc.network'] },
        },
        blockExplorers: {
          default: { name: 'Arc Explorer', url: 'https://testnet.arcscan.app' },
        },
        testnet: true,
      });
      publicClient = createPublicClient({
        chain: arcTestnet,
        transport: http('https://rpc.testnet.arc.network', { timeout: 5000 }),
      });
    } else {
      return 'pending';
    }

    const receipt = await Promise.race([
      publicClient.getTransactionReceipt({
        hash: txHash as `0x${string}`,
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), 5000)
      ),
    ]) as any;

    return receipt?.status === 'success' ? 'success' : 'failed';
  } catch (error) {
    console.error('[useBridge] Error checking transaction status:', error);
    return 'pending';
  }
};

// Helper function to get attestation from Circle API
const getAttestationHelper = async (
  burnTxHash: string,
  sourceDomain: number = 0 // 0 = Ethereum Sepolia
): Promise<{ status: string; attestation?: string; message?: string } | null> => {
  try {
    const url = `https://iris-api-sandbox.circle.com/v2/messages/${sourceDomain}?transactionHash=${burnTxHash}`;
    console.log('[useBridge] Fetching attestation from:', url);

    const response = await fetch(url);
    if (!response.ok) {
      console.error('[useBridge] Attestation API error:', response.status, response.statusText);
      return null;
    }

    const data = await response.json();
    console.log('[useBridge] Attestation response:', data);

    // Check if attestation is ready
    if (data.status === 'complete' && data.attestation) {
      return {
        status: 'complete',
        attestation: data.attestation,
        message: data.message,
      };
    }

    return {
      status: data.status || 'pending',
    };
  } catch (error) {
    console.error('[useBridge] Error fetching attestation:', error);
    return null;
  }
};

export const useBridge = () => {
  const account = useAccount();
  const address = account?.address;
  const isConnected = account?.isConnected ?? false;

  const { data: walletClient } = useWalletClient();
  const [state, setState] = useState<BridgeState>({
    isBridging: false,
    error: null,
    result: null,
    transactions: [],
  });

  // Track burn transaction for attestation polling
  const [burnTxHash, setBurnTxHash] = useState<string | null>(null);
  const [isPollingAttestation, setIsPollingAttestation] = useState(false);
  const attestationPollingRef = useRef<NodeJS.Timeout | null>(null);

  const bridge = useCallback(
    async ({ fromNetwork, toNetwork, amount, transferSpeed = TRANSFER_SPEED.FAST }: BridgeParams) => {
      if (!isConnected || !address || !walletClient) {
        toast.error('Please connect your wallet first');
        return;
      }

      if (!amount || parseFloat(amount) <= 0) {
        toast.error('Please enter a valid amount');
        return;
      }

      setState({ isBridging: true, error: null, result: null, transactions: [] });

      try {
        // Create Circle Bridge Kit instance
        const kit = new BridgeKit();

        // Get the EIP1193 provider from window.ethereum
        const provider = (window as any).ethereum;
        if (!provider) {
          throw new Error('No Ethereum provider found. Please install MetaMask or another Web3 wallet.');
        }

        // Arc Testnet chain definition (defined outside to reuse)
        const arcTestnet = defineChain({
          id: 5042002,
          name: 'Arc Testnet',
          nativeCurrency: { name: 'Ethereum', symbol: 'ETH', decimals: 18 },
          rpcUrls: {
            default: { http: ['https://rpc.testnet.arc.network'] },
          },
          blockExplorers: {
            default: { name: 'Arc Explorer', url: 'https://testnet.arcscan.app' },
          },
          testnet: true,
        });

        // Create adapter from EIP1193 provider
        const adapter = await createAdapterFromProvider({
          provider,
          getPublicClient: async (chain) => {
            // Create appropriate public client based on chain
            const { createPublicClient, http } = await import('viem');
            const { sepolia } = await import('viem/chains');
            const { defineChain } = await import('viem');
            
            // Log full chain object for debugging (with BigInt support)
            console.log('[useBridge] getPublicClient called with chain:', {
              chain,
              type: typeof chain,
              isObject: typeof chain === 'object' && chain !== null,
              keys: typeof chain === 'object' && chain !== null ? Object.keys(chain as any) : [],
              stringified: safeStringify(chain),
            });
            
            // Check chain ID first (most reliable) - check multiple possible fields
            let chainId: number | null = null;
            if (typeof chain === 'object' && chain !== null) {
              const chainObj = chain as any;
              chainId = chainObj.id || chainObj.chainId || chainObj.chain_id || chainObj.networkId || null;
              
              // Also check nested objects
              if (!chainId && chainObj.chain) {
                chainId = chainObj.chain.id || chainObj.chain.chainId || chainObj.chain.chain_id || null;
              }
            } else if (typeof chain === 'number') {
              chainId = chain;
            }
            
            // Also check by name if chainId not found
            let chainName: string | null = null;
            if (typeof chain === 'object' && chain !== null) {
              const chainObj = chain as any;
              chainName = chainObj.name || chainObj.network || chainObj.chainName || null;
              if (!chainName && chainObj.chain) {
                chainName = chainObj.chain.name || chainObj.chain.network || null;
              }
            }
            
            console.log('[useBridge] Extracted chain info:', { chainId, chainName });
            
            // Determine which chain to use by ID
            if (chainId === sepolia.id || chainId === 11155111) {
              console.log('[useBridge] Using Ethereum Sepolia public client (by chainId:', chainId, ')');
              return createPublicClient({ 
                chain: sepolia, 
                transport: http('https://ethereum-sepolia-rpc.publicnode.com', { timeout: 10000 }) 
              }) as any;
            } else if (chainId === arcTestnet.id || chainId === 5042002) {
              console.log('[useBridge] Using Arc Testnet public client (by chainId:', chainId, ')');
              return createPublicClient({ 
                chain: arcTestnet, 
                transport: http('https://rpc.testnet.arc.network', { timeout: 10000 }) 
              }) as any;
            }
            
            // Try to determine by name
            if (chainName) {
              const nameLower = chainName.toLowerCase();
              if (nameLower.includes('sepolia') || nameLower.includes('ethereum') && nameLower.includes('sepolia')) {
                console.log('[useBridge] Using Ethereum Sepolia public client (by name:', chainName, ')');
                return createPublicClient({ 
                  chain: sepolia, 
                  transport: http('https://ethereum-sepolia-rpc.publicnode.com', { timeout: 10000 }) 
                }) as any;
              } else if (nameLower.includes('arc') && nameLower.includes('testnet')) {
                console.log('[useBridge] Using Arc Testnet public client (by name:', chainName, ')');
                return createPublicClient({ 
                  chain: arcTestnet, 
                  transport: http('https://rpc.testnet.arc.network', { timeout: 10000 }) 
                }) as any;
              }
            }
            
            // Fallback: try to determine by string representation
            const chainStr = String(chain).toLowerCase();
            if (chainStr.includes('ethereum') && chainStr.includes('sepolia')) {
              console.log('[useBridge] Using Ethereum Sepolia public client (by string)');
              return createPublicClient({ 
                chain: sepolia, 
                transport: http('https://ethereum-sepolia-rpc.publicnode.com', { timeout: 10000 }) 
              }) as any;
            } else if (chainStr.includes('arc') && chainStr.includes('testnet')) {
              console.log('[useBridge] Using Arc Testnet public client (by string)');
              return createPublicClient({ 
                chain: arcTestnet, 
                transport: http('https://rpc.testnet.arc.network', { timeout: 10000 }) 
              }) as any;
            }
            
            // Last resort: create a generic client based on chainId if available
            if (chainId) {
              console.log('[useBridge] Creating generic public client for chainId:', chainId);
              const genericChain = defineChain({
                id: chainId,
                name: 'Unknown Chain',
                nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
                rpcUrls: {
                  default: { http: chainId === 11155111 ? ['https://ethereum-sepolia-rpc.publicnode.com'] : ['https://rpc.testnet.arc.network'] },
                },
              });
              return createPublicClient({ 
                chain: genericChain, 
                transport: http(chainId === 11155111 ? 'https://ethereum-sepolia-rpc.publicnode.com' : 'https://rpc.testnet.arc.network', { timeout: 10000 }) 
              }) as any;
            }
            
            // If we can't determine the chain, try to use the chain object directly if it's a valid viem chain
            if (typeof chain === 'object' && chain !== null) {
              try {
                console.log('[useBridge] Attempting to use chain object directly');
                return createPublicClient({ 
                  chain: chain as any, 
                  transport: http('https://rpc.testnet.arc.network', { timeout: 10000 }) 
                }) as any;
              } catch (err) {
                console.error('[useBridge] Failed to use chain object directly:', err);
              }
            }
            
            // If we can't determine the chain, throw an error instead of returning undefined
            console.error('[useBridge] Cannot determine chain for public client:', {
              chain,
              chainId,
              chainName,
              type: typeof chain,
              stringified: safeStringify(chain),
            });
            throw new Error(`Unsupported chain: ${safeStringify(chain)}. Please use Ethereum Sepolia or Arc Testnet.`);
          },
        });

        const fromChain = SUPPORTED_NETWORKS[fromNetwork].bridgeKitChain;
        const toChain = SUPPORTED_NETWORKS[toNetwork].bridgeKitChain;

        const transactions: BridgeTransaction[] = [];

        // Execute bridge with shorter timeout - we handle attestation polling separately
        // Bridge Kit just needs to complete the burn transaction
        console.log('[useBridge] Starting bridge...', { fromNetwork, toNetwork, amount, transferSpeed });

        let bridgeCompleted = false;

        const bridgePromise = kit.bridge({
          from: {
            adapter,
            chain: fromChain,
          },
          to: {
            adapter,
            chain: toChain,
          },
          amount,
          config: {
            transferSpeed,
          },
          token: 'USDC',
        }).then((res) => {
          bridgeCompleted = true;
          return res;
        });

        // Shorter timeout since we only need burn to complete
        // Attestation polling will handle the rest
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => {
            if (!bridgeCompleted) {
              reject(new Error('BRIDGE_TIMEOUT'));
            }
          }, 120000); // 2 minutes timeout for burn
        });

        let result: any;
        try {
          result = await Promise.race([bridgePromise, timeoutPromise]) as any;
        } catch (error: any) {
          // If timeout occurred but we have transactions, treat as success
          if (error?.message === 'BRIDGE_TIMEOUT') {
            console.warn('[useBridge] Bridge Kit timeout - but burn may have completed');
            // Stop bridging state - attestation polling will continue in background
            setState({
              isBridging: false,
              error: null,
              result: null,
              transactions: [],
            });
            toast.info('Burn завершён!', {
              description: 'Ожидаем attestation от Circle. Это займёт 5-15 минут. Вы можете закрыть страницу.',
              duration: 10000,
            });
            return;
          } else {
            throw error;
          }
        }
        
        // Log bridge result with BigInt support
        console.log('[useBridge] Bridge result:', safeStringify(result));

        // Extract transactions from result steps
        // According to Circle Bridge Kit docs, steps can have: name, state, txHash, errorMessage
        if (result?.steps && Array.isArray(result.steps)) {
          result.steps.forEach((step: any) => {
            // Check for transaction hash in various possible fields
            const txHash = step.transactionHash || step.txHash || step.hash;
            if (txHash || step.explorerUrl) {
              // Determine network from step or infer from step name
              let network = step.chain || fromNetwork;
              // Try to infer network from step name if not provided
              if (!network || network === fromNetwork) {
                const stepName = (step.name || step.type || step.stepName || '').toLowerCase();
                if (stepName.includes('burn') || stepName.includes('ethereum') || stepName.includes('sepolia')) {
                  network = 'ethereumSepolia';
                } else if (stepName.includes('mint') || stepName.includes('arc')) {
                  network = 'arcTestnet';
                }
              }
              
              const explorerUrl = step.explorerUrl || 
                (network === 'ethereumSepolia' || fromNetwork === 'ethereumSepolia'
                  ? `https://sepolia.etherscan.io/tx/${txHash}`
                  : `https://testnet.arcscan.app/tx/${txHash}`);
              
              // Map step state to transaction status
              // Bridge Kit step states: 'success', 'error', 'pending'
              let status: 'pending' | 'success' | 'failed' = 'pending';
              if (step.state === 'success') {
                status = 'success';
              } else if (step.state === 'error' || step.errorMessage) {
                status = 'failed';
              }
              
              transactions.push({
                hash: txHash || '',
                network: SUPPORTED_NETWORKS[network as keyof typeof SUPPORTED_NETWORKS]?.name || network,
                explorerUrl,
                status,
                step: step.name || step.type || step.stepName || 'Transaction',
              });
            }
          });
        }
        
        // Log detailed bridge information for debugging
        console.log('[useBridge] Bridge steps detail:', {
          totalSteps: result?.steps?.length || 0,
          steps: result?.steps?.map((s: any) => ({
            name: s.name || s.type || s.stepName,
            state: s.state,
            txHash: s.transactionHash || s.txHash || s.hash,
            error: s.errorMessage,
            chain: s.chain,
          })),
          transactions: transactions.map(tx => ({
            step: tx.step,
            network: tx.network,
            hash: tx.hash,
            status: tx.status,
          })),
        });

        // Check if this was a timeout result
        if (result?.timeout) {
          console.log('[useBridge] Handling timeout result...');
          setState({ 
            isBridging: false, 
            error: result.error || 'Bridge operation timeout',
            result,
            transactions: [],
          });
          toast.warning('Bridge operation timeout', {
            description: 'The bridge is taking longer than expected. Your transaction may still be processing. Please check the blockchain explorer for status.',
            duration: 10000,
          });
          return;
        }

        // Check result state - Bridge Kit returns: 'pending', 'success', or 'error'
        const resultState = result?.state || result?.status;
        const allStepsSuccess = result?.steps?.every((step: any) => step.state === 'success') || false;
        const hasSuccessfulSteps = result?.steps?.some((step: any) => step.state === 'success') || false;
        
        console.log('[useBridge] Bridge result analysis:', {
          resultState,
          allStepsSuccess,
          hasSuccessfulSteps,
          transactionsCount: transactions.length,
          steps: result?.steps?.map((s: any) => ({ name: s.name, state: s.state, txHash: s.transactionHash || s.txHash }))
        });

        // According to Circle Bridge Kit docs:
        // - state can be: 'pending', 'success', 'error'
        // - If state is 'pending' but we have successful steps, the bridge is in progress
        // - We should always stop bridging and show transactions if they exist
        
        // Always stop bridging if we have transactions or if state is not pending
        if (transactions.length > 0 || resultState !== 'pending') {
          // If we have transactions, verify their status on blockchain
          let finalTransactions = transactions;
          if (transactions.length > 0) {
            console.log('[useBridge] Checking transaction statuses on blockchain...');
            try {
              finalTransactions = await Promise.all(
                transactions.map(async (tx) => {
                  if (tx.hash) {
                    try {
                      const networkKey = tx.network === 'Ethereum Sepolia' ? 'ethereumSepolia' : 'arcTestnet';
                      const blockchainStatus = await checkTransactionStatusHelper(tx.hash, networkKey as BridgeNetwork);
                      console.log(`[useBridge] Transaction ${tx.hash.slice(0, 10)}... status:`, blockchainStatus);
                      // Use blockchain status if available, otherwise keep step status
                      return { ...tx, status: blockchainStatus !== 'pending' ? blockchainStatus : tx.status };
                    } catch (error) {
                      console.error(`[useBridge] Error checking transaction ${tx.hash}:`, error);
                      return tx;
                    }
                  }
                  return tx;
                })
              );
            } catch (error) {
              console.error('[useBridge] Error checking transactions:', error);
              // Continue with original transactions if check fails
            }
          }

          // Update state - always stop bridging
          setState({ 
            isBridging: false, 
            error: null, 
            result,
            transactions: finalTransactions,
          });

          // Determine success based on result state and transaction statuses
          const hasSuccessfulTxs = finalTransactions.some(tx => tx.status === 'success');
          const allTxsSuccessful = finalTransactions.length > 0 && finalTransactions.every(tx => tx.status === 'success');
          
          // Check if we have both burn (source) and mint (destination) transactions
          const burnTx = finalTransactions.find(tx => 
            tx.step.toLowerCase().includes('burn') || 
            (tx.network === 'Ethereum Sepolia' && fromNetwork === 'ethereumSepolia')
          );
          const mintTx = finalTransactions.find(tx => 
            tx.step.toLowerCase().includes('mint') || 
            (tx.network === 'Arc Testnet' && toNetwork === 'arcTestnet')
          );
          
          const hasBurn = burnTx && burnTx.status === 'success';
          const hasMint = mintTx && mintTx.status === 'success';
          
          console.log('[useBridge] Bridge completion check:', {
            resultState,
            allStepsSuccess,
            allTxsSuccessful,
            hasBurn,
            hasMint,
            burnTx: burnTx ? { step: burnTx.step, status: burnTx.status } : null,
            mintTx: mintTx ? { step: mintTx.step, status: mintTx.status } : null,
          });
          
          if (resultState === 'success' || (allStepsSuccess && hasMint)) {
            // Bridge fully completed
            toast.success('Bridge completed successfully!', {
              description: `Transferred ${amount} USDC from ${SUPPORTED_NETWORKS[fromNetwork].name} to ${SUPPORTED_NETWORKS[toNetwork].name}. Check your balance on ${SUPPORTED_NETWORKS[toNetwork].name}.`,
              duration: 8000,
            });
          } else if (resultState === 'error' || resultState === 'failed') {
            const errorMsg = result?.error || result?.errorMessage || result?.message || 'Bridge failed';
            setState(prev => ({ ...prev, error: errorMsg }));
            toast.error('Bridge failed', {
              description: errorMsg,
              duration: 10000,
            });
          } else if (hasBurn && !hasMint) {
            // Burn completed but mint is pending (waiting for attestation)
            toast.warning('Bridge in progress - waiting for mint', {
              description: `Burn completed on ${SUPPORTED_NETWORKS[fromNetwork].name}. Waiting for Circle attestation and mint on ${SUPPORTED_NETWORKS[toNetwork].name}. This can take 5-10 minutes.`,
              duration: 12000,
            });
          } else if (hasSuccessfulTxs || hasSuccessfulSteps) {
            // Some steps succeeded, bridge is in progress
            toast.info('Bridge transaction submitted!', {
              description: `Check transactions below for status. The bridge process may take 5-10 minutes to complete.`,
              duration: 10000,
            });
          } else {
            // Pending state with transactions - show info
            toast.info('Bridge operation in progress', {
              description: `Check transactions below for status. The bridge process may take 5-10 minutes to complete.`,
              duration: 10000,
            });
          }
        } else {
          // No transactions and pending state - this shouldn't happen, but handle it
          console.warn('[useBridge] No transactions found and state is pending. This may indicate an issue.');
          setState({ 
            isBridging: false, 
            error: 'Bridge operation did not return any transactions',
            result,
            transactions: [],
          });
          toast.error('Bridge operation incomplete', {
            description: 'No transactions were returned. Please check your wallet and try again.',
          });
        }
      } catch (error: any) {
        let errorMsg = error?.message || 'An unexpected error occurred';
        
        // Handle CORS errors from Circle API
        if (errorMsg.includes('CORS') || errorMsg.includes('Access-Control-Allow-Origin') || 
            error?.name === 'TypeError' && error?.message?.includes('fetch')) {
          errorMsg = 'CORS error: Circle API is blocking requests. This may be a temporary issue. Please try again or contact support.';
          console.error('[useBridge] CORS error detected:', error);
        }
        
        // Handle BigInt serialization errors
        if (errorMsg.includes('BigInt') || errorMsg.includes('serialize')) {
          errorMsg = 'Serialization error occurred. Please try again.';
          console.error('[useBridge] BigInt serialization error:', error);
        }
        
        setState({ 
          isBridging: false, 
          error: errorMsg, 
          result: null,
          transactions: [],
        });
        toast.error('Bridge error', {
          description: errorMsg,
          duration: 10000,
        });
        console.error('Bridge error:', error);
      }
    },
    [isConnected, address, walletClient]
  );

  const estimate = useCallback(
    async ({ fromNetwork, toNetwork, amount, transferSpeed = TRANSFER_SPEED.FAST }: BridgeParams) => {
      if (!isConnected || !address || !walletClient) {
        return null;
      }

      try {
        const kit = new BridgeKit();
        const provider = (window as any).ethereum;
        if (!provider) {
          return null;
        }

        // Arc Testnet chain definition (reused for estimate)
        const arcTestnetEstimate = defineChain({
          id: 5042002,
          name: 'Arc Testnet',
          nativeCurrency: { name: 'Ethereum', symbol: 'ETH', decimals: 18 },
          rpcUrls: {
            default: { http: ['https://rpc.testnet.arc.network'] },
          },
          blockExplorers: {
            default: { name: 'Arc Explorer', url: 'https://testnet.arcscan.app' },
          },
          testnet: true,
        });

        const adapter = await createAdapterFromProvider({
          provider,
          getPublicClient: async (chain) => {
            // Create appropriate public client based on chain
            const { createPublicClient, http } = await import('viem');
            const { sepolia } = await import('viem/chains');
            const { defineChain } = await import('viem');
            
            // Log full chain object for debugging (with BigInt support)
            console.log('[useBridge] getPublicClient (estimate) called with chain:', {
              chain,
              type: typeof chain,
              isObject: typeof chain === 'object' && chain !== null,
              keys: typeof chain === 'object' && chain !== null ? Object.keys(chain as any) : [],
              stringified: safeStringify(chain),
            });
            
            // Check chain ID first (most reliable) - check multiple possible fields
            let chainId: number | null = null;
            if (typeof chain === 'object' && chain !== null) {
              const chainObj = chain as any;
              chainId = chainObj.id || chainObj.chainId || chainObj.chain_id || chainObj.networkId || null;
              
              // Also check nested objects
              if (!chainId && chainObj.chain) {
                chainId = chainObj.chain.id || chainObj.chain.chainId || chainObj.chain.chain_id || null;
              }
            } else if (typeof chain === 'number') {
              chainId = chain;
            }
            
            // Also check by name if chainId not found
            let chainName: string | null = null;
            if (typeof chain === 'object' && chain !== null) {
              const chainObj = chain as any;
              chainName = chainObj.name || chainObj.network || chainObj.chainName || null;
              if (!chainName && chainObj.chain) {
                chainName = chainObj.chain.name || chainObj.chain.network || null;
              }
            }
            
            console.log('[useBridge] Extracted chain info (estimate):', { chainId, chainName });
            
            // Determine which chain to use by ID
            if (chainId === sepolia.id || chainId === 11155111) {
              console.log('[useBridge] Using Ethereum Sepolia public client (estimate, by chainId:', chainId, ')');
              return createPublicClient({ 
                chain: sepolia, 
                transport: http('https://ethereum-sepolia-rpc.publicnode.com', { timeout: 10000 }) 
              }) as any;
            } else if (chainId === arcTestnetEstimate.id || chainId === 5042002) {
              console.log('[useBridge] Using Arc Testnet public client (estimate, by chainId:', chainId, ')');
              return createPublicClient({ 
                chain: arcTestnetEstimate, 
                transport: http('https://rpc.testnet.arc.network', { timeout: 10000 }) 
              }) as any;
            }
            
            // Try to determine by name
            if (chainName) {
              const nameLower = chainName.toLowerCase();
              if (nameLower.includes('sepolia') || nameLower.includes('ethereum') && nameLower.includes('sepolia')) {
                console.log('[useBridge] Using Ethereum Sepolia public client (estimate, by name:', chainName, ')');
                return createPublicClient({ 
                  chain: sepolia, 
                  transport: http('https://ethereum-sepolia-rpc.publicnode.com', { timeout: 10000 }) 
                }) as any;
              } else if (nameLower.includes('arc') && nameLower.includes('testnet')) {
                console.log('[useBridge] Using Arc Testnet public client (estimate, by name:', chainName, ')');
                return createPublicClient({ 
                  chain: arcTestnetEstimate, 
                  transport: http('https://rpc.testnet.arc.network', { timeout: 10000 }) 
                }) as any;
              }
            }
            
            // Fallback: try to determine by string representation
            const chainStr = String(chain).toLowerCase();
            if (chainStr.includes('ethereum') && chainStr.includes('sepolia')) {
              console.log('[useBridge] Using Ethereum Sepolia public client (estimate, by string)');
              return createPublicClient({ 
                chain: sepolia, 
                transport: http('https://ethereum-sepolia-rpc.publicnode.com', { timeout: 10000 }) 
              }) as any;
            } else if (chainStr.includes('arc') && chainStr.includes('testnet')) {
              console.log('[useBridge] Using Arc Testnet public client (estimate, by string)');
              return createPublicClient({ 
                chain: arcTestnetEstimate, 
                transport: http('https://rpc.testnet.arc.network', { timeout: 10000 }) 
              }) as any;
            }
            
            // Last resort: create a generic client based on chainId if available
            if (chainId) {
              console.log('[useBridge] Creating generic public client (estimate) for chainId:', chainId);
              const genericChain = defineChain({
                id: chainId,
                name: 'Unknown Chain',
                nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
                rpcUrls: {
                  default: { http: chainId === 11155111 ? ['https://ethereum-sepolia-rpc.publicnode.com'] : ['https://rpc.testnet.arc.network'] },
                },
              });
              return createPublicClient({ 
                chain: genericChain, 
                transport: http(chainId === 11155111 ? 'https://ethereum-sepolia-rpc.publicnode.com' : 'https://rpc.testnet.arc.network', { timeout: 10000 }) 
              }) as any;
            }
            
            // If we can't determine the chain, try to use the chain object directly if it's a valid viem chain
            if (typeof chain === 'object' && chain !== null) {
              try {
                console.log('[useBridge] Attempting to use chain object directly (estimate)');
                return createPublicClient({ 
                  chain: chain as any, 
                  transport: http('https://rpc.testnet.arc.network', { timeout: 10000 }) 
                }) as any;
              } catch (err) {
                console.error('[useBridge] Failed to use chain object directly (estimate):', err);
              }
            }
            
            // If we can't determine the chain, throw an error instead of returning undefined
            console.error('[useBridge] Cannot determine chain for public client (estimate):', {
              chain,
              chainId,
              chainName,
              type: typeof chain,
              stringified: safeStringify(chain),
            });
            throw new Error(`Unsupported chain: ${safeStringify(chain)}. Please use Ethereum Sepolia or Arc Testnet.`);
          },
        });

        const fromChain = SUPPORTED_NETWORKS[fromNetwork].bridgeKitChain;
        const toChain = SUPPORTED_NETWORKS[toNetwork].bridgeKitChain;

        const estimate = await kit.estimate({
          from: {
            adapter,
            chain: fromChain,
          },
          to: {
            adapter,
            chain: toChain,
          },
          amount,
          config: {
            transferSpeed,
          },
          token: 'USDC',
        });

        return estimate;
      } catch (error) {
        console.error('Estimate error:', error);
        return null;
      }
    },
    [isConnected, address, walletClient]
  );

  // Function to check transaction status by hash (exposed for external use)
  const checkTransactionStatus = useCallback(
    async (txHash: string, network: BridgeNetwork): Promise<'success' | 'failed' | 'pending'> => {
      return checkTransactionStatusHelper(txHash, network);
    },
    []
  );

  // Function to check if bridge mint was completed by checking destination balance
  const checkBridgeCompletion = useCallback(
    async (
      burnTxHash: string,
      fromNetwork: BridgeNetwork,
      toNetwork: BridgeNetwork,
      expectedAmount: string,
      userAddress: string
    ): Promise<{ completed: boolean; mintTxHash?: string; error?: string }> => {
      try {
        // First, verify burn transaction was successful
        const burnStatus = await checkTransactionStatusHelper(burnTxHash, fromNetwork);
        if (burnStatus !== 'success') {
          return { completed: false, error: 'Burn transaction not confirmed' };
        }

        // For Arc Testnet, check native USDC balance
        if (toNetwork === 'arcTestnet') {
          const arcTestnet = defineChain({
            id: 5042002,
            name: 'Arc Testnet',
            nativeCurrency: { name: 'Ethereum', symbol: 'ETH', decimals: 18 },
            rpcUrls: {
              default: { http: ['https://rpc.testnet.arc.network'] },
            },
            blockExplorers: {
              default: { name: 'Arc Explorer', url: 'https://testnet.arcscan.app' },
            },
            testnet: true,
          });

          const publicClient = createPublicClient({
            chain: arcTestnet,
            transport: http('https://rpc.testnet.arc.network', { timeout: 10000 }),
          });

          // Check balance (this is a simplified check - in production, you'd want to check
          // the actual mint transaction from CCTP contracts)
          const balance = await publicClient.getBalance({
            address: userAddress as `0x${string}`,
          });

          // Convert expected amount to wei (18 decimals for Arc Testnet)
          const expectedAmountWei = BigInt(Math.floor(parseFloat(expectedAmount) * 1e18));

          // Note: This is a basic check. In production, you should check the actual
          // mint transaction from TokenMinterV2 contract events
          console.log('[useBridge] Bridge completion check:', {
            burnTxHash,
            expectedAmount,
            expectedAmountWei: expectedAmountWei.toString(),
            currentBalance: balance.toString(),
            balanceIncreased: balance >= expectedAmountWei,
          });

          // If balance increased by expected amount, mint likely completed
          // (This is a heuristic - proper check would query CCTP events)
          return {
            completed: balance >= expectedAmountWei,
            error: balance < expectedAmountWei ? 'Mint not yet completed or balance mismatch' : undefined
          };
        }

        return { completed: false, error: 'Destination network not supported for completion check' };
      } catch (error: any) {
        console.error('[useBridge] Error checking bridge completion:', error);
        return { completed: false, error: error?.message || 'Failed to check bridge completion' };
      }
    },
    []
  );

  // Auto-poll for attestation and mint when ready
  useEffect(() => {
    if (!burnTxHash || !isPollingAttestation || !address) {
      return;
    }

    console.log('[useBridge] Starting attestation polling for tx:', burnTxHash);

    let attempts = 0;
    const maxAttempts = 30; // Poll for max 15 minutes (30 * 30s = 900s)

    const pollAttestation = async () => {
      attempts++;
      console.log(`[useBridge] Polling attestation attempt ${attempts}/${maxAttempts}`);

      try {
        const attestationResult = await getAttestationHelper(burnTxHash, 0);

        if (!attestationResult) {
          console.log('[useBridge] No attestation result, will retry...');
          return;
        }

        if (attestationResult.status === 'complete' && attestationResult.attestation && attestationResult.message) {
          console.log('[useBridge] Attestation ready! Auto-minting on Arc Testnet...');

          // Stop polling
          if (attestationPollingRef.current) {
            clearInterval(attestationPollingRef.current);
            attestationPollingRef.current = null;
          }
          setIsPollingAttestation(false);

          // Show success notification for attestation
          toast.success('Attestation готов!', {
            description: 'Начинаем mint USDC на Arc Testnet...',
            duration: 5000,
          });

          // Auto-mint on Arc Testnet using MessageTransmitter.receiveMessage
          try {
            if (!walletClient) {
              throw new Error('Wallet not connected');
            }

            // Call receiveMessage on Arc Testnet MessageTransmitter
            const mintTxHash = await walletClient.writeContract({
              address: CCTP_CONTRACTS.arcTestnet.MessageTransmitter,
              abi: MESSAGE_TRANSMITTER_ABI,
              functionName: 'receiveMessage',
              args: [attestationResult.message as `0x${string}`, attestationResult.attestation as `0x${string}`],
              chain: {
                id: 5042002,
                name: 'Arc Testnet',
                nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
                rpcUrls: {
                  default: { http: ['https://rpc.testnet.arc.network'] },
                },
              },
            });

            console.log('[useBridge] Mint transaction submitted:', mintTxHash);

            // Show success notification
            toast.success('Mint запущен!', {
              description: `USDC минтятся на Arc Testnet. Tx: ${mintTxHash.slice(0, 10)}...${mintTxHash.slice(-8)}`,
              duration: 10000,
            });

            // Add mint transaction to the list
            setState(prev => ({
              ...prev,
              transactions: [
                ...prev.transactions,
                {
                  hash: mintTxHash,
                  network: 'Arc Testnet',
                  explorerUrl: `https://testnet.arcscan.app/tx/${mintTxHash}`,
                  status: 'pending',
                  step: 'Mint на Arc',
                },
              ],
            }));

            // Wait for confirmation
            const arcTestnet = defineChain({
              id: 5042002,
              name: 'Arc Testnet',
              nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
              rpcUrls: {
                default: { http: ['https://rpc.testnet.arc.network'] },
              },
            });

            const publicClient = createPublicClient({
              chain: arcTestnet,
              transport: http('https://rpc.testnet.arc.network'),
            });

            const receipt = await publicClient.waitForTransactionReceipt({
              hash: mintTxHash,
              timeout: 60000,
            });

            if (receipt.status === 'success') {
              toast.success('Бридж завершён!', {
                description: 'USDC успешно получены на Arc Testnet!',
                duration: 10000,
              });

              // Update transaction status
              setState(prev => ({
                ...prev,
                transactions: prev.transactions.map(tx =>
                  tx.hash === mintTxHash ? { ...tx, status: 'success' } : tx
                ),
              }));
            } else {
              throw new Error('Mint transaction failed');
            }
          } catch (mintError: any) {
            console.error('[useBridge] Auto-mint error:', mintError);
            toast.error('Mint ошибка', {
              description: mintError.message || 'Не удалось автоматически сделать mint. Попробуйте позже.',
              duration: 10000,
            });
          }

        } else {
          console.log('[useBridge] Attestation status:', attestationResult.status);
        }

        // Stop after max attempts
        if (attempts >= maxAttempts) {
          console.log('[useBridge] Max attestation polling attempts reached');
          if (attestationPollingRef.current) {
            clearInterval(attestationPollingRef.current);
            attestationPollingRef.current = null;
          }
          setIsPollingAttestation(false);

          toast.warning('Attestation занимает больше времени', {
            description: 'Проверьте статус позже. Обычно это занимает 5-15 минут.',
            duration: 10000,
          });
        }
      } catch (error) {
        console.error('[useBridge] Error polling attestation:', error);
      }
    };

    // Start polling immediately
    pollAttestation();

    // Then poll every 30 seconds (reduced to avoid 429 errors)
    attestationPollingRef.current = setInterval(pollAttestation, 30000);

    // Cleanup
    return () => {
      if (attestationPollingRef.current) {
        clearInterval(attestationPollingRef.current);
        attestationPollingRef.current = null;
      }
    };
  }, [burnTxHash, isPollingAttestation, address, walletClient]);

  return {
    bridge,
    estimate,
    checkTransactionStatus,
    checkBridgeCompletion,
    isPollingAttestation,
    ...state,
  };
};

