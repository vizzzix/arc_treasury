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
import { sepolia, arcTestnet as arcTestnetChain } from 'wagmi/chains';
import { SUPPORTED_NETWORKS, CCTP_CONTRACTS, CCTP_DOMAINS, CIRCLE_ATTESTATION_API, TOKEN_ADDRESSES, ARC_BRIDGE_CONTRACT } from '@/lib/constants';
import { parseUnits, encodeAbiParameters, concat, createWalletClient, custom } from 'viem';
import { toast } from 'sonner';
import { BridgeKit, Blockchain } from '@circle-fin/bridge-kit';
import { createAdapterFromProvider } from '@circle-fin/adapter-viem-v2';
import { supabase } from '@/lib/supabase';

// Debug mode - set to false for production
const DEBUG = false;
const debug = (...args: any[]) => DEBUG && debug('', ...args);

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
    debug(' Tracked site bridge:', txHash);
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

// Fee estimate from Bridge Kit 1.3.0
interface BridgeFee {
  type: 'gas' | 'provider' | 'relayer';
  amount: string;
  token: string;
}

interface BridgeEstimate {
  amount: string;
  token: string;
  source: { chain: string };
  destination: { chain: string };
  fees: BridgeFee[];
  totalFees: string;
}

// Step status from Bridge Kit 1.3.0
interface BridgeStep {
  name: 'approve' | 'burn' | 'fetchAttestation' | 'mint';
  state: 'pending' | 'success' | 'error';
  txHash?: string;
  error?: string;
}

// Last bridge result for retry
interface LastBridgeResult {
  state: 'pending' | 'success' | 'error';
  steps: BridgeStep[];
  source: { address: string; chain: string };
  destination: { address: string; chain: string };
}

