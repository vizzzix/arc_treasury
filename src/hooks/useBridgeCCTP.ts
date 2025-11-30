/**
 * useBridgeCCTP - Circle Bridge Kit Implementation
 *
 * Uses Circle's official Bridge Kit SDK for CCTP V2 bridging.
 * Supports: Ethereum Sepolia ↔ Arc Testnet
 *
 * Benefits of Bridge Kit:
 * - Official Circle SDK with automatic updates
 * - Built-in attestation polling and error handling
 * - Arc Testnet officially supported (chainId 5042002, domain 26)
 * - Automatic approval flow
 *
 * References:
 * - Bridge Kit: https://www.npmjs.com/package/@circle-fin/bridge-kit
 * - Circle Blog: https://www.circle.com/blog/integrating-rainbowkit-with-bridge-kit-for-crosschain-usdc-transfers
 */

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useAccount, useConnectorClient, useSwitchChain, usePublicClient, useWalletClient } from 'wagmi';
import { SUPPORTED_NETWORKS, CCTP_CONTRACTS, CCTP_DOMAINS, CIRCLE_ATTESTATION_API } from '@/lib/constants';
import { toast } from 'sonner';
import { BridgeKit, Blockchain } from '@circle-fin/bridge-kit';
import { createAdapterFromProvider } from '@circle-fin/adapter-viem-v2';
// viem imports removed - using Circle API for message bytes

type BridgeNetwork = keyof typeof SUPPORTED_NETWORKS;

interface BridgeParams {
  fromNetwork: BridgeNetwork;
  toNetwork: BridgeNetwork;
  amount: string;
}

interface BridgeTransaction {
  hash: string;
  network: string;
  explorerUrl: string;
  status: 'pending' | 'success' | 'failed';
  step: string;
}

interface PendingBurn {
  txHash: string;
  fromNetwork: BridgeNetwork;
  toNetwork: BridgeNetwork;
  amount: string;
  timestamp: number;
}

interface BridgeState {
  isBridging: boolean;
  isClaiming: boolean;
  error: string | null;
  result: any | null;
  transactions: BridgeTransaction[];
  mintConfirmed: boolean;
  pendingBurn: PendingBurn | null;
}

// Map our network names to Bridge Kit Blockchain enum
const NETWORK_TO_BLOCKCHAIN: Record<BridgeNetwork, Blockchain> = {
  ethereumSepolia: Blockchain.Ethereum_Sepolia,
  arcTestnet: Blockchain.Arc_Testnet,
};

// LocalStorage key for pending burns (per wallet address)
const PENDING_BURN_STORAGE_KEY = 'arc_treasury_pending_burn';

// Helper to save pending burn to localStorage
const savePendingBurn = (address: string, pendingBurn: PendingBurn | null) => {
  try {
    if (pendingBurn) {
      const data = { [address.toLowerCase()]: pendingBurn };
      localStorage.setItem(PENDING_BURN_STORAGE_KEY, JSON.stringify(data));
    } else {
      // Remove for this address
      const stored = localStorage.getItem(PENDING_BURN_STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        delete data[address.toLowerCase()];
        if (Object.keys(data).length === 0) {
          localStorage.removeItem(PENDING_BURN_STORAGE_KEY);
        } else {
          localStorage.setItem(PENDING_BURN_STORAGE_KEY, JSON.stringify(data));
        }
      }
    }
  } catch (e) {
    console.error('[useBridgeCCTP] Failed to save pending burn:', e);
  }
};

// Helper to load pending burn from localStorage
const loadPendingBurn = (address: string): PendingBurn | null => {
  try {
    const stored = localStorage.getItem(PENDING_BURN_STORAGE_KEY);
    if (stored) {
      const data = JSON.parse(stored);
      return data[address.toLowerCase()] || null;
    }
  } catch (e) {
    console.error('[useBridgeCCTP] Failed to load pending burn:', e);
  }
  return null;
};

