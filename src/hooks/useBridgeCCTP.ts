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
import { useAccount, useSwitchChain, usePublicClient, useWalletClient } from 'wagmi';
import { sepolia, arcTestnet as arcTestnetChain } from 'wagmi/chains';
import { parseUnits, maxUint256 } from 'viem';
import { SUPPORTED_NETWORKS, CCTP_CONTRACTS, CCTP_DOMAINS, CIRCLE_ATTESTATION_API, TOKEN_ADDRESSES, ARC_BRIDGE_CONTRACT } from '@/lib/constants';
import { toast } from 'sonner';
import { BridgeKit, Blockchain } from '@circle-fin/bridge-kit';
import { createAdapterFromProvider } from '@circle-fin/adapter-viem-v2';
import { supabase } from '@/lib/supabase';

// ERC20 ABI for approval
const ERC20_ABI = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: [{ name: '', type: 'bool' }]
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' }
    ],
    outputs: [{ name: '', type: 'uint256' }]
  }
] as const;

// Helper to safely stringify objects that may contain BigInt
const safeStringify = (obj: any, space?: number): string => {
  return JSON.stringify(obj, (_, value) =>
    typeof value === 'bigint' ? value.toString() : value
  , space);
};

// Track bridge initiated from our site
const trackSiteBridge = async (txHash: string, walletAddress: string, amount: string, direction: 'to_arc' | 'to_sepolia') => {
  if (!supabase) return;
  try {
    await supabase.from('site_bridges').upsert({
      tx_hash: txHash.toLowerCase(),
      wallet_address: walletAddress.toLowerCase(),
      amount_usd: parseFloat(amount),
      direction,
      created_at: new Date().toISOString(),
    }, { onConflict: 'tx_hash' });
    console.log('[useBridgeCCTP] Tracked site bridge:', txHash);
  } catch (e) {
    console.error('[useBridgeCCTP] Failed to track site bridge:', e);
  }
};
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
  const burnTxHashRef = useRef<string | null>(null);
  const approvalConfirmedRef = useRef(false);
  const approvalStartedRef = useRef(false);
  const approvalTxHashRef = useRef<string | null>(null);

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
  // IMPORTANT: Check Circle API first to see if already claimed
  useEffect(() => {
    if (address) {
      const savedPendingBurn = loadPendingBurn(address);
      if (savedPendingBurn) {
        console.log('[useBridgeCCTP] Loaded pending burn from storage:', savedPendingBurn);

        // Always verify with Circle API before showing Claim button
        const verifyAndLoad = async () => {
          try {
            const sourceDomain = CCTP_DOMAINS[savedPendingBurn.fromNetwork];
            const attestationUrl = `${CIRCLE_ATTESTATION_API}?domain=${sourceDomain}&transactionHash=${savedPendingBurn.txHash}`;
            const response = await fetch(attestationUrl);
            const data = await response.json();

            if (data.messages && data.messages.length > 0) {
              const messageData = data.messages[0];
              const decodedBody = messageData.decodedMessage?.decodedMessageBody;

              // NOTE: feeExecuted does NOT indicate if auto-relay happened!
              // It's just the fee amount. We cannot tell from Circle API if mint was done.
              // Always show Claim button - if already claimed, receiveMessage will fail with "Nonce already used"

              // Get amount from API if missing
              let amount = savedPendingBurn.amount;
              if (!amount || amount === '0') {
                if (decodedBody?.amount) {
                  amount = (parseFloat(decodedBody.amount) / 1e6).toString();
                  console.log('[useBridgeCCTP] Fetched amount from Circle API:', amount);
                }
              }

              // Check attestation status
              if (!messageData.attestation || messageData.attestation === 'PENDING') {
                console.log('[useBridgeCCTP] Attestation still pending');
                setAttestationStatus('pending');
                toast.info('Bridge in progress...', {
                  description: 'Waiting for Circle attestation.',
                  duration: 5000,
                });
              } else {
                // Has attestation, ready to claim
                setAttestationStatus('pending_mint');
                toast.info('You have unclaimed USDC!', {
                  description: 'Click Claim to receive your bridged funds.',
                  duration: 10000,
                });
              }

              const updatedPendingBurn = { ...savedPendingBurn, amount };
              savePendingBurn(address, updatedPendingBurn);
              setState(prev => ({ ...prev, pendingBurn: updatedPendingBurn }));
            } else {
              // No message found - transaction might have failed or wrong hash
              console.log('[useBridgeCCTP] No CCTP message found for stored tx, clearing');
              savePendingBurn(address, null);
              setState(prev => ({ ...prev, pendingBurn: null }));
            }
          } catch (e) {
            console.error('[useBridgeCCTP] Failed to verify pending burn:', e);
            // On error, still show the pending burn (conservative approach)
            setState(prev => ({ ...prev, pendingBurn: savedPendingBurn }));
            setAttestationStatus('pending_mint');
          }
        };
        verifyAndLoad();
      }
    }
  }, [address]);

  /**
   * Main bridge function using Circle Bridge Kit
   */
  const bridge = useCallback(
    async ({ fromNetwork, toNetwork, amount }: BridgeParams) => {
      if (!isConnected || !address || !account.connector) {
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

      // Clear any old pending burn from localStorage before starting new bridge
      if (address) {
        savePendingBurn(address, null);
      }
      setState({ isBridging: true, isClaiming: false, error: null, result: null, transactions: [], mintConfirmed: false, pendingBurn: null });
      setAttestationStatus(null);
      mintConfirmedRef.current = false;
      burnConfirmedRef.current = false;
      burnTxHashRef.current = null;
      approvalConfirmedRef.current = false;
      approvalStartedRef.current = false;
      approvalTxHashRef.current = null;

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
        // Get the EIP-1193 provider from wagmi connector (correct way for wagmi v3)
        // account.connector.getProvider() returns the native wallet provider
        const connector = account.connector;
        if (!connector) {
          throw new Error('No wallet connector available');
        }

        const provider = await connector.getProvider();
        if (!provider) {
          throw new Error('No wallet provider available');
        }

        console.log('[useBridgeCCTP] Got provider from connector:', connector.name);

        // Create adapter using Bridge Kit's factory
        console.log('[useBridgeCCTP] Creating adapter...');
        let adapter;
        try {
          adapter = await createAdapterFromProvider({
            provider,
          });
          console.log('[useBridgeCCTP] Adapter created successfully');
        } catch (adapterError) {
          console.error('[useBridgeCCTP] Failed to create adapter:', adapterError);
          throw new Error('Failed to create wallet adapter. Please refresh and try again.');
        }

        // Bridge Kit expects human-readable amount (e.g., '20' = 20 USDC)
        const bridgeAmount = amount;

        const fromChain = NETWORK_TO_BLOCKCHAIN[fromNetwork];
        const toChain = NETWORK_TO_BLOCKCHAIN[toNetwork];

        // === MANUAL APPROVAL STEP ===
        // Handle approval ourselves to ensure we wait for confirmation
        // Bridge Kit sometimes times out during approval, leaving tx pending
        const usdcAddress = TOKEN_ADDRESSES[fromNetwork].USDC;

        // Different approval targets based on direction:
        // - Sepolia → Arc: uses ARC_BRIDGE_CONTRACT (Arc's custom bridge)
        // - Arc → Sepolia: uses TokenMessenger (standard CCTP)
        const approvalTarget = fromNetwork === 'ethereumSepolia'
          ? ARC_BRIDGE_CONTRACT
          : CCTP_CONTRACTS[fromNetwork].TokenMessenger;

        console.log('[useBridgeCCTP] Approval target:', approvalTarget, 'for direction:', fromNetwork, '→', toNetwork);

        // Get decimals based on network (Arc uses 18, Sepolia uses 6)
        const decimals = fromNetwork === 'arcTestnet' ? 18 : 6;
        const amountWei = parseUnits(amount, decimals);

        // Get the public client for the source chain
        const sourceClient = fromNetwork === 'arcTestnet' ? arcClient : sepoliaClient;

        if (!sourceClient || !walletClient) {
          console.error('[useBridgeCCTP] Missing client - sourceClient:', !!sourceClient, 'walletClient:', !!walletClient);
          throw new Error('Wallet not ready. Please try again.');
        }

        // Check current allowance
        console.log('[useBridgeCCTP] Checking allowance for', address, 'to', approvalTarget, 'on', usdcAddress);
        let currentAllowance: bigint;
        try {
          currentAllowance = await sourceClient.readContract({
            address: usdcAddress,
            abi: ERC20_ABI,
            functionName: 'allowance',
            args: [address, approvalTarget],
          }) as bigint;
        } catch (allowanceError) {
          console.error('[useBridgeCCTP] Failed to read allowance:', allowanceError);
          throw new Error('Failed to check token allowance. Please try again.');
        }

        console.log('[useBridgeCCTP] Current allowance:', currentAllowance.toString(), 'Needed:', amountWei.toString());

        // If allowance is insufficient, approve MAX to avoid Bridge Kit doing its own approval
        // This ensures Bridge Kit will skip approval step entirely
        if (currentAllowance < amountWei) {
          toast.info('Approving USDC...', { description: 'Please confirm in your wallet' });
          approvalStartedRef.current = true;

          try {
            // Get the correct chain for the wallet client
            const sourceChain = fromNetwork === 'arcTestnet' ? arcTestnetChain : sepolia;

            // Approve max uint256 so Bridge Kit never needs to do its own approval
            const approvalHash = await walletClient.writeContract({
              chain: sourceChain,
              address: usdcAddress,
              abi: ERC20_ABI,
              functionName: 'approve',
              args: [approvalTarget, maxUint256],
            });

            approvalTxHashRef.current = approvalHash;
            console.log('[useBridgeCCTP] Approval tx sent:', approvalHash);
            toast.info('Waiting for approval confirmation...');

            // Wait for approval to be confirmed
            const approvalReceipt = await sourceClient.waitForTransactionReceipt({
              hash: approvalHash,
              confirmations: 1,
            });

            if (approvalReceipt.status === 'success') {
              approvalConfirmedRef.current = true;
              toast.success('USDC approved!');
              console.log('[useBridgeCCTP] Approval confirmed');
            } else {
              throw new Error('Approval transaction failed');
            }
          } catch (approvalError: any) {
            console.error('[useBridgeCCTP] Approval error:', approvalError);
            // Check if user rejected
            if (approvalError?.message?.toLowerCase().includes('user rejected') ||
                approvalError?.message?.toLowerCase().includes('user denied')) {
              throw new Error('User rejected the approval');
            }
            throw approvalError;
          }
        } else {
          console.log('[useBridgeCCTP] Allowance sufficient, skipping approval');
          approvalConfirmedRef.current = true;
        }

        console.log('[useBridgeCCTP] Bridge params:', {
          from: fromChain,
          to: toChain,
          amount: bridgeAmount,
          address,
        });

        toast.info('Starting bridge transfer...');
        console.log('[useBridgeCCTP] Calling Bridge Kit...');

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
            console.log('[useBridgeCCTP] Progress event:', safeStringify(progress));
            console.log('[useBridgeCCTP] Progress keys:', Object.keys(progress));

            // Handle different progress stages
            const eventType = progress.type || progress.event || progress.status || progress.stage;
            console.log('[useBridgeCCTP] Event type detected:', eventType);

            switch (eventType) {
              case 'approval':
              case 'APPROVAL_STARTED':
                toast.info('Approving USDC...');
                approvalStartedRef.current = true;
                // Capture tx hash if available
                if (progress.txHash || progress.transactionHash) {
                  approvalTxHashRef.current = progress.txHash || progress.transactionHash;
                  console.log('[useBridgeCCTP] Approval tx hash:', approvalTxHashRef.current);
                }
                break;

              case 'APPROVAL_CONFIRMED':
                toast.success('USDC approved!');
                approvalConfirmedRef.current = true;
                break;

              case 'burn':
              case 'BURN_STARTED':
                toast.info('Burning USDC on source chain...');
                if (progress.txHash || progress.transactionHash) {
                  const hash = progress.txHash || progress.transactionHash;
                  burnTxHashRef.current = hash; // Store in ref for reliable access later
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
                  // Track this bridge as initiated from our site
                  const direction = toNetwork === 'arcTestnet' ? 'to_arc' : 'to_sepolia';
                  trackSiteBridge(hash, address!, amount, direction);
                }
                break;

              case 'BURN_CONFIRMED':
                toast.success('Burn confirmed!');
                burnConfirmedRef.current = true;
                // Backup tracking - in case BURN_STARTED didn't have txHash
                if (progress.txHash || progress.transactionHash) {
                  const hash = progress.txHash || progress.transactionHash;
                  if (!burnTxHashRef.current) burnTxHashRef.current = hash; // Backup store
                  const direction = toNetwork === 'arcTestnet' ? 'to_arc' : 'to_sepolia';
                  trackSiteBridge(hash, address!, amount, direction);
                }
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
                toast.info('Waiting for Circle attestation (~30 sec)...');
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
        console.log('[useBridgeCCTP] All steps:', safeStringify(steps, 2));
        const burnStep = steps.find((s: any) =>
          s.name?.toLowerCase().includes('burn') ||
          s.name?.toLowerCase().includes('deposit') ||
          s.type?.toLowerCase().includes('burn')
        );
        console.log('[useBridgeCCTP] Burn step details:', safeStringify(burnStep, 2));
        const mintStep = steps.find((s: any) =>
          s.name?.toLowerCase().includes('mint') ||
          s.type?.toLowerCase().includes('mint')
        );

        // Check burn success - also use burnConfirmedRef as fallback (set during progress events)
        const burnSucceeded = burnStep?.state === 'success' || burnConfirmedRef.current;
        const mintSucceeded = mintStep?.state === 'success' || mintConfirmedRef.current;

        console.log('[useBridgeCCTP] burnSucceeded:', burnSucceeded, 'mintSucceeded:', mintSucceeded, 'burnConfirmedRef:', burnConfirmedRef.current);

        // Check overall result state
        if (result?.state === 'success') {
          // Full success - track the bridge in site_bridges
          const burnTxHash = burnStep?.txHash || burnStep?.transactionHash;
          if (burnTxHash) {
            const direction = toNetwork === 'arcTestnet' ? 'to_arc' : 'to_sepolia';
            trackSiteBridge(burnTxHash, address!, amount, direction);
          }

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
          // Try to get burn tx hash from ref (most reliable), then step
          // NOTE: state.transactions may be stale due to React closure
          let burnTxHash = burnTxHashRef.current || burnStep?.txHash || burnStep?.transactionHash;
          console.log('[useBridgeCCTP] Burn tx hash from ref or step:', burnTxHash);

          // Track the bridge even if mint failed
          if (burnTxHash) {
            const direction = toNetwork === 'arcTestnet' ? 'to_arc' : 'to_sepolia';
            trackSiteBridge(burnTxHash, address!, amount, direction);
          }

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
          // Only save pending burn if burn was actually confirmed
          // This prevents false positives from approval tx hashes
          if (burnConfirmedRef.current && burnTxHashRef.current) {
            console.log('[useBridgeCCTP] Burn confirmed but result unclear, treating as pending claim:', burnTxHashRef.current);

            const direction = toNetwork === 'arcTestnet' ? 'to_arc' : 'to_sepolia';
            trackSiteBridge(burnTxHashRef.current, address!, amount, direction);

            setAttestationStatus('pending_mint');
            toast.warning('Your funds are safe!', {
              description: 'Transaction sent. Waiting for attestation - this takes 5-10 minutes.',
              duration: 15000,
            });

            const newPendingBurn = {
              txHash: burnTxHashRef.current,
              fromNetwork,
              toNetwork,
              amount,
              timestamp: Date.now(),
            };

            if (address) {
              savePendingBurn(address, newPendingBurn);
            }

            setState(prev => ({
              ...prev,
              isBridging: false,
              error: null,
              result: null,
              mintConfirmed: false,
              pendingBurn: newPendingBurn,
            }));
          } else {
            // No confirmed burn - check approval status
            console.log('[useBridgeCCTP] Bridge returned but no confirmed burn - approvalStarted:', approvalStartedRef.current, 'approvalConfirmed:', approvalConfirmedRef.current, 'approvalTxHash:', approvalTxHashRef.current);
            setAttestationStatus(null);

            if (approvalConfirmedRef.current) {
              // Approval succeeded but burn didn't start - likely user rejected burn tx or timeout
              toast.warning('Approval successful', {
                description: 'USDC approved. Please try bridging again to complete the transfer.',
                duration: 10000,
              });
              setState(prev => ({
                ...prev,
                isBridging: false,
                error: 'Approval completed. Please try again to bridge.',
                result: null,
                transactions: [],
                mintConfirmed: false,
              }));
            } else if (approvalStartedRef.current) {
              // Approval was started but not confirmed yet - tx might still be pending
              const txLink = approvalTxHashRef.current
                ? `Check tx: ${SUPPORTED_NETWORKS[fromNetwork].explorerUrl}/tx/${approvalTxHashRef.current}`
                : '';
              toast.warning('Approval pending', {
                description: `Transaction may still be processing. Wait a moment and try again. ${txLink}`,
                duration: 15000,
              });
              setState(prev => ({
                ...prev,
                isBridging: false,
                error: 'Approval transaction pending. Please wait and try again.',
                result: null,
                transactions: [],
                mintConfirmed: false,
              }));
            } else {
              // No refs set - Bridge Kit returned without progress events
              // Don't assume cancelled - transaction might still be pending
              toast.warning('Bridge interrupted', {
                description: 'If you approved a transaction, please wait for it to confirm and try again.',
                duration: 15000,
              });
              setState(prev => ({
                ...prev,
                isBridging: false,
                error: 'Bridge interrupted. If you approved a transaction, please wait for it to confirm and try again.',
                result: null,
                transactions: [],
                mintConfirmed: false,
              }));
            }
          }
        }

      } catch (error: any) {
        console.error('[useBridgeCCTP] Bridge error:', error);
        console.log('[useBridgeCCTP] Error object:', safeStringify(error, 2));
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

        // Extract approval/burn status from error.steps (Bridge Kit includes step info in errors)
        // This is needed because onProgress may not fire before the error is thrown
        const errorSteps = error?.steps || [];
        console.log('[useBridgeCCTP] Error steps:', safeStringify(errorSteps, 2));

        // Look for approval step in error
        const approvalStep = errorSteps.find((s: any) =>
          s.name?.toLowerCase().includes('approv') ||
          s.type?.toLowerCase().includes('approv') ||
          s.name?.toLowerCase().includes('allowance')
        );

        if (approvalStep) {
          console.log('[useBridgeCCTP] Found approval step in error:', safeStringify(approvalStep, 2));
          // Extract tx hash from approval step
          if (approvalStep.txHash || approvalStep.transactionHash) {
            approvalTxHashRef.current = approvalStep.txHash || approvalStep.transactionHash;
          }
          // Check approval state
          if (approvalStep.state === 'success' || approvalStep.status === 'success') {
            approvalConfirmedRef.current = true;
          } else if (approvalStep.state === 'pending' || approvalStep.status === 'pending' || approvalStep.txHash) {
            approvalStartedRef.current = true;
          }
        }

        // Also look for burn step
        const burnStep = errorSteps.find((s: any) =>
          s.name?.toLowerCase().includes('burn') ||
          s.name?.toLowerCase().includes('deposit') ||
          s.type?.toLowerCase().includes('burn')
        );

        if (burnStep) {
          console.log('[useBridgeCCTP] Found burn step in error:', safeStringify(burnStep, 2));
          if (burnStep.txHash || burnStep.transactionHash) {
            burnTxHashRef.current = burnStep.txHash || burnStep.transactionHash;
          }
          if (burnStep.state === 'success' || burnStep.status === 'success') {
            burnConfirmedRef.current = true;
          }
        }

        console.log('[useBridgeCCTP] On error - burnConfirmedRef:', burnConfirmedRef.current, 'burnTxHashRef:', burnTxHashRef.current);

        // Check if burn was actually confirmed (BURN_CONFIRMED event was received)
        if (burnConfirmedRef.current && burnTxHashRef.current) {
          console.log('[useBridgeCCTP] Burn was confirmed before error - funds are safe');
          const burnTxHash = burnTxHashRef.current;
          console.log('[useBridgeCCTP] Burn tx hash:', burnTxHash);

          setAttestationStatus('pending_mint');
          toast.warning('Your funds are safe!', {
            description: 'Burn completed. Click Claim to receive your USDC.',
            duration: 15000,
          });

          const newPendingBurn = {
            txHash: burnTxHash,
            fromNetwork,
            toNetwork,
            amount,
            timestamp: Date.now(),
          };

          // Save to localStorage so it persists across page refresh
          if (address) {
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

        // No burn happened - check approval status
        console.log('[useBridgeCCTP] On error - approvalStarted:', approvalStartedRef.current, 'approvalConfirmed:', approvalConfirmedRef.current, 'approvalTxHash:', approvalTxHashRef.current);

        if (approvalConfirmedRef.current) {
          // Approval succeeded but burn didn't start
          setAttestationStatus(null);
          toast.warning('Approval successful', {
            description: 'USDC approved. Please try bridging again to complete the transfer.',
            duration: 10000,
          });
          setState(prev => ({
            ...prev,
            isBridging: false,
            error: 'Approval completed. Please try again to bridge.',
            result: null,
            transactions: [],
            mintConfirmed: false,
          }));
        } else if (approvalStartedRef.current || approvalTxHashRef.current) {
          // Approval was started but not confirmed yet - tx might still be pending
          const txLink = approvalTxHashRef.current
            ? ` Check tx: ${SUPPORTED_NETWORKS[fromNetwork].explorerUrl}/tx/${approvalTxHashRef.current}`
            : '';
          setAttestationStatus(null);
          toast.warning('Approval pending', {
            description: `Transaction may still be processing. Wait for confirmation and try again.${txLink}`,
            duration: 15000,
          });
          setState(prev => ({
            ...prev,
            isBridging: false,
            error: 'Approval transaction may still be pending. Please wait and try again.',
            result: null,
            transactions: [],
            mintConfirmed: false,
          }));
        } else {
          // Check if this was an explicit USER rejection (not just any "cancelled" error)
          // Only treat as user rejection if message explicitly says "User rejected" or "User denied"
          const originalError = error?.message?.toLowerCase() || '';
          const wasUserRejection = originalError.includes('user rejected') ||
                                   originalError.includes('user denied') ||
                                   originalError.includes('rejected the request') ||
                                   originalError.includes('denied transaction');

          setAttestationStatus(null);

          if (wasUserRejection) {
            // User explicitly rejected in wallet
            setState(prev => ({
              ...prev,
              isBridging: false,
              error: 'Transaction rejected by user',
              result: null,
              transactions: [],
              mintConfirmed: false,
            }));
            toast.error('Transaction rejected', {
              description: 'You rejected the transaction in your wallet.',
              duration: 10000,
            });
          } else {
            // Any other error - transaction might still be pending
            setState(prev => ({
              ...prev,
              isBridging: false,
              error: 'Bridge interrupted. If you approved a transaction, please wait for it to confirm and try again.',
              result: null,
              transactions: [],
              mintConfirmed: false,
            }));
            toast.warning('Bridge interrupted', {
              description: 'If you approved a transaction in your wallet, please wait for it to confirm and try again.',
              duration: 15000,
            });
          }
        }
      }
    },
    [isConnected, address, account.connector, switchChainAsync, account.chainId, bridgeKit]
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
      // Step 1: Fetch attestation from Circle API (includes message bytes)
      // Try both domains to auto-detect direction (in case saved direction was wrong)
      toast.info('Fetching attestation from Circle...');

      const domains = [
        { domain: CCTP_DOMAINS[fromNetwork], from: fromNetwork, to: toNetwork }, // Try saved direction first
        { domain: CCTP_DOMAINS[fromNetwork === 'ethereumSepolia' ? 'arcTestnet' : 'ethereumSepolia'],
          from: fromNetwork === 'ethereumSepolia' ? 'arcTestnet' as BridgeNetwork : 'ethereumSepolia' as BridgeNetwork,
          to: fromNetwork === 'ethereumSepolia' ? 'ethereumSepolia' as BridgeNetwork : 'arcTestnet' as BridgeNetwork },
      ];

      let messageData: any = null;
      let detectedDestNetwork: BridgeNetwork = toNetwork;

      for (const { domain, to } of domains) {
        const attestationUrl = `${CIRCLE_ATTESTATION_API}?domain=${domain}&transactionHash=${txHash}`;
        console.log('[useBridgeCCTP] Trying domain', domain, 'URL:', attestationUrl);

        try {
          const attestationResponse = await fetch(attestationUrl);
          const attestationData = await attestationResponse.json();
          console.log('[useBridgeCCTP] Attestation response for domain', domain, ':', attestationData);

          if (attestationData.messages && attestationData.messages.length > 0) {
            messageData = attestationData.messages[0];
            detectedDestNetwork = to;
            console.log('[useBridgeCCTP] Found message on domain', domain, '- dest:', to);
            break;
          }
        } catch (e) {
          console.log('[useBridgeCCTP] Domain', domain, 'failed, trying next...');
        }
      }

      if (!messageData) {
        throw new Error('Attestation not ready yet. Please try again in a few minutes.');
      }

      const destNetwork = detectedDestNetwork;
      const destContracts = CCTP_CONTRACTS[destNetwork];

      console.log('[useBridgeCCTP] Dest network:', destNetwork);

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
      console.log('[useBridgeCCTP] Current chain:', account.chainId, 'Destination chain:', destChainId);
      if (account.chainId !== destChainId) {
        toast.info(`Switching to ${SUPPORTED_NETWORKS[destNetwork].name}...`);
        if (!switchChainAsync) {
          throw new Error(`Please switch to ${SUPPORTED_NETWORKS[destNetwork].name} manually in MetaMask`);
        }
        try {
          await switchChainAsync({ chainId: destChainId });
          await new Promise(resolve => setTimeout(resolve, 1500)); // Wait for chain switch to complete
        } catch (switchError: any) {
          console.error('[useBridgeCCTP] Chain switch failed:', switchError);
          throw new Error(`Failed to switch network. Please switch to ${SUPPORTED_NETWORKS[destNetwork].name} manually.`);
        }
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

      // Get the correct chain object for the destination
      const destChain = destNetwork === 'arcTestnet' ? arcTestnetChain : sepolia;

      const hash = await walletClient.writeContract({
        chain: destChain,
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
   * Validates the transaction by checking Circle Attestation API
   * Auto-detects direction by trying both domains
   * Returns: { success: boolean, message: string, type: 'success' | 'error' | 'claimed' }
   */
  const restorePendingBurn = useCallback(async (burnTxHash: string, _fromNetwork: BridgeNetwork, _toNetwork: BridgeNetwork, _amount: string): Promise<{ success: boolean; message: string; type: string }> => {
    if (!burnTxHash || !burnTxHash.startsWith('0x')) {
      return { success: false, message: 'Invalid transaction hash format', type: 'error' };
    }

    // Validate tx hash length (should be 66 chars: 0x + 64 hex)
    if (burnTxHash.length !== 66) {
      return { success: false, message: 'Transaction hash should be 66 characters', type: 'error' };
    }

    try {
      // Try both domains to auto-detect the actual direction
      // Domain 0 = Sepolia, Domain 26 = Arc Testnet
      const domains = [
        { domain: CCTP_DOMAINS.ethereumSepolia, from: 'ethereumSepolia' as BridgeNetwork, to: 'arcTestnet' as BridgeNetwork },
        { domain: CCTP_DOMAINS.arcTestnet, from: 'arcTestnet' as BridgeNetwork, to: 'ethereumSepolia' as BridgeNetwork },
      ];

      let messageData: any = null;
      let detectedFrom: BridgeNetwork = 'ethereumSepolia';
      let detectedTo: BridgeNetwork = 'arcTestnet';

      for (const { domain, from, to } of domains) {
        const attestationUrl = `${CIRCLE_ATTESTATION_API}?domain=${domain}&transactionHash=${burnTxHash}`;
        console.log('[useBridgeCCTP] Trying domain', domain, 'for:', burnTxHash);

        try {
          const response = await fetch(attestationUrl);
          const data = await response.json();

          if (data.messages && data.messages.length > 0) {
            messageData = data.messages[0];
            detectedFrom = from;
            detectedTo = to;
            console.log('[useBridgeCCTP] Found message on domain', domain, '- direction:', from, '→', to);
            break;
          }
        } catch (e) {
          console.log('[useBridgeCCTP] Domain', domain, 'failed, trying next...');
        }
      }

      if (!messageData) {
        return { success: false, message: 'No CCTP burn found for this transaction. Make sure this is a valid burn tx hash.', type: 'error' };
      }

      console.log('[useBridgeCCTP] Attestation check response:', messageData);

      const decodedBody = messageData.decodedMessage?.decodedMessageBody;

      // Extract amount from Circle API (in smallest units, need to divide by 1e6)
      let detectedAmount = '0';
      if (decodedBody?.amount) {
        detectedAmount = (parseFloat(decodedBody.amount) / 1e6).toFixed(2);
        console.log('[useBridgeCCTP] Detected amount from API:', detectedAmount, 'USDC');
      }

      // NOTE: We cannot reliably tell from Circle API if mint was already done
      // feeExecuted is just the fee amount, NOT an indicator of completion
      // Always allow claiming - if already claimed, receiveMessage will fail with "Nonce already used"

      // Check attestation status
      if (!messageData.attestation || messageData.attestation === 'PENDING') {
        return { success: false, message: 'Attestation still pending. Please wait a few minutes and try again.', type: 'error' };
      }

      // Valid burn with attestation - restore it with auto-detected values
      const pendingBurn: PendingBurn = {
        txHash: burnTxHash,
        fromNetwork: detectedFrom,
        toNetwork: detectedTo,
        amount: detectedAmount,
        timestamp: Date.now(),
      };

      // Save to localStorage
      if (address) {
        savePendingBurn(address, pendingBurn);
      }

      setState(prev => ({ ...prev, pendingBurn }));
      setAttestationStatus('pending_mint');

      const directionText = detectedFrom === 'ethereumSepolia' ? 'Sepolia → Arc' : 'Arc → Sepolia';
      return { success: true, message: `Found ${detectedAmount} USDC (${directionText}). Click Claim to receive!`, type: 'success' };

    } catch (error: any) {
      console.error('[useBridgeCCTP] Restore check error:', error);
      return { success: false, message: 'Failed to verify transaction. Please check the tx hash and try again.', type: 'error' };
    }
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

  // Reset all state for starting a new bridge
  const reset = useCallback(() => {
    setState({
      isBridging: false,
      isClaiming: false,
      error: null,
      result: null,
      transactions: [],
      mintConfirmed: false,
      pendingBurn: null,
    });
    setAttestationStatus(null);
    mintConfirmedRef.current = false;
    burnConfirmedRef.current = false;
    burnTxHashRef.current = null;
    approvalConfirmedRef.current = false;
    approvalStartedRef.current = false;
    approvalTxHashRef.current = null;
  }, []);

  return {
    ...state,
    bridge,
    completeBridge,
    claimPendingBridge,
    restorePendingBurn,
    clearPendingBurn,
    reset,
    attestationStatus,
    // Bridge Kit handles mint automatically, so no manual completion needed
    canCompleteBridge: false,
  };
};
