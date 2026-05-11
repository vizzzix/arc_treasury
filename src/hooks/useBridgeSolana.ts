import { useState, useCallback, useMemo } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { useAccount, useWalletClient } from 'wagmi';
import { BridgeKit, isKitError } from '@circle-fin/bridge-kit';
import { createAdapterFromProvider as createEVMAdapter } from '@circle-fin/adapter-viem-v2';
import { createAdapterFromProvider as createSolanaAdapter } from '@circle-fin/adapter-solana';
import { SUPPORTED_NETWORKS } from '@/lib/constants';
import { supabase } from '@/lib/supabase';

// Track Solana bridge in site_bridges
type SolanaDirection = 'sep_to_sol' | 'arc_to_sol' | 'sol_to_sep' | 'sol_to_arc';
const trackSolanaBridge = async (txHash: string, walletAddress: string, amount: string, direction: SolanaDirection) => {
  if (!supabase) return;
  try {
    await supabase.from('site_bridges').upsert({
      tx_hash: txHash.toLowerCase(),
      wallet_address: walletAddress.toLowerCase(),
      amount_usd: parseFloat(amount),
      direction,
      created_at: new Date().toISOString(),
    }, { onConflict: 'tx_hash' });
  } catch (error) {
    console.error('[useBridgeSolana] Failed to track bridge:', error);
  }
};

// Types for bridge state
export type BridgeDirection = 'evm_to_solana' | 'solana_to_evm';
export type EVMNetwork = 'ethereumSepolia' | 'arcTestnet';

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
  transactions: BridgeTransaction[];
  attestationStatus: 'idle' | 'approval' | 'burn' | 'attestation_pending' | 'mint' | 'complete' | 'pending_mint';
  attestationProgress: number;
  result: any | null;
}

interface UseBridgeSolanaReturn {
  // State
  state: BridgeState;
  isSolanaConnected: boolean;
  isEVMConnected: boolean;
  solanaAddress: string | null;
  evmAddress: string | undefined;

  // Actions
  bridgeToSolana: (fromNetwork: EVMNetwork, amount: string) => Promise<void>;
  bridgeFromSolana: (toNetwork: EVMNetwork, amount: string) => Promise<void>;
  reset: () => void;
}

const initialState: BridgeState = {
  isBridging: false,
  error: null,
  transactions: [],
  attestationStatus: 'idle',
  attestationProgress: 0,
  result: null,
};