export const useBridgeCCTP = () => {
  const account = useAccount();
  const address = account?.address;
  const isConnected = account?.isConnected ?? false;
  const { data: connectorClient } = useConnectorClient();
  const { switchChainAsync } = useSwitchChain();

  const [state, setState] = useState<BridgeState>({
    isBridging: false,
    isClaiming: false,
    error: null,
    result: null,
    transactions: [],
    mintConfirmed: false,
    pendingBurn: null,
  });

  const [attestationStatus, setAttestationStatus] = useState<string | null>(null);

  // Use refs to track progress - avoid async state timing issues
  const mintConfirmedRef = useRef(false);
  const burnConfirmedRef = useRef(false);

  // Get public client for reading chain data
  const sepoliaClient = usePublicClient({ chainId: SUPPORTED_NETWORKS.ethereumSepolia.chainId });
  const arcClient = usePublicClient({ chainId: SUPPORTED_NETWORKS.arcTestnet.chainId });
  const { data: walletClient } = useWalletClient();

  // Initialize Bridge Kit (memoized to avoid re-creating)
  const bridgeKit = useMemo(() => {
    const kit = new BridgeKit();
    console.log('[useBridgeCCTP] Bridge Kit initialized');
    return kit;
  }, []);

  // Log supported chains on mount (debug)
  useEffect(() => {
    if (bridgeKit) {
      const chains = bridgeKit.getSupportedChains();
      console.log('[useBridgeCCTP] Supported chains:', chains.map(c => `${c.name} (${c.chain})`));

      // Verify Arc Testnet is supported
      const arcChain = chains.find(c => c.chain === Blockchain.Arc_Testnet);
      if (arcChain) {
        console.log('[useBridgeCCTP] Arc Testnet config:', arcChain);
      }
    }
  }, [bridgeKit]);

  // Load pending burn from localStorage on wallet connect
  useEffect(() => {
    if (address) {
      const savedPendingBurn = loadPendingBurn(address);
      if (savedPendingBurn) {
        console.log('[useBridgeCCTP] Loaded pending burn from storage:', savedPendingBurn);
        setState(prev => ({ ...prev, pendingBurn: savedPendingBurn }));
        setAttestationStatus('pending_mint');
        toast.info('You have unclaimed USDC!', {
          description: 'Click Claim to receive your bridged funds.',
          duration: 10000,
        });
      }
    }
  }, [address]);

  /**
   * Main bridge function using Circle Bridge Kit
   */
  const bridge = useCallback(
    async ({ fromNetwork, toNetwork, amount }: BridgeParams) => {
      if (!isConnected || !address || !connectorClient) {
        toast.error('Please connect your wallet first');
        return;
      }

      if (!amount || parseFloat(amount) <= 0) {
        toast.error('Please enter a valid amount');
        return;
      }

      // Validate networks
      const isSepoliaToArc = fromNetwork === 'ethereumSepolia' && toNetwork === 'arcTestnet';
      const isArcToSepolia = fromNetwork === 'arcTestnet' && toNetwork === 'ethereumSepolia';

      if (!isSepoliaToArc && !isArcToSepolia) {
        toast.error('Only Ethereum Sepolia ↔ Arc Testnet is supported');
        return;
      }

      setState({ isBridging: true, isClaiming: false, error: null, result: null, transactions: [], mintConfirmed: false, pendingBurn: null });
      setAttestationStatus(null);
      mintConfirmedRef.current = false;
      burnConfirmedRef.current = false;

      // Check if user is on the correct network
      const currentChainId = account.chainId;
      const requiredChainId = SUPPORTED_NETWORKS[fromNetwork].chainId;

      if (currentChainId !== requiredChainId) {
        try {
          toast.info(`Switching to ${SUPPORTED_NETWORKS[fromNetwork].name}...`);
          await switchChainAsync?.({ chainId: requiredChainId });
          toast.success('Network switched successfully!');
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error: any) {
          console.error('[useBridgeCCTP] Network switch error:', error);
          setState({ isBridging: false, error: 'Failed to switch network', result: null, transactions: [] });
          toast.error('Failed to switch network', {
            description: `Please manually switch to ${SUPPORTED_NETWORKS[fromNetwork].name} in your wallet`,
          });
          return;
        }
      }

      try {
        // Get the EIP-1193 provider from connector client
        // wagmi's connectorClient exposes transport.value or we can use window.ethereum
        const provider = (connectorClient as any)?.transport ||
                         (window as any).ethereum;

        if (!provider) {
          throw new Error('No wallet provider available');
        }

        console.log('[useBridgeCCTP] Creating adapter from provider...');

        // Create adapter using Bridge Kit's factory
        const adapter = await createAdapterFromProvider({
          provider,
        });

        console.log('[useBridgeCCTP] Adapter created successfully');

        // Bridge Kit expects human-readable amount (e.g., '20' = 20 USDC)
        // The SDK handles decimal conversion internally
        const bridgeAmount = amount;

        const fromChain = NETWORK_TO_BLOCKCHAIN[fromNetwork];
        const toChain = NETWORK_TO_BLOCKCHAIN[toNetwork];

        console.log('[useBridgeCCTP] Bridge params:', {
          from: fromChain,
          to: toChain,
          amount: bridgeAmount,
          address,
        });

        toast.info('Initiating bridge via Circle Bridge Kit...');

        // Execute bridge using Bridge Kit
        const result = await bridgeKit.bridge({
          from: {
            adapter,
            chain: fromChain,
          },
          to: {
            adapter,
            chain: toChain,
          },
          amount: bridgeAmount,
          token: 'USDC',
          onProgress: (progress: any) => {
            console.log('[useBridgeCCTP] Progress event:', JSON.stringify(progress));
            console.log('[useBridgeCCTP] Progress keys:', Object.keys(progress));

            // Handle different progress stages
            const eventType = progress.type || progress.event || progress.status || progress.stage;
            console.log('[useBridgeCCTP] Event type detected:', eventType);

            switch (eventType) {
              case 'approval':
              case 'APPROVAL_STARTED':
                toast.info('Approving USDC...');
                break;

              case 'APPROVAL_CONFIRMED':
                toast.success('USDC approved!');
                break;

              case 'burn':
              case 'BURN_STARTED':
                toast.info('Burning USDC on source chain...');
                if (progress.txHash || progress.transactionHash) {
                  const hash = progress.txHash || progress.transactionHash;
                  setState(prev => ({
                    ...prev,
                    transactions: [{
                      hash,
                      network: SUPPORTED_NETWORKS[fromNetwork].name,
                      explorerUrl: `${SUPPORTED_NETWORKS[fromNetwork].explorerUrl}/tx/${hash}`,
                      status: 'pending',
                      step: 'Burn',
                    }],
                  }));
                }
                break;

              case 'BURN_CONFIRMED':
                toast.success('Burn confirmed!');
                burnConfirmedRef.current = true;
                setState(prev => ({
                  ...prev,
                  transactions: prev.transactions.map(tx => ({ ...tx, status: 'success' as const })),
                }));
                break;

              case 'attestation':
              case 'ATTESTATION_PENDING':
                // If we're waiting for attestation, burn must have been confirmed
                burnConfirmedRef.current = true;
                setAttestationStatus('pending');
                toast.info('Waiting for Circle attestation (~2-3 min)...');
                break;

              case 'ATTESTATION_COMPLETE':
                // Don't set 'complete' here - attestation is ready but mint hasn't happened yet
                // Burn definitely happened if attestation is complete
                burnConfirmedRef.current = true;
                setAttestationStatus('attested');
                toast.success('Attestation received! Starting mint...');
                break;

              case 'mint':
              case 'MINT_STARTED':
                toast.info('Minting USDC on destination chain...');
                if (progress.txHash || progress.transactionHash) {
                  const hash = progress.txHash || progress.transactionHash;
                  setState(prev => ({
                    ...prev,
                    transactions: [
                      ...prev.transactions,
                      {
                        hash,
                        network: SUPPORTED_NETWORKS[toNetwork].name,
                        explorerUrl: `${SUPPORTED_NETWORKS[toNetwork].explorerUrl}/tx/${hash}`,
                        status: 'pending',
                        step: 'Mint',
                      },
                    ],
                  }));
                }
                break;

              case 'MINT_CONFIRMED':
              case 'complete':
                toast.success('Mint confirmed!');
                mintConfirmedRef.current = true;
                setState(prev => ({ ...prev, mintConfirmed: true }));
                break;

              default:
                console.log('[useBridgeCCTP] Unknown progress event:', eventType);
            }
          },
        });

        console.log('[useBridgeCCTP] Bridge result:', result);
        console.log('[useBridgeCCTP] Result state:', result?.state);
        console.log('[useBridgeCCTP] Result steps:', result?.steps);

        // Analyze result.steps to determine what happened
        const steps = result?.steps || [];
        const burnStep = steps.find((s: any) => s.name?.toLowerCase().includes('burn'));
        console.log('[useBridgeCCTP] Burn step details:', JSON.stringify(burnStep, null, 2));
        const mintStep = steps.find((s: any) => s.name?.toLowerCase().includes('mint'));

        const burnSucceeded = burnStep?.state === 'success';
        const mintSucceeded = mintStep?.state === 'success';

        console.log('[useBridgeCCTP] burnSucceeded:', burnSucceeded, 'mintSucceeded:', mintSucceeded);

        // Check overall result state
        if (result?.state === 'success') {
          // Full success
          setAttestationStatus('confirming');
          toast.info('Transaction sent, waiting for confirmation...');
          await new Promise(resolve => setTimeout(resolve, 6000));

          setAttestationStatus('complete');
          toast.success('Bridge completed successfully!', {
            description: `Your USDC has been transferred to ${SUPPORTED_NETWORKS[toNetwork].name}`,
            duration: 10000,
          });
          setState(prev => ({
            ...prev,
            isBridging: false,
            result,
            mintConfirmed: true,
            transactions: prev.transactions.map(tx => ({ ...tx, status: 'success' as const })),
          }));
        } else if (burnSucceeded && !mintSucceeded) {
          // Burn succeeded but mint failed - funds are pending!
          console.log('[useBridgeCCTP] Burn succeeded but mint failed - funds are pending');
          // Try to get burn tx hash from step, or fallback to transactions state
          const burnTxHash = burnStep?.txHash || burnStep?.transactionHash;
          console.log('[useBridgeCCTP] Burn tx hash from step:', burnTxHash);

          setAttestationStatus('pending_mint');
          toast.warning('Your funds are safe!', {
            description: 'Burn completed. Click Claim to receive your USDC.',
            duration: 15000,
          });

          const newPendingBurn = burnTxHash ? {
            txHash: burnTxHash,
            fromNetwork,
            toNetwork,
            amount,
            timestamp: Date.now(),
          } : null;

          // Save to localStorage so it persists across page refresh
          if (newPendingBurn && address) {
            savePendingBurn(address, newPendingBurn);
          }

          setState(prev => ({
            ...prev,
            isBridging: false,
            error: 'Mint was not completed. Your funds are safe - click Claim USDC.',
            result: null,
            mintConfirmed: false,
            pendingBurn: newPendingBurn,
          }));
        } else {
          // No burn happened - cancelled early
          console.log('[useBridgeCCTP] Bridge returned but burn was not successful');
          setAttestationStatus(null);
          toast.error('Bridge cancelled', {
            description: 'Transaction was not completed.',
            duration: 5000,
          });
          setState(prev => ({
            ...prev,
            isBridging: false,
            error: 'Transaction was cancelled',
            result: null,
            transactions: [],
            mintConfirmed: false,
          }));
        }

      } catch (error: any) {
        console.error('[useBridgeCCTP] Bridge error:', error);
        console.log('[useBridgeCCTP] Error object:', JSON.stringify(error, null, 2));
        console.log('[useBridgeCCTP] Error steps:', error?.steps);
        console.log('[useBridgeCCTP] On error - burnConfirmed ref:', burnConfirmedRef.current);

        let errorMsg = error?.message || 'An unexpected error occurred';

        // Handle common errors
        if (errorMsg.includes('User rejected') || errorMsg.includes('user rejected') || errorMsg.includes('User denied')) {
          errorMsg = 'Transaction rejected by user';
        } else if (errorMsg.includes('insufficient funds')) {
          errorMsg = 'Insufficient funds for gas';
        } else if (errorMsg.includes('allowance')) {
          errorMsg = 'Token approval failed';
        }

        // Check if error contains steps info (Bridge Kit may include partial result in error)
        const errorSteps = error?.steps || error?.result?.steps || [];
        const burnStep = errorSteps.find((s: any) => s.name?.toLowerCase().includes('burn'));
        const burnSucceededInError = burnStep?.state === 'success';

        console.log('[useBridgeCCTP] Burn step in error:', burnStep);
        console.log('[useBridgeCCTP] burnSucceededInError:', burnSucceededInError);

        // Check if burn was confirmed (either from ref or from error steps)
        if (burnConfirmedRef.current || burnSucceededInError) {
          console.log('[useBridgeCCTP] Burn was confirmed before error - funds are safe');
          const burnTxHash = burnStep?.txHash || burnStep?.transactionHash;
          console.log('[useBridgeCCTP] Burn tx hash from error:', burnTxHash);

          setAttestationStatus('pending_mint');
          toast.warning('Your funds are safe!', {
            description: 'Burn completed. Click Claim to receive your USDC.',
            duration: 15000,
          });

          const newPendingBurn = burnTxHash ? {
            txHash: burnTxHash,
            fromNetwork,
            toNetwork,
            amount,
            timestamp: Date.now(),
          } : null;

          // Save to localStorage so it persists across page refresh
          if (newPendingBurn && address) {
            savePendingBurn(address, newPendingBurn);
          }

          setState(prev => ({
            ...prev,
            isBridging: false,
            error: 'Mint was not completed. Your funds are safe - click Claim USDC.',
            result: null,
            mintConfirmed: false,
            pendingBurn: newPendingBurn,
          }));
          return;
        }

        // No burn happened - regular error
        setAttestationStatus(null);

        setState(prev => ({
          ...prev,
          isBridging: false,
          error: errorMsg,
          result: null,
          transactions: [],
          mintConfirmed: false,
        }));

        toast.error('Bridge cancelled', {
          description: errorMsg,
          duration: 10000,
        });
      }
    },
    [isConnected, address, connectorClient, switchChainAsync, account.chainId, bridgeKit]
  );

  /**
   * Complete bridge - Bridge Kit handles this automatically
   * Kept for backwards compatibility with UI
   */
  const completeBridge = useCallback(async () => {
    // Bridge Kit handles the full flow (burn → attestation → mint) automatically
    // This function is kept for UI compatibility but doesn't need to do anything
    toast.info('Bridge Kit handles the complete flow automatically');
  }, []);

  /**
   * Claim pending USDC from a burn that didn't complete mint
   * This fetches the attestation from Circle API and calls receiveMessage on destination chain
   */
  const claimPendingBridge = useCallback(async () => {
    const pendingBurn = state.pendingBurn;
    if (!pendingBurn) {
      toast.error('No pending burn to claim');
      return;
    }

    if (!walletClient || !address) {
      toast.error('Please connect your wallet');
      return;
    }

    const { txHash, fromNetwork, toNetwork } = pendingBurn;
    console.log('[useBridgeCCTP] Claiming pending bridge:', pendingBurn);

    setState(prev => ({ ...prev, isClaiming: true, error: null }));

    try {
      // Determine source and destination
      const sourceDomain = CCTP_DOMAINS[fromNetwork];
      const destNetwork = toNetwork;
      const destContracts = CCTP_CONTRACTS[destNetwork];

      console.log('[useBridgeCCTP] Source domain:', sourceDomain);
      console.log('[useBridgeCCTP] Dest network:', destNetwork);

      // Step 1: Fetch attestation from Circle API (includes message bytes)
      toast.info('Fetching attestation from Circle...');

      const attestationUrl = `${CIRCLE_ATTESTATION_API}/${sourceDomain}?transactionHash=${txHash}`;
      console.log('[useBridgeCCTP] Attestation URL:', attestationUrl);

      const attestationResponse = await fetch(attestationUrl);
      const attestationData = await attestationResponse.json();
      console.log('[useBridgeCCTP] Attestation response:', attestationData);

      if (!attestationData.messages || attestationData.messages.length === 0) {
        throw new Error('Attestation not ready yet. Please try again in a few minutes.');
      }

      const messageData = attestationData.messages[0];
      const attestation = messageData.attestation;
      const messageBytes = messageData.message; // Circle API returns the message bytes!

      if (!attestation || attestation === 'PENDING') {
        throw new Error('Attestation still pending. Please try again in a few minutes.');
      }

      if (!messageBytes) {
        throw new Error('Message bytes not found in attestation response');
      }

      console.log('[useBridgeCCTP] Got message:', messageBytes);
      console.log('[useBridgeCCTP] Got attestation:', attestation);

      // Step 3: Switch to destination network if needed
      const destChainId = SUPPORTED_NETWORKS[destNetwork].chainId;
      if (account.chainId !== destChainId) {
        toast.info(`Switching to ${SUPPORTED_NETWORKS[destNetwork].name}...`);
        await switchChainAsync?.({ chainId: destChainId });
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Step 4: Call receiveMessage on MessageTransmitter
      toast.info('Claiming your USDC...');

      // MessageTransmitter ABI for receiveMessage
      const messageTransmitterABI = [
        {
          name: 'receiveMessage',
          type: 'function',
          stateMutability: 'nonpayable',
          inputs: [
            { name: 'message', type: 'bytes' },
            { name: 'attestation', type: 'bytes' }
          ],
          outputs: [{ name: 'success', type: 'bool' }]
        }
      ] as const;

      const hash = await walletClient.writeContract({
        address: destContracts.MessageTransmitter,
        abi: messageTransmitterABI,
        functionName: 'receiveMessage',
        args: [messageBytes as `0x${string}`, attestation as `0x${string}`],
      });

      console.log('[useBridgeCCTP] Claim tx hash:', hash);
      toast.info('Waiting for confirmation...');

      // Wait for confirmation
      const destClient = destNetwork === 'arcTestnet' ? arcClient : sepoliaClient;
      if (destClient) {
        await destClient.waitForTransactionReceipt({ hash });
      }

      // Success - clear from localStorage
      if (address) {
        savePendingBurn(address, null);
      }

      toast.success('USDC claimed successfully!', {
        description: `Your ${pendingBurn.amount} USDC has been received.`,
        duration: 10000,
      });

      setAttestationStatus('complete');
      setState(prev => ({
        ...prev,
        isClaiming: false,
        mintConfirmed: true,
        pendingBurn: null,
        error: null,
      }));

    } catch (error: any) {
      console.error('[useBridgeCCTP] Claim error:', error);

      let errorMsg = error?.message || 'Failed to claim USDC';

      if (errorMsg.includes('already received') || errorMsg.includes('Nonce already used')) {
        errorMsg = 'This transfer has already been claimed!';
        // Clear pending burn since it's already claimed - also from localStorage
        if (address) {
          savePendingBurn(address, null);
        }
        setState(prev => ({
          ...prev,
          isClaiming: false,
          pendingBurn: null,
          error: null,
        }));
        setAttestationStatus('complete');
        toast.success('Transfer already completed!');
        return;
      }

      setState(prev => ({
        ...prev,
        isClaiming: false,
        error: errorMsg,
      }));

      toast.error('Claim failed', {
        description: errorMsg,
        duration: 10000,
      });
    }
  }, [state.pendingBurn, walletClient, address, sepoliaClient, arcClient, account.chainId, switchChainAsync]);

  /**
   * Manually restore a pending burn for claiming
   * Used when user refreshes page and localStorage didn't save properly
   */
  const restorePendingBurn = useCallback((burnTxHash: string, fromNetwork: BridgeNetwork, toNetwork: BridgeNetwork, amount: string) => {
    if (!burnTxHash || !burnTxHash.startsWith('0x')) {
      toast.error('Invalid transaction hash');
      return;
    }

    const pendingBurn: PendingBurn = {
      txHash: burnTxHash,
      fromNetwork,
      toNetwork,
      amount,
      timestamp: Date.now(),
    };

    // Save to localStorage
    if (address) {
      savePendingBurn(address, pendingBurn);
    }

    setState(prev => ({ ...prev, pendingBurn }));
    setAttestationStatus('pending_mint');
    toast.success('Pending burn restored! You can now claim your USDC.');
  }, [address]);

  /**
   * Clear pending burn (for manual dismissal)
   */
  const clearPendingBurn = useCallback(() => {
    if (address) {
      savePendingBurn(address, null);
    }
    setState(prev => ({ ...prev, pendingBurn: null }));
    setAttestationStatus(null);
  }, [address]);

  return {
    ...state,
    bridge,
    completeBridge,
    claimPendingBridge,
    restorePendingBurn,
    clearPendingBurn,
    attestationStatus,
    // Bridge Kit handles mint automatically, so no manual completion needed
    canCompleteBridge: false,
  };
};