interface BridgeState {
  isBridging: boolean;
  isClaiming: boolean;
  isEstimating: boolean;
  error: string | null;
  result: any | null;
  transactions: BridgeTransaction[];
  mintConfirmed: boolean;
  pendingBurn: PendingBurn | null;
  estimate: BridgeEstimate | null;
  steps: BridgeStep[];
  lastResult: LastBridgeResult | null;
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
    isEstimating: false,
    error: null,
    result: null,
    transactions: [],
    mintConfirmed: false,
    pendingBurn: null,
    estimate: null,
    steps: [],
    lastResult: null,
  });

  const [attestationStatus, setAttestationStatus] = useState<string | null>(null);

  // Use refs to track progress - avoid async state timing issues
  const mintConfirmedRef = useRef(false);
  const mintTxHashRef = useRef<string | null>(null); // Track if mint tx was sent
  const burnConfirmedRef = useRef(false);
  const burnTxHashRef = useRef<string | null>(null);
  const approvalConfirmedRef = useRef(false);
  const approvalStartedRef = useRef(false);
  const approvalTxHashRef = useRef<string | null>(null);
  const claimPendingBridgeRef = useRef<(() => void) | null>(null);

  // Get public client for reading chain data
  const sepoliaClient = usePublicClient({ chainId: SUPPORTED_NETWORKS.ethereumSepolia.chainId });
  const arcClient = usePublicClient({ chainId: SUPPORTED_NETWORKS.arcTestnet.chainId });
  const { data: walletClient } = useWalletClient();

  // Initialize Bridge Kit (memoized to avoid re-creating)
  const bridgeKit = useMemo(() => {
    const kit = new BridgeKit();
    debug(' Bridge Kit initialized');
    return kit;
  }, []);

  // Log supported chains on mount (debug)
  useEffect(() => {
    if (bridgeKit) {
      const chains = bridgeKit.getSupportedChains();
      debug(' Supported chains:', chains.map(c => `${c.name} (${c.chain})`));

      // Verify Arc Testnet is supported
      const arcChain = chains.find(c => c.chain === Blockchain.Arc_Testnet);
      if (arcChain) {
        debug(' Arc Testnet config:', arcChain);
      }
    }
  }, [bridgeKit]);

  // Load pending burn from localStorage on wallet connect
  // IMPORTANT: Check Circle API first to see if already claimed
  useEffect(() => {
    if (address) {
      const savedPendingBurn = loadPendingBurn(address);
      if (savedPendingBurn) {
        debug(' Loaded pending burn from storage:', savedPendingBurn);

        // Always verify with Circle API before showing Claim button
        const verifyAndLoad = async () => {
          try {
            const sourceDomain = CCTP_DOMAINS[savedPendingBurn.fromNetwork];
            const attestationUrl = `${CIRCLE_ATTESTATION_API}&domain=${sourceDomain}&transactionHash=${savedPendingBurn.txHash}`;
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
                  debug(' Fetched amount from Circle API:', amount);
                }
              }

              // Check attestation status
              if (!messageData.attestation || messageData.attestation === 'PENDING') {
                debug(' Attestation still pending');
                setAttestationStatus('pending');
                toast.info('Bridge in progress...', {
                  description: 'Waiting for Circle attestation.',
                  duration: 5000,
                });
              } else {
                // Has attestation, ready to claim - try auto-claim
                setAttestationStatus('pending_mint');

                // Auto-claim: try to mint automatically instead of showing Claim button
                const targetChainId = SUPPORTED_NETWORKS.arcTestnet.chainId;
                if (account?.chainId === targetChainId) {
                  debug(' Auto-claiming pending bridge...');
                  toast.info('Auto-claiming bridged USDC...', { duration: 5000 });
                  // Trigger claim after state is set
                  setTimeout(() => {
                    claimPendingBridgeRef.current?.();
                  }, 1000);
                } else {
                  toast.info('You have unclaimed USDC!', {
                    description: 'Switch to Arc Testnet to auto-claim, or click Claim.',
                    duration: 10000,
                  });
                }
              }

              const updatedPendingBurn = { ...savedPendingBurn, amount };
              savePendingBurn(address, updatedPendingBurn);
              setState(prev => ({ ...prev, pendingBurn: updatedPendingBurn }));
            } else {
              // No message found - transaction might have failed or wrong hash
              debug(' No CCTP message found for stored tx, clearing');
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
   * Estimate bridge fees before transfer (Bridge Kit 1.3.0)
   * Returns estimated gas fees and provider fees
   */
  const estimateBridge = useCallback(
    async ({ fromNetwork, toNetwork, amount }: BridgeParams): Promise<BridgeEstimate | null> => {
      if (!isConnected || !address || !connectorClient) {
        return null;
      }

      if (!amount || parseFloat(amount) <= 0) {
        return null;
      }

      setState(prev => ({ ...prev, isEstimating: true, estimate: null }));

      try {
        const provider = (connectorClient as any)?.transport || (window as any).ethereum;
        if (!provider) {
          throw new Error('No wallet provider available');
        }

        const adapter = await createAdapterFromProvider({ provider });
        const fromChain = NETWORK_TO_BLOCKCHAIN[fromNetwork];
        const toChain = NETWORK_TO_BLOCKCHAIN[toNetwork];

        debug(' Estimating fees for:', { fromChain, toChain, amount });

        const estimate = await bridgeKit.estimate({
          from: { adapter, chain: fromChain },
          to: { adapter, chain: toChain },
          amount,
        });

        debug(' Estimate result:', estimate);

        // Calculate total fees
        const totalFees = estimate.fees
          .reduce((sum: number, fee: any) => sum + parseFloat(fee.amount || '0'), 0)
          .toFixed(6);

        const bridgeEstimate: BridgeEstimate = {
          amount: estimate.amount,
          token: estimate.token,
          source: { chain: estimate.source.chain },
          destination: { chain: estimate.destination.chain },
          fees: estimate.fees.map((f: any) => ({
            type: f.type,
            amount: f.amount,
            token: f.token || 'USDC',
          })),
          totalFees,
        };

        setState(prev => ({ ...prev, isEstimating: false, estimate: bridgeEstimate }));
        return bridgeEstimate;

      } catch (error: any) {
        console.error('[useBridgeCCTP] Estimate error:', error);
        setState(prev => ({ ...prev, isEstimating: false, estimate: null }));
        return null;
      }
    },
    [isConnected, address, connectorClient, bridgeKit]
  );

  /**
   * Main bridge function using Circle Bridge Kit
   */
  const bridge = useCallback(
    async ({ fromNetwork, toNetwork, amount }: BridgeParams) => {
      if (!isConnected || !address || !connectorClient || !walletClient) {
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
      setState({ isBridging: true, isClaiming: false, isEstimating: false, error: null, result: null, transactions: [], mintConfirmed: false, pendingBurn: null, estimate: null, steps: [], lastResult: null });
      setAttestationStatus(null);
      mintConfirmedRef.current = false;
      mintTxHashRef.current = null; // Reset mint tx hash
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
          await switchChainAsync?.({ chainId: requiredChainId });
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

        debug(' Creating adapter from provider...');

        // Create adapter using Bridge Kit's factory
        const adapter = await createAdapterFromProvider({
          provider,
        });

        debug(' Adapter created successfully');

        // Bridge Kit expects human-readable amount (e.g., '20' = 20 USDC)
        // The SDK handles decimal conversion internally
        const bridgeAmount = amount;

        const fromChain = NETWORK_TO_BLOCKCHAIN[fromNetwork];
        const toChain = NETWORK_TO_BLOCKCHAIN[toNetwork];

        debug(' Bridge params:', {
          from: fromChain,
          to: toChain,
          amount: bridgeAmount,
          address,
        });

        // Special handling for Sepolia → Arc: use direct bridgeWithPreapproval call
        // Bridge Kit SDK doesn't properly support Arc's custom bridge contract
        const isSepoliaToArc = fromNetwork === 'ethereumSepolia' && toNetwork === 'arcTestnet';

        if (isSepoliaToArc) {
          debug(' Sepolia → Arc: using direct bridgeWithPreapproval');
          if (!walletClient) {
            throw new Error('Wallet not ready');
          }

          const usdcAddress = TOKEN_ADDRESSES.ethereumSepolia.USDC;
          // USDC on Sepolia has 6 decimals
          const amountWei = parseUnits(amount, 6);

          // Step 1: Check and approve if needed
          const allowance = await sepoliaClient!.readContract({
            address: usdcAddress,
            abi: [{ name: 'allowance', type: 'function', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] }],
            functionName: 'allowance',
            args: [address, ARC_BRIDGE_CONTRACT],
          });

          if ((allowance as bigint) < amountWei) {
            toast.info('Approving USDC...');
            const approveHash = await walletClient.writeContract({
              chain: sepolia,
              address: usdcAddress,
              abi: [{ name: 'approve', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] }],
              functionName: 'approve',
              args: [ARC_BRIDGE_CONTRACT, amountWei * 10n], // Approve extra for future bridges
            });
            await sepoliaClient!.waitForTransactionReceipt({ hash: approveHash });
          }

          // Step 2: Call bridgeWithPreapproval with raw calldata (selector 0xd0d4229a)
          toast.info('Bridging to Arc...', { description: 'Please confirm in wallet' });

          const BRIDGE_SELECTOR = '0xd0d4229a' as `0x${string}`;
          const ARC_DESTINATION_DOMAIN = 26; // Arc Testnet CCTP domain
          // Calculate fee: 1 bps (0.01%) of amount for Fast Transfer
          // For Standard Transfer (free but slower): use minFinalityThreshold = 2000
          const feeBps = 1n; // 1 basis point = 0.01%
          const calculatedFee = (amountWei * feeBps) / 10000n;
          const MIN_FEE = 1000n; // Minimum fee floor
          const maxFee = calculatedFee > MIN_FEE ? calculatedFee : MIN_FEE;
          const minFinalityThreshold = 1000n; // Fast Transfer threshold
          const zeroBytes32 = '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`;

          debug(' Calculated fee:', { amountWei: amountWei.toString(), maxFee: maxFee.toString() });

          const encodedParams = encodeAbiParameters(
            [
              { type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' },
              { type: 'address' }, { type: 'bytes32' }, { type: 'address' },
              { type: 'address' }, { type: 'uint256' }, { type: 'uint256' },
            ],
            [
              amountWei,                    // amount to bridge
              maxFee,                       // maxFee for relayer (1 bps of amount)
              0n,                           // nonce (0 = auto)
              address,                      // mintRecipient
              zeroBytes32,                  // destinationCaller (0x0 = anyone can relay)
              usdcAddress,                  // burnToken (USDC on Sepolia)
              ARC_BRIDGE_CONTRACT,          // hook address
              BigInt(ARC_DESTINATION_DOMAIN), // destinationDomain (Arc = 26)
              minFinalityThreshold,         // minFinalityThreshold (1000 for Fast Transfer)
            ]
          );

          const calldata = concat([BRIDGE_SELECTOR, encodedParams]);

          const burnHash = await walletClient.sendTransaction({
            chain: sepolia,
            to: ARC_BRIDGE_CONTRACT,
            data: calldata,
            gas: 500_000n,
          });

          debug(' Bridge tx sent:', burnHash);
          burnTxHashRef.current = burnHash;
          burnConfirmedRef.current = true;

          const receipt = await sepoliaClient!.waitForTransactionReceipt({ hash: burnHash });

          if (receipt.status !== 'success') {
            throw new Error('Bridge transaction failed');
          }

          // Track bridge immediately after successful burn (for Live Activity)
          // We'll track again after mint to ensure it's recorded even if user closes browser
          trackSiteBridge(burnHash, address!, amount, 'to_arc');

          // Wait for attestation and relay
          setAttestationStatus('pending');
          
          // Show initial toast with counter
          let toastId: string | number | undefined;
          const updateToast = (seconds: number) => {
            if (toastId) {
              toast.loading(`Waiting for attestation... (${seconds}s)`, { id: toastId });
            } else {
              toastId = toast.loading(`Waiting for attestation... (${seconds}s)`, { duration: Infinity });
            }
          };
          updateToast(0);

          // Poll Circle API for attestation (up to 5 minutes)
          let attempts = 0;
          let messageBytes: `0x${string}` | null = null;
          let attestationBytes: `0x${string}` | null = null;
          const MAX_ATTEMPTS = 150; // 150 * 2 sec = 5 minutes

          debug(' Starting attestation polling for tx:', burnHash);
          while (attempts < MAX_ATTEMPTS) {
            await new Promise(r => setTimeout(r, 2000));
            attempts++;
            const seconds = attempts * 2;
            updateToast(seconds);
            
            try {
              const attestationUrl = `${CIRCLE_ATTESTATION_API}&domain=0&transactionHash=${burnHash}`;
              const response = await fetch(attestationUrl);
              
              if (!response.ok) {
                console.log(`[useBridgeCCTP] Attestation API error: ${response.status}, attempt ${attempts}`);
                continue;
              }
              
              const data = await response.json();
              console.log(`[useBridgeCCTP] Attestation check ${attempts}:`, data.messages?.[0]?.status || 'no status');
              
              if (data.messages?.[0]?.attestation && data.messages[0].attestation !== 'PENDING') {
                debug(' Attestation received!');
                messageBytes = data.messages[0].message as `0x${string}`;
                attestationBytes = data.messages[0].attestation as `0x${string}`;
                if (toastId) {
                  toast.dismiss(toastId);
                }
                break;
              }
            } catch (e) {
              console.error(`[useBridgeCCTP] Attestation polling error (attempt ${attempts}):`, e);
              // Continue polling on error
            }
          }

          if (!messageBytes || !attestationBytes) {
            // Timeout - save as pending burn so user can claim manually
            debug(' Attestation timeout after', attempts * 2, 'seconds');
            if (toastId) {
              toast.dismiss(toastId);
            }
            toast.warning('Attestation taking longer than expected', { 
              description: 'Your funds are safe. Click Claim when ready.',
              duration: 15000,
            });
            
            const newPendingBurn = {
              txHash: burnHash,
              fromNetwork,
              toNetwork,
              amount,
              timestamp: Date.now(),
            };
            
            if (address) {
              savePendingBurn(address, newPendingBurn);
            }
            
            setAttestationStatus('pending_mint');
            setState(prev => ({
              ...prev,
              isBridging: false,
              pendingBurn: newPendingBurn,
            }));
            return;
          }

          // Step 3: Call receiveMessage on Arc to mint USDC
          toast.info('Minting on Arc...', { description: 'Please confirm to receive your USDC' });
          setAttestationStatus('pending_mint');

          try {
            // Switch to Arc Testnet
            const targetChainId = SUPPORTED_NETWORKS.arcTestnet.chainId;
            if (account.chainId !== targetChainId) {
              await switchChainAsync({ chainId: targetChainId });
              
              // Wait and verify network switch actually happened
              const provider = (connectorClient as any)?.transport || (window as any).ethereum;
              if (!provider) {
                throw new Error('No wallet provider available');
              }
              
              // Poll until network is actually switched
              let attempts = 0;
              while (attempts < 10) {
                await new Promise(resolve => setTimeout(resolve, 500));
                const currentChainId = await provider.request({ method: 'eth_chainId' });
                const currentChainIdNumber = parseInt(currentChainId, 16);
                debug(' Current chain after switch:', currentChainIdNumber, 'Expected:', targetChainId);
                if (currentChainIdNumber === targetChainId) {
                  debug(' Network switch confirmed!');
                  break;
                }
                attempts++;
              }
              
              if (attempts >= 10) {
                throw new Error('Network switch timeout - please switch to Arc Testnet manually');
              }
            }

            // Get fresh provider after network switch and create new wallet client
            const provider = (connectorClient as any)?.transport || (window as any).ethereum;
            if (!provider) {
              throw new Error('No wallet provider available after network switch');
            }

            // Verify chain one more time before creating client
            const currentChainId = await provider.request({ method: 'eth_chainId' });
            const currentChainIdNumber = parseInt(currentChainId, 16);
            if (currentChainIdNumber !== targetChainId) {
              throw new Error(`Network not switched: current ${currentChainIdNumber}, expected ${targetChainId}`);
            }

            // Create new wallet client for Arc network
            const arcWalletClient = createWalletClient({
              chain: arcTestnetChain,
              transport: custom(provider),
            });

            debug(' Created Arc wallet client, calling receiveMessage...');

            // Call receiveMessage on Arc's MessageTransmitter
            const mintHash = await arcWalletClient.writeContract({
              chain: arcTestnetChain,
              account: address as `0x${string}`,
              address: CCTP_CONTRACTS.arcTestnet.MessageTransmitter,
              abi: [{
                name: 'receiveMessage',
                type: 'function',
                stateMutability: 'nonpayable',
                inputs: [
                  { name: 'message', type: 'bytes' },
                  { name: 'attestation', type: 'bytes' }
                ],
                outputs: [{ name: 'success', type: 'bool' }]
              }],
              functionName: 'receiveMessage',
              args: [messageBytes, attestationBytes],
            });

            debug(' Mint tx sent:', mintHash);
            mintTxHashRef.current = mintHash; // Mark that mint tx was sent

            const mintReceipt = await arcClient!.waitForTransactionReceipt({ hash: mintHash });

            if (mintReceipt.status === 'success') {
              debug(' Mint confirmed!');
              // Bridge already tracked after burn, but ensure it's recorded (upsert handles duplicates)
              trackSiteBridge(burnHash, address!, amount, 'to_arc');
              setAttestationStatus('complete');
              savePendingBurn(address!, null); // Clear pending burn from localStorage
              toast.success('Bridge completed!', { description: 'Your USDC has arrived on Arc Testnet' });
              setState(prev => ({ ...prev, isBridging: false, mintConfirmed: true, pendingBurn: null }));
            } else {
              throw new Error('Mint transaction failed');
            }
          } catch (mintError: any) {
            console.error('[useBridgeCCTP] Mint error:', mintError);
            
            // Check if error is about network switch
            const errorMsg = mintError.message || mintError.toString() || '';
            const isNetworkError = errorMsg.includes('chain') || 
                                   errorMsg.includes('network') || 
                                   errorMsg.includes('Chain ID') ||
                                   errorMsg.includes('not switched') ||
                                   errorMsg.includes('does not match') ||
                                   errorMsg.includes('current') && errorMsg.includes('expected');
            
            if (isNetworkError) {
              debug(' Network switch error detected:', errorMsg);
              toast.error('Network switch required', { 
                description: 'Please switch to Arc Testnet manually and try claiming again.',
                duration: 15000,
              });
              setState(prev => ({
                ...prev,
                isBridging: false,
                pendingBurn: { txHash: burnHash, fromNetwork, toNetwork, amount, timestamp: Date.now() }
              }));
              return;
            }
            
            // Check if already minted (nonce already used)
            if (mintError.message?.includes('Nonce already used') || mintError.message?.includes('already')) {
              setAttestationStatus('complete');
              savePendingBurn(address!, null); // Clear pending burn
              toast.success('Bridge completed!', { description: 'USDC already minted on Arc' });
              setState(prev => ({ ...prev, isBridging: false, mintConfirmed: true, pendingBurn: null }));
            } else if (mintTxHashRef.current) {
              // Mint tx was sent but confirmation failed - show waiting message, not error
              debug(' Mint tx was sent, waiting for confirmation...');
              toast.info('Mint transaction sent!', { 
                description: 'Waiting for confirmation. Your USDC will arrive shortly.',
                duration: 10000,
              });
              setState(prev => ({
                ...prev,
                isBridging: false,
                pendingBurn: { txHash: burnHash, fromNetwork, toNetwork, amount, timestamp: Date.now() }
              }));
            } else {
              // Mint tx was never sent - show error
              toast.error('Mint failed', { description: mintError.message || 'Please try claiming manually' });
              setState(prev => ({
                ...prev,
                isBridging: false,
                pendingBurn: { txHash: burnHash, fromNetwork, toNetwork, amount, timestamp: Date.now() }
              }));
            }
          }
          return;
        }

        // Arc → Sepolia: use Bridge Kit SDK
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
            debug(' Progress event:', safeStringify(progress));
            debug(' Progress keys:', Object.keys(progress));

            // Handle different progress stages
            const eventType = progress.type || progress.event || progress.status || progress.stage;
            debug(' Event type detected:', eventType);

            switch (eventType) {
              case 'approval':
              case 'APPROVAL_STARTED':
                toast.info('Approving USDC...');
                approvalStartedRef.current = true;
                // Capture tx hash if available
                if (progress.txHash || progress.transactionHash) {
                  approvalTxHashRef.current = progress.txHash || progress.transactionHash;
                  debug(' Approval tx hash:', approvalTxHashRef.current);
                }
                break;

              case 'APPROVAL_CONFIRMED':
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
                burnConfirmedRef.current = true;
                setAttestationStatus('attested');
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
                mintConfirmedRef.current = true;
                setState(prev => ({ ...prev, mintConfirmed: true }));
                break;

              default:
                debug(' Unknown progress event:', eventType);
            }
          },
        });

        debug(' Bridge result:', result);
        debug(' Result state:', result?.state);
        debug(' Result steps:', result?.steps);

        // Analyze result.steps to determine what happened
        const steps = result?.steps || [];
        debug(' All steps:', safeStringify(steps, 2));
        const burnStep = steps.find((s: any) =>
          s.name?.toLowerCase().includes('burn') ||
          s.name?.toLowerCase().includes('deposit') ||
          s.type?.toLowerCase().includes('burn')
        );
        debug(' Burn step details:', safeStringify(burnStep, 2));
        const mintStep = steps.find((s: any) =>
          s.name?.toLowerCase().includes('mint') ||
          s.type?.toLowerCase().includes('mint')
        );

        // Check burn success - also use burnConfirmedRef as fallback (set during progress events)
        const burnSucceeded = burnStep?.state === 'success' || burnConfirmedRef.current;
        const mintSucceeded = mintStep?.state === 'success' || mintConfirmedRef.current;

        debug(' burnSucceeded:', burnSucceeded, 'mintSucceeded:', mintSucceeded, 'burnConfirmedRef:', burnConfirmedRef.current);

        // Check overall result state
        if (result?.state === 'success') {
          // Full success - track the bridge in site_bridges
          const burnTxHash = burnStep?.txHash || burnStep?.transactionHash;
          if (burnTxHash) {
            const direction = toNetwork === 'arcTestnet' ? 'to_arc' : 'to_sepolia';
            trackSiteBridge(burnTxHash, address!, amount, direction);
          }

          setAttestationStatus('complete');
          toast.success('Bridge completed!', {
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
          // Burn succeeded but SDK didn't confirm mint
          // Check Circle API - relay may have already completed the mint automatically
          debug(' Burn succeeded, checking if mint was auto-relayed...');
          let burnTxHash = burnTxHashRef.current || burnStep?.txHash || burnStep?.transactionHash;
          debug(' Burn tx hash:', burnTxHash);

          // Track the bridge
          if (burnTxHash) {
            const direction = toNetwork === 'arcTestnet' ? 'to_arc' : 'to_sepolia';
            trackSiteBridge(burnTxHash, address!, amount, direction);
          }

          // Check Circle API to see if relay already completed
          let relayCompleted = false;
          if (burnTxHash) {
            try {
              const sourceDomain = CCTP_DOMAINS[fromNetwork];
              const attestationUrl = `${CIRCLE_ATTESTATION_API}&domain=${sourceDomain}&transactionHash=${burnTxHash}`;
              const response = await fetch(attestationUrl);
              const data = await response.json();

              if (data.messages && data.messages.length > 0) {
                const msg = data.messages[0];
                // If feeExecuted > 0 or status indicates completion, relay was done
                // Note: We check for attestation presence and assume success after ~30 sec
                if (msg.attestation && msg.attestation !== 'PENDING') {
                  // Wait a bit for relay to complete, then assume success
                  debug(' Attestation received, waiting for relay...');
                  await new Promise(resolve => setTimeout(resolve, 5000));
                  relayCompleted = true;
                }
              }
            } catch (e) {
              debug(' Could not check relay status:', e);
            }
          }

          if (relayCompleted) {
            // Relay likely completed - show success
            debug(' Relay appears complete, showing success');
            setAttestationStatus('complete');
            toast.success('Bridge completed!', {
              description: `Your USDC has been transferred to ${SUPPORTED_NETWORKS[toNetwork].name}`,
              duration: 10000,
            });
            setState(prev => ({
              ...prev,
              isBridging: false,
              result: null,
              mintConfirmed: true,
              pendingBurn: null,
            }));
          } else {
            // Check if mint was already confirmed (shouldn't show this message)
            // Only check mintConfirmedRef, not mintTxHashRef (tx might be pending)
            if (mintConfirmedRef.current) {
              debug(' Mint already confirmed, skipping pending claim message');
              return; // Don't show "Your funds are safe" if mint is confirmed
            }
            
            // Show pending claim UI
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
          }
        } else {
          // Only save pending burn if burn was actually confirmed
          // This prevents false positives from approval tx hashes
          if (burnConfirmedRef.current && burnTxHashRef.current) {
            debug(' Burn confirmed but result unclear, treating as pending claim:', burnTxHashRef.current);

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
            debug(' Bridge returned but no confirmed burn - approvalStarted:', approvalStartedRef.current, 'approvalConfirmed:', approvalConfirmedRef.current, 'approvalTxHash:', approvalTxHashRef.current);
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
              // Nothing happened according to refs - but Bridge Kit 1.2.0 may not fire events properly
              // Check if bridge actually completed by looking at the result object
              debug(' Checking result object for success:', safeStringify(result, 2));

              // Try to find any transaction hash in the result
              const anyTxHash = result?.steps?.find((s: any) => s.txHash || s.transactionHash)?.txHash ||
                               result?.steps?.find((s: any) => s.txHash || s.transactionHash)?.transactionHash ||
                               result?.txHash || result?.transactionHash;

              if (anyTxHash) {
                // Found a transaction - check Circle API
                debug(' Found tx hash in result, checking Circle API:', anyTxHash);
                try {
                  const sourceDomain = CCTP_DOMAINS[fromNetwork];
                  const attestationUrl = `${CIRCLE_ATTESTATION_API}&domain=${sourceDomain}&transactionHash=${anyTxHash}`;
                  const response = await fetch(attestationUrl);
                  const data = await response.json();

                  if (data.messages && data.messages.length > 0) {
                    const msg = data.messages[0];
                    if (msg.attestation && msg.attestation !== 'PENDING') {
                      // Bridge completed! Show success
                      debug(' Bridge actually completed! Attestation found.');
                      trackSiteBridge(anyTxHash, address!, amount, toNetwork === 'arcTestnet' ? 'to_arc' : 'to_sepolia');
                      setAttestationStatus('complete');
                      toast.success('Bridge completed!', {
                        description: `Your USDC has been transferred to ${SUPPORTED_NETWORKS[toNetwork].name}`,
                        duration: 10000,
                      });
                      setState(prev => ({
                        ...prev,
                        isBridging: false,
                        result: null,
                        mintConfirmed: true,
                        pendingBurn: null,
                      }));
                      return; // Exit early - bridge was successful
                    }
                  }
                } catch (e) {
                  debug(' Could not verify via Circle API:', e);
                }
              }

              // Truly nothing happened
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
          }
        }

      } catch (error: any) {
        console.error('[useBridgeCCTP] Bridge error:', error);
        debug(' Error object:', safeStringify(error, 2));
        debug(' Error steps:', error?.steps);
        debug(' On error - burnConfirmed ref:', burnConfirmedRef.current);

        let errorMsg = error?.message || 'An unexpected error occurred';

        // Handle common errors
        if (errorMsg.includes('User rejected') || errorMsg.includes('user rejected') || errorMsg.includes('User denied')) {
          errorMsg = 'Transaction rejected by user';
        } else if (errorMsg.includes('insufficient funds')) {
          errorMsg = 'Insufficient funds for gas';
        } else if (errorMsg.includes('allowance')) {
          errorMsg = 'Token approval failed';
        }

        // Only trust burnConfirmedRef - it's set when BURN_CONFIRMED event is received
        // Don't trust error.steps as it may incorrectly report approval as burn
        debug(' On error - burnConfirmedRef:', burnConfirmedRef.current, 'burnTxHashRef:', burnTxHashRef.current);

        // Check if error is about network switch - don't show "Your funds are safe" for network errors
        const isNetworkError = errorMsg.includes('chain') || 
                               errorMsg.includes('network') || 
                               errorMsg.includes('Chain ID') ||
                               errorMsg.includes('not switched') ||
                               errorMsg.includes('does not match') ||
                               (errorMsg.includes('current') && errorMsg.includes('expected'));
        
        if (isNetworkError && burnConfirmedRef.current) {
          debug(' Network switch error after burn - show network error, not "Your funds are safe"');
          toast.error('Network switch required', { 
            description: 'Please switch to Arc Testnet manually and try claiming again.',
            duration: 15000,
          });
          const burnTxHash = burnTxHashRef.current;
          setState(prev => ({
            ...prev,
            isBridging: false,
            pendingBurn: { txHash: burnTxHash, fromNetwork, toNetwork, amount, timestamp: Date.now() }
          }));
          return;
        }

        // Check if burn was actually confirmed (BURN_CONFIRMED event was received)
        if (burnConfirmedRef.current && burnTxHashRef.current) {
          // Don't show "Your funds are safe" if mint was already confirmed
          // Only check mintConfirmedRef, not mintTxHashRef (tx might be pending)
          if (mintConfirmedRef.current) {
            debug(' Mint already confirmed, skipping pending claim message');
            return;
          }
          
          debug(' Burn was confirmed before error - funds are safe');
          const burnTxHash = burnTxHashRef.current;
          debug(' Burn tx hash:', burnTxHash);

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

        // No burn happened - regular error (possibly just approval was done)
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
    [isConnected, address, connectorClient, walletClient, sepoliaClient, switchChainAsync, account.chainId, bridgeKit]
  );

  /**
   * Complete bridge - Bridge Kit handles this automatically
   * Kept for backwards compatibility with UI
   */
  const completeBridge = useCallback(async () => {
    // Bridge Kit handles the full flow (burn → attestation → mint) automatically
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
    debug(' Claiming pending bridge:', pendingBurn);

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
        const attestationUrl = `${CIRCLE_ATTESTATION_API}&domain=${domain}&transactionHash=${txHash}`;
        debug(' Trying domain', domain, 'URL:', attestationUrl);

        try {
          const attestationResponse = await fetch(attestationUrl);
          const attestationData = await attestationResponse.json();
          debug(' Attestation response for domain', domain, ':', attestationData);

          if (attestationData.messages && attestationData.messages.length > 0) {
            messageData = attestationData.messages[0];
            detectedDestNetwork = to;
            debug(' Found message on domain', domain, '- dest:', to);
            break;
          }
        } catch (e) {
          debug(' Domain', domain, 'failed, trying next...');
        }
      }

      if (!messageData) {
        throw new Error('Attestation is still being processed. This usually takes 1-3 minutes. Please wait a moment and try again.');
      }

      const destNetwork = detectedDestNetwork;
      const destContracts = CCTP_CONTRACTS[destNetwork];

      debug(' Dest network:', destNetwork);

      const attestation = messageData.attestation;
      const messageBytes = messageData.message; // Circle API returns the message bytes!

      if (!attestation || attestation === 'PENDING') {
        throw new Error('Attestation is still being processed. This usually takes 1-3 minutes. Please wait a moment and try again.');
      }

      if (!messageBytes) {
        throw new Error('Message bytes not found in attestation response');
      }

      debug(' Got message:', messageBytes);
      debug(' Got attestation:', attestation);

      // Step 3: Switch to destination network if needed
      const destChainId = SUPPORTED_NETWORKS[destNetwork].chainId;
      debug(' Current chain:', account.chainId, 'Destination chain:', destChainId);
      if (account.chainId !== destChainId) {
        toast.info(`Switching to ${SUPPORTED_NETWORKS[destNetwork].name}...`);
        if (!switchChainAsync) {
          throw new Error(`Please switch to ${SUPPORTED_NETWORKS[destNetwork].name} manually in MetaMask`);
        }
        try {
          await switchChainAsync({ chainId: destChainId });
          
          // Wait and verify network switch actually happened
          const provider = (connectorClient as any)?.transport || (window as any).ethereum;
          if (!provider) {
            throw new Error('No wallet provider available');
          }
          
          // Poll until network is actually switched
          let attempts = 0;
          while (attempts < 10) {
            await new Promise(resolve => setTimeout(resolve, 500));
            const currentChainId = await provider.request({ method: 'eth_chainId' });
            const currentChainIdNumber = parseInt(currentChainId, 16);
            debug(' Current chain after switch:', currentChainIdNumber, 'Expected:', destChainId);
            if (currentChainIdNumber === destChainId) {
              debug(' Network switch confirmed!');
              break;
            }
            attempts++;
          }
          
          if (attempts >= 10) {
            throw new Error('Network switch timeout - please switch to destination network manually');
          }
        } catch (switchError: any) {
          console.error('[useBridgeCCTP] Chain switch failed:', switchError);
          throw new Error(`Failed to switch network. Please switch to ${SUPPORTED_NETWORKS[destNetwork].name} manually.`);
        }
      }

      // Step 4: Call receiveMessage on MessageTransmitter
      toast.info('Claiming your USDC...');

      // Get fresh provider after network switch and create new wallet client
      const provider = (connectorClient as any)?.transport || (window as any).ethereum;
      if (!provider) {
        throw new Error('No wallet provider available after network switch');
      }

      // Verify chain one more time before creating client
      const currentChainId = await provider.request({ method: 'eth_chainId' });
      const currentChainIdNumber = parseInt(currentChainId, 16);
      if (currentChainIdNumber !== destChainId) {
        throw new Error(`Network not switched: current ${currentChainIdNumber}, expected ${destChainId}`);
      }

      // Get the correct chain object for the destination
      const destChain = destNetwork === 'arcTestnet' ? arcTestnetChain : sepolia;

      // Create new wallet client for destination network
      const destWalletClient = createWalletClient({
        chain: destChain,
        transport: custom(provider),
      });

      debug(' Created destination wallet client, calling receiveMessage...');

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

      const hash = await destWalletClient.writeContract({
        chain: destChain,
        account: address as `0x${string}`,
        address: destContracts.MessageTransmitter,
        abi: messageTransmitterABI,
        functionName: 'receiveMessage',
        args: [messageBytes as `0x${string}`, attestation as `0x${string}`],
      });

      debug(' Claim tx hash:', hash);
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

  // Keep ref updated for auto-claim from useEffect
  useEffect(() => {
    claimPendingBridgeRef.current = claimPendingBridge;
  }, [claimPendingBridge]);

  /**
   * Retry a failed bridge using Bridge Kit 1.3.0 retry method
   * Only works if we have a lastResult with error state
   */
  const retryBridge = useCallback(async () => {
    const lastResult = state.lastResult;
    if (!lastResult || lastResult.state !== 'error') {
      toast.error('No failed bridge to retry');
      return;
    }

    if (!isConnected || !address || !connectorClient) {
      toast.error('Please connect your wallet');
      return;
    }

    setState(prev => ({ ...prev, isBridging: true, error: null }));

    try {
      const provider = (connectorClient as any)?.transport || (window as any).ethereum;
      if (!provider) {
        throw new Error('No wallet provider available');
      }

      const adapter = await createAdapterFromProvider({ provider });

      debug(' Retrying failed bridge...');
      toast.info('Retrying bridge...');

      const retryResult = await bridgeKit.retry(lastResult as any, {
        from: adapter,
        to: adapter,
      });

      debug(' Retry result:', retryResult);

      if (retryResult.state === 'success') {
        toast.success('Bridge completed successfully!');
        setState(prev => ({
          ...prev,
          isBridging: false,
          mintConfirmed: true,
          lastResult: null,
          steps: retryResult.steps || [],
        }));
      } else {
        // Still failed - save for another retry
        const errorStep = retryResult.steps?.find((s: any) => s.state === 'error');
        const errorMsg = errorStep?.error || 'Retry failed';
        toast.error('Retry failed', { description: errorMsg });
        setState(prev => ({
          ...prev,
          isBridging: false,
          error: errorMsg,
          lastResult: retryResult as LastBridgeResult,
          steps: retryResult.steps || [],
        }));
      }

    } catch (error: any) {
      console.error('[useBridgeCCTP] Retry error:', error);
      toast.error('Retry failed', { description: error.message });
      setState(prev => ({ ...prev, isBridging: false, error: error.message }));
    }
  }, [state.lastResult, isConnected, address, connectorClient, bridgeKit]);

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
        const attestationUrl = `${CIRCLE_ATTESTATION_API}&domain=${domain}&transactionHash=${burnTxHash}`;
        debug(' Trying domain', domain, 'for:', burnTxHash);

        try {
          const response = await fetch(attestationUrl);
          const data = await response.json();

          if (data.messages && data.messages.length > 0) {
            messageData = data.messages[0];
            detectedFrom = from;
            detectedTo = to;
            debug(' Found message on domain', domain, '- direction:', from, '→', to);
            break;
          }
        } catch (e) {
          debug(' Domain', domain, 'failed, trying next...');
        }
      }

      if (!messageData) {
        return { success: false, message: 'No CCTP burn found for this transaction. Make sure this is a valid burn tx hash.', type: 'error' };
      }

      debug(' Attestation check response:', messageData);

      const decodedBody = messageData.decodedMessage?.decodedMessageBody;

      // Extract amount from Circle API (in smallest units, need to divide by 1e6)
      let detectedAmount = '0';
      if (decodedBody?.amount) {
        detectedAmount = (parseFloat(decodedBody.amount) / 1e6).toFixed(2);
        debug(' Detected amount from API:', detectedAmount, 'USDC');
      }

      // NOTE: We cannot reliably tell from Circle API if mint was already done
      // feeExecuted is just the fee amount, NOT an indicator of completion
      // Always allow claiming - if already claimed, receiveMessage will fail with "Nonce already used"

      // Check attestation status
      if (!messageData.attestation || messageData.attestation === 'PENDING') {
        return { success: false, message: 'Attestation is still being processed. This usually takes 1-3 minutes. Please wait a moment and try again.', type: 'error' };
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
      isEstimating: false,
      error: null,
      result: null,
      transactions: [],
      mintConfirmed: false,
      pendingBurn: null,
      estimate: null,
      steps: [],
      lastResult: null,
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
    // Bridge Kit 1.3.0 new features
    estimateBridge,
    retryBridge,
    canRetry: state.lastResult?.state === 'error',
    // Bridge Kit handles mint automatically, so no manual completion needed
    canCompleteBridge: false,
  };
};