export function useBridgeSolana(): UseBridgeSolanaReturn {
  const [state, setState] = useState<BridgeState>(initialState);

  // Solana wallet
  const { publicKey, connected: solanaConnected, wallet } = useWallet();
  const { connection } = useConnection();

  // EVM wallet
  const { address: evmAddress, isConnected: evmConnected, connector } = useAccount();
  const { data: walletClient } = useWalletClient();

  // Initialize Bridge Kit
  const bridgeKit = useMemo(() => {
    try {
      return new BridgeKit();
    } catch (error) {
      console.error('Failed to initialize BridgeKit:', error);
      return null;
    }
  }, []);

  // Get EVM provider from connector
  const getEVMProvider = useCallback(async () => {
    if (!connector) return null;
    try {
      const provider = await connector.getProvider();
      return provider;
    } catch {
      return null;
    }
  }, [connector]);

  // Get Solana provider (Phantom, Solflare, etc.)
  const getSolanaProvider = useCallback(() => {
    // Check for Phantom
    if ((window as any).phantom?.solana?.isPhantom) {
      return (window as any).phantom.solana;
    }
    // Check for Solflare
    if ((window as any).solflare?.isSolflare) {
      return (window as any).solflare;
    }
    // Generic solana provider
    if ((window as any).solana) {
      return (window as any).solana;
    }
    return null;
  }, []);

  // Bridge from EVM to Solana
  const bridgeToSolana = useCallback(async (fromNetwork: EVMNetwork, amount: string) => {
    if (!bridgeKit) {
      setState(prev => ({ ...prev, error: 'Bridge Kit not initialized' }));
      return;
    }

    if (!evmConnected) {
      setState(prev => ({ ...prev, error: 'Please connect your EVM wallet' }));
      return;
    }

    if (!solanaConnected || !publicKey) {
      setState(prev => ({ ...prev, error: 'Please connect your Solana wallet (Phantom)' }));
      return;
    }

    setState(prev => ({
      ...prev,
      isBridging: true,
      error: null,
      transactions: [],
      attestationStatus: 'approval',
      attestationProgress: 0,
    }));

    try {
      // Get EVM provider
      const evmProvider = await getEVMProvider();
      if (!evmProvider) {
        throw new Error('EVM wallet provider not available');
      }

      // Get Solana provider
      const solanaProvider = getSolanaProvider();
      if (!solanaProvider) {
        throw new Error('Solana wallet not available. Please install Phantom.');
      }

      const evmAdapter = await createEVMAdapter({ provider: evmProvider as any });

      const solanaAdapter = await createSolanaAdapter({
        provider: solanaProvider,
        connection,
      });

      const fromChain = SUPPORTED_NETWORKS[fromNetwork].bridgeKitChain;
      const toChain = SUPPORTED_NETWORKS.solanaDevnet.bridgeKitChain;

      const result = await (bridgeKit as any).bridge({
        from: { adapter: evmAdapter, chain: fromChain },
        to: { adapter: solanaAdapter, chain: toChain },
        amount: amount,
        token: 'USDC',
        onProgress: (progress: any) => {
          const eventType = progress.type || progress.event || progress.status;

          if (eventType === 'APPROVAL_STARTED' || eventType === 'approval') {
            setState(prev => ({ ...prev, attestationStatus: 'approval', attestationProgress: 10 }));
          } else if (eventType === 'APPROVAL_CONFIRMED') {
            setState(prev => ({ ...prev, attestationProgress: 25 }));
          } else if (eventType === 'BURN_STARTED' || eventType === 'burn') {
            const txHash = progress.values?.txHash || progress.txHash || progress.transactionHash || progress.hash;
            setState(prev => ({
              ...prev,
              attestationStatus: 'burn',
              attestationProgress: 30,
              transactions: txHash ? [...prev.transactions, {
                hash: txHash,
                network: fromNetwork,
                explorerUrl: `${SUPPORTED_NETWORKS[fromNetwork].explorerUrl}/tx/${txHash}`,
                status: 'pending' as const,
                step: 'Burn',
              }] : prev.transactions,
            }));
            // Track the bridge (EVM → Solana)
            if (txHash && evmAddress) {
              const direction: SolanaDirection = fromNetwork === 'ethereumSepolia' ? 'sep_to_sol' : 'arc_to_sol';
              trackSolanaBridge(txHash, evmAddress, amount, direction);
            }
          } else if (eventType === 'BURN_CONFIRMED') {
            setState(prev => ({
              ...prev,
              attestationProgress: 50,
              transactions: prev.transactions.map(tx =>
                tx.step === 'Burn' ? { ...tx, status: 'success' as const } : tx
              ),
            }));
          } else if (eventType === 'ATTESTATION_PENDING' || eventType === 'attestation') {
            setState(prev => ({ ...prev, attestationStatus: 'attestation_pending', attestationProgress: 60 }));
          } else if (eventType === 'ATTESTATION_COMPLETE') {
            setState(prev => ({ ...prev, attestationProgress: 80 }));
          } else if (eventType === 'MINT_STARTED' || eventType === 'mint') {
            const txHash = progress.values?.txHash || progress.txHash || progress.transactionHash;
            setState(prev => ({
              ...prev,
              attestationStatus: 'mint',
              attestationProgress: 85,
              transactions: txHash ? [...prev.transactions, {
                hash: txHash,
                network: 'solanaDevnet',
                explorerUrl: `https://explorer.solana.com/tx/${txHash}?cluster=devnet`,
                status: 'pending' as const,
                step: 'Mint',
              }] : prev.transactions,
            }));
          } else if (eventType === 'MINT_CONFIRMED') {
            // Mint confirmed - bridge complete! Set isBridging: false immediately
            // so UI shows success without waiting for bridge() Promise to resolve
            setState(prev => ({
              ...prev,
              isBridging: false,
              attestationStatus: 'complete',
              attestationProgress: 100,
              transactions: prev.transactions.map(tx =>
                tx.step === 'Mint' ? { ...tx, status: 'success' as const } : tx
              ),
            }));
          }
        },
      });

      // Try to track from result.steps if we didn't catch it from progress events
      const burnStep = (result as any)?.steps?.find((s: any) => s.type === 'burn' || s.step === 'burn' || s.name === 'burn');
      const resultTxHash = burnStep?.values?.txHash || burnStep?.txHash || burnStep?.transactionHash || burnStep?.hash || (result as any)?.txHash;
      if (resultTxHash && evmAddress) {
        const direction: SolanaDirection = fromNetwork === 'ethereumSepolia' ? 'sep_to_sol' : 'arc_to_sol';
        trackSolanaBridge(resultTxHash, evmAddress, amount, direction);
      }

      // Bridge completed successfully - SDK Promise resolved means bridge is done
      // Force complete state since MINT_CONFIRMED event may not fire for Solana destination

      // Force complete regardless of hasBurnTx - SDK Promise resolving means success
      setState(prev => {
        // If already complete, don't change
        if (prev.attestationStatus === 'complete') {
          return prev;
        }

        // SDK Promise resolved = success, set complete
        return {
          ...prev,
          isBridging: false,
          attestationStatus: 'complete',
          attestationProgress: 100,
          result,
        };
      });

    } catch (error: any) {
      // Detect user rejection — prefer structured errorCategory, fall back to string matching
      const errorMsg = error.message || error.toString() || '';
      const isUserRejection =
        (isKitError(error) && error.type === 'INPUT' && error.name === 'USER_REJECTED') ||
        errorMsg.toLowerCase().includes('user rejected') ||
        errorMsg.toLowerCase().includes('user denied') ||
        errorMsg.toLowerCase().includes('user cancelled') ||
        errorMsg.toLowerCase().includes('rejected by user') ||
        errorMsg.includes('4001') ||
        errorMsg.includes('ACTION_REJECTED');

      setState(prev => {
        // If already complete (MINT_CONFIRMED fired before error), don't change state
        if (prev.attestationStatus === 'complete') {
          return prev;
        }

        // If we reached mint stage (progress >= 80), the bridge likely succeeded
        // SDK may throw errors during cleanup after successful mint
        if (prev.attestationProgress >= 80 || prev.attestationStatus === 'mint') {
          return {
            ...prev,
            isBridging: false,
            attestationStatus: 'complete',
            attestationProgress: 100,
          };
        }

        // Check if burn already happened - if so, show pending_mint state for recovery
        const hasBurnTx = prev.transactions.some(tx => tx.step === 'Burn');
        if (hasBurnTx) {
          // Burn happened but mint failed - show pending_mint for manual claim
          return {
            ...prev,
            isBridging: false,
            error: isUserRejection
              ? 'Mint cancelled. Your USDC was burned - use the burn tx hash to claim manually.'
              : `Bridge failed after burn: ${error.message}. Use burn tx hash to claim.`,
            attestationStatus: 'pending_mint',
            attestationProgress: 70,
          };
        }
        // No burn yet - safe to reset to idle
        return {
          ...prev,
          isBridging: false,
          error: isUserRejection ? 'Transaction cancelled by user' : (error.message || 'Bridge failed'),
          attestationStatus: 'idle',
          attestationProgress: 0,
        };
      });
    }
  }, [bridgeKit, evmConnected, solanaConnected, publicKey, getEVMProvider, getSolanaProvider, connection, evmAddress]);

  // Bridge from Solana to EVM
  const bridgeFromSolana = useCallback(async (toNetwork: EVMNetwork, amount: string) => {
    if (!bridgeKit) {
      setState(prev => ({ ...prev, error: 'Bridge Kit not initialized' }));
      return;
    }

    if (!solanaConnected || !publicKey) {
      setState(prev => ({ ...prev, error: 'Please connect your Solana wallet (Phantom)' }));
      return;
    }

    if (!evmConnected) {
      setState(prev => ({ ...prev, error: 'Please connect your EVM wallet' }));
      return;
    }

    setState(prev => ({
      ...prev,
      isBridging: true,
      error: null,
      transactions: [],
      attestationStatus: 'burn',
      attestationProgress: 0,
    }));

    try {
      // Get Solana provider
      const solanaProvider = getSolanaProvider();
      if (!solanaProvider) {
        throw new Error('Solana wallet not available. Please install Phantom.');
      }

      // Get EVM provider
      const evmProvider = await getEVMProvider();
      if (!evmProvider) {
        throw new Error('EVM wallet provider not available');
      }

      const solanaAdapter = await createSolanaAdapter({
        provider: solanaProvider,
        connection,
      });

      const evmAdapter = await createEVMAdapter({ provider: evmProvider as any });

      const fromChain = SUPPORTED_NETWORKS.solanaDevnet.bridgeKitChain;
      const toChain = SUPPORTED_NETWORKS[toNetwork].bridgeKitChain;

      const result = await (bridgeKit as any).bridge({
        from: { adapter: solanaAdapter, chain: fromChain },
        to: { adapter: evmAdapter, chain: toChain },
        amount: amount,
        token: 'USDC',
        onProgress: (progress: any) => {
          const eventType = progress.type || progress.event || progress.status;

          if (eventType === 'BURN_STARTED' || eventType === 'burn') {
            const txHash = progress.values?.txHash || progress.txHash || progress.transactionHash || progress.hash;
            setState(prev => ({
              ...prev,
              attestationStatus: 'burn',
              attestationProgress: 20,
              transactions: txHash ? [...prev.transactions, {
                hash: txHash,
                network: 'solanaDevnet',
                explorerUrl: `https://explorer.solana.com/tx/${txHash}?cluster=devnet`,
                status: 'pending' as const,
                step: 'Burn',
              }] : prev.transactions,
            }));
            // Track the bridge (Solana → EVM) using Solana wallet address
            if (txHash && publicKey) {
              const direction: SolanaDirection = toNetwork === 'ethereumSepolia' ? 'sol_to_sep' : 'sol_to_arc';
              trackSolanaBridge(txHash, publicKey.toBase58(), amount, direction);
            }
          } else if (eventType === 'BURN_CONFIRMED') {
            setState(prev => ({
              ...prev,
              attestationProgress: 40,
              transactions: prev.transactions.map(tx =>
                tx.step === 'Burn' ? { ...tx, status: 'success' as const } : tx
              ),
            }));
          } else if (eventType === 'ATTESTATION_PENDING' || eventType === 'attestation') {
            setState(prev => ({ ...prev, attestationStatus: 'attestation_pending', attestationProgress: 50 }));
          } else if (eventType === 'ATTESTATION_COMPLETE') {
            setState(prev => ({ ...prev, attestationProgress: 70 }));
          } else if (eventType === 'MINT_STARTED' || eventType === 'mint') {
            const txHash = progress.values?.txHash || progress.txHash || progress.transactionHash;
            setState(prev => ({
              ...prev,
              attestationStatus: 'mint',
              attestationProgress: 80,
              transactions: txHash ? [...prev.transactions, {
                hash: txHash,
                network: toNetwork,
                explorerUrl: `${SUPPORTED_NETWORKS[toNetwork].explorerUrl}/tx/${txHash}`,
                status: 'pending' as const,
                step: 'Mint',
              }] : prev.transactions,
            }));
          } else if (eventType === 'MINT_CONFIRMED') {
            // Mint confirmed - bridge complete! Set isBridging: false immediately
            // so UI shows success without waiting for bridge() Promise to resolve
            setState(prev => ({
              ...prev,
              isBridging: false,
              attestationStatus: 'complete',
              attestationProgress: 100,
              transactions: prev.transactions.map(tx =>
                tx.step === 'Mint' ? { ...tx, status: 'success' as const } : tx
              ),
            }));
          }
        },
      });

      // Try to track from result.steps if we didn't catch it from progress events
      const burnStep = (result as any)?.steps?.find((s: any) => s.type === 'burn' || s.step === 'burn' || s.name === 'burn');
      const resultTxHash = burnStep?.values?.txHash || burnStep?.txHash || burnStep?.transactionHash || burnStep?.hash || (result as any)?.txHash;
      if (resultTxHash && publicKey) {
        const direction: SolanaDirection = toNetwork === 'ethereumSepolia' ? 'sol_to_sep' : 'sol_to_arc';
        trackSolanaBridge(resultTxHash, publicKey.toBase58(), amount, direction);
      }

      // Bridge completed successfully - SDK Promise resolved means bridge is done

      // Force complete regardless of hasBurnTx - SDK Promise resolving means success
      setState(prev => {
        // If already complete, don't change
        if (prev.attestationStatus === 'complete') {
          return prev;
        }

        // SDK Promise resolved = success, set complete
        return {
          ...prev,
          isBridging: false,
          attestationStatus: 'complete',
          attestationProgress: 100,
          result,
        };
      });

    } catch (error: any) {
      // Detect user rejection — prefer structured errorCategory, fall back to string matching
      const errorMsg = error.message || error.toString() || '';
      const isUserRejection =
        (isKitError(error) && error.type === 'INPUT' && error.name === 'USER_REJECTED') ||
        errorMsg.toLowerCase().includes('user rejected') ||
        errorMsg.toLowerCase().includes('user denied') ||
        errorMsg.toLowerCase().includes('user cancelled') ||
        errorMsg.toLowerCase().includes('rejected by user') ||
        errorMsg.includes('4001') ||
        errorMsg.includes('ACTION_REJECTED');

      setState(prev => {
        // If already complete (MINT_CONFIRMED fired before error), don't change state
        if (prev.attestationStatus === 'complete') {
          return prev;
        }

        // If we reached mint stage (progress >= 80), the bridge likely succeeded
        // SDK may throw errors during cleanup after successful mint
        if (prev.attestationProgress >= 80 || prev.attestationStatus === 'mint') {
          return {
            ...prev,
            isBridging: false,
            attestationStatus: 'complete',
            attestationProgress: 100,
          };
        }

        // Check if burn already happened - if so, show pending_mint state for recovery
        const hasBurnTx = prev.transactions.some(tx => tx.step === 'Burn');
        if (hasBurnTx) {
          // Burn happened but mint failed - show pending_mint for manual claim
          return {
            ...prev,
            isBridging: false,
            error: isUserRejection
              ? 'Mint cancelled. Your USDC was burned - use the burn tx hash to claim manually.'
              : `Bridge failed after burn: ${error.message}. Use burn tx hash to claim.`,
            attestationStatus: 'pending_mint',
            attestationProgress: 70,
          };
        }
        // No burn yet - safe to reset to idle
        return {
          ...prev,
          isBridging: false,
          error: isUserRejection ? 'Transaction cancelled by user' : (error.message || 'Bridge failed'),
          attestationStatus: 'idle',
          attestationProgress: 0,
        };
      });
    }
  }, [bridgeKit, solanaConnected, publicKey, evmConnected, getSolanaProvider, getEVMProvider, connection]);

  // Reset state
  const reset = useCallback(() => {
    setState(initialState);
  }, []);

  return {
    state,
    isSolanaConnected: solanaConnected,
    isEVMConnected: evmConnected,
    solanaAddress: publicKey?.toBase58() || null,
    evmAddress,
    bridgeToSolana,
    bridgeFromSolana,
    reset,
  };
}

export default useBridgeSolana;
