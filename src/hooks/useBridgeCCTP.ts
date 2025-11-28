/**
 * useBridgeCCTP - Arc Bridge Implementation for Sepolia → Arc Testnet
 *
 * This hook uses Arc's custom bridge wrapper that handles CCTP routing.
 * NOTE: Arc Testnet is not officially supported by Circle's CCTP on Sepolia,
 * so Arc provides a custom bridge contract that wraps the CCTP flow.
 *
 * Flow:
 * 1. Approve USDC to Arc Bridge contract
 * 2. Call bridgeWithPreapproval() on Arc Bridge (handles burn internally)
 * 3. Arc Bridge routes to destination chain automatically
 * 4. Tokens are minted on Arc Testnet
 *
 * References:
 * - Working transaction: https://sepolia.etherscan.io/tx/0x0aede40986b5db5af58423740bc802f1ef0a9aafb8285446103c55a4b8b7f9d4
 * - Arc Bridge Contract: 0xC5567a5E3370d4DBfB0540025078e283e36A363d
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useAccount, useWalletClient, useSwitchChain } from 'wagmi';
import { SUPPORTED_NETWORKS, TOKEN_ADDRESSES, ARC_BRIDGE_CONTRACT, CCTP_CONTRACTS } from '@/lib/constants';
import { ARC_BRIDGE_ABI, ERC20_ABI, CCTP_DOMAIN_IDS, MESSAGE_TRANSMITTER_ABI } from '@/lib/cctp-abis';
import { toast } from 'sonner';
import { createPublicClient, http, parseUnits, pad, toHex } from 'viem';
import { sepolia } from 'viem/chains';
import { defineChain } from 'viem';

// Arc Testnet chain definition
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

interface BridgeState {
  isBridging: boolean;
  error: string | null;
  result: any | null;
  transactions: BridgeTransaction[];
}

interface AttestationResult {
  status: string;
  attestation?: string;
  message?: string;
}

/**
 * Helper: Convert address to bytes32 format for CCTP
 * CCTP uses bytes32 for addresses (left-padded with zeros)
 */
function addressToBytes32(address: `0x${string}`): `0x${string}` {
  // Remove '0x' prefix, pad to 64 chars (32 bytes), add '0x' back
  return pad(address, { size: 32 }) as `0x${string}`;
}

/**
 * Helper: Fetch attestation from Circle API
 */
async function getAttestation(
  burnTxHash: string,
  sourceDomain: number
): Promise<AttestationResult> {
  const url = `https://iris-api-sandbox.circle.com/v2/messages/${sourceDomain}?transactionHash=${burnTxHash}`;
  console.log('[useBridgeCCTP] Fetching attestation from:', url);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Attestation API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  console.log('[useBridgeCCTP] Attestation response:', data);

  // CCTP V2 API returns messages array
  if (data.messages && data.messages.length > 0) {
    const firstMessage = data.messages[0];

    if (firstMessage.status === 'complete' && firstMessage.attestation) {
      return {
        status: 'complete',
        attestation: firstMessage.attestation,
        message: firstMessage.message,
      };
    }

    return {
      status: firstMessage.status || 'pending',
    };
  }

  // Fallback for empty response
  return {
    status: 'pending',
  };
}

/**
 * Helper: Poll for attestation with exponential backoff
 */
async function pollAttestation(
  burnTxHash: string,
  sourceDomain: number,
  onUpdate: (status: string) => void
): Promise<AttestationResult> {
  let attempts = 0;
  const maxAttempts = 60; // 60 attempts * 15 seconds = 15 minutes max
  const baseDelay = 15000; // 15 seconds

  while (attempts < maxAttempts) {
    try {
      const result = await getAttestation(burnTxHash, sourceDomain);

      if (result.status === 'complete' && result.attestation) {
        console.log('[useBridgeCCTP] Attestation received!');
        return result;
      }

      onUpdate(result.status);

      // Wait before next attempt (15 seconds)
      await new Promise(resolve => setTimeout(resolve, baseDelay));
      attempts++;

      console.log(`[useBridgeCCTP] Attestation attempt ${attempts}/${maxAttempts}, status: ${result.status}`);
    } catch (error) {
      console.error('[useBridgeCCTP] Error fetching attestation:', error);

      // Wait before retry on error
      await new Promise(resolve => setTimeout(resolve, baseDelay));
      attempts++;
    }
  }

  throw new Error('Attestation timeout - exceeded maximum wait time (15 minutes)');
}

export const useBridgeCCTP = () => {
  const account = useAccount();
  const address = account?.address;
  const isConnected = account?.isConnected ?? false;
  const { data: walletClient } = useWalletClient();
  const { switchChainAsync } = useSwitchChain();

  const [state, setState] = useState<BridgeState>({
    isBridging: false,
    error: null,
    result: null,
    transactions: [],
  });

  const [attestationStatus, setAttestationStatus] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Main bridge function - implements full CCTP flow
   */
  const bridge = useCallback(
    async ({ fromNetwork, toNetwork, amount }: BridgeParams) => {
      if (!isConnected || !address || !walletClient) {
        toast.error('Please connect your wallet first');
        return;
      }

      if (!amount || parseFloat(amount) <= 0) {
        toast.error('Please enter a valid amount');
        return;
      }

      // Only support Sepolia → Arc Testnet for now
      if (fromNetwork !== 'ethereumSepolia' || toNetwork !== 'arcTestnet') {
        toast.error('Only Ethereum Sepolia → Arc Testnet is supported');
        return;
      }

      setState({ isBridging: true, error: null, result: null, transactions: [] });
      setAttestationStatus(null);

      // Check if user is on the correct network
      const currentChainId = account.chainId;
      const requiredChainId = SUPPORTED_NETWORKS[fromNetwork].chainId;

      if (currentChainId !== requiredChainId) {
        try {
          toast.info(`Switching to ${SUPPORTED_NETWORKS[fromNetwork].name}...`);
          await switchChainAsync?.({ chainId: requiredChainId });
          toast.success('Network switched successfully!');
          // Wait a bit for wallet to update
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

      // Create abort controller for cleanup
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        // Step 0: Setup
        const usdcAddress = TOKEN_ADDRESSES.ethereumSepolia.USDC;
        const arcBridgeAddress = ARC_BRIDGE_CONTRACT;

        // Convert amount to wei (USDC on Sepolia uses 6 decimals)
        const amountWei = parseUnits(amount, 6);

        // Convert recipient address to bytes32
        const recipientBytes32 = addressToBytes32(address);

        // Destination domain for Arc Testnet
        const destinationDomain = CCTP_DOMAIN_IDS.arcTestnet;

        console.log('[useBridgeCCTP] Bridge params:', {
          from: fromNetwork,
          to: toNetwork,
          amount,
          amountWei: amountWei.toString(),
          recipient: address,
          recipientBytes32,
          destinationDomain,
          usdcAddress,
          arcBridgeAddress,
        });

        // Step 1: Check current allowance
        toast.info('Checking USDC allowance...');
        const publicClient = createPublicClient({
          chain: sepolia,
          transport: http('https://ethereum-sepolia-rpc.publicnode.com'),
        });

        const currentAllowance = await publicClient.readContract({
          address: usdcAddress,
          abi: ERC20_ABI,
          functionName: 'allowance',
          args: [address, arcBridgeAddress],
        });

        console.log('[useBridgeCCTP] Current allowance:', currentAllowance.toString());

        // Step 2: Approve USDC if needed
        if (currentAllowance < amountWei) {
          toast.info('Approving USDC to Arc Bridge...');

          const approveTxHash = await walletClient.writeContract({
            address: usdcAddress,
            abi: ERC20_ABI,
            functionName: 'approve',
            args: [arcBridgeAddress, amountWei],
            chain: sepolia,
          });

          console.log('[useBridgeCCTP] Approval tx:', approveTxHash);
          toast.info('Waiting for approval confirmation...');

          // Wait for approval confirmation
          const approvalReceipt = await publicClient.waitForTransactionReceipt({
            hash: approveTxHash,
            confirmations: 1,
          });

          if (approvalReceipt.status !== 'success') {
            throw new Error('Approval transaction failed');
          }

          toast.success('USDC approved successfully!');
        } else {
          console.log('[useBridgeCCTP] Sufficient allowance already exists');
        }

        // Step 3: Call bridgeWithPreapproval() on Arc Bridge
        toast.info('Initiating bridge transaction...');

        // IMPORTANT: We use raw calldata because the exact ABI signature is unknown
        // Method ID from working tx: 0xd0d4229a
        // Working transaction structure (9 params):
        // [amount, maxFee, 0, recipient(bytes32), 0, burnToken, bridgeContract, destDomain, finality]
        //
        // Analysis:
        // - Position 6 should be Arc Bridge address itself, not TokenMessenger!
        // - maxFee set to 100000 (0.1 USDC) to ensure relayer processes automatically
        // - Reference successful tx: 0x0aede40986b5db5af58423740bc802f1ef0a9aafb8285446103c55a4b8b7f9d4
        const methodId = '0xd0d4229a';

        // Encode parameters matching working transaction structure
        const param0 = pad(toHex(amountWei), { size: 32 }); // amount
        const param1 = pad(toHex(100000), { size: 32 }); // maxFee for CCTP relayer: 0.1 USDC (100000 = 0.1 * 1e6)
        const param2 = pad('0x0', { size: 32 }); // zero value (unknown purpose)
        const param3 = recipientBytes32; // recipient as bytes32
        const param4 = pad('0x0', { size: 32 }); // zero value (unknown purpose)
        const param5 = pad(usdcAddress, { size: 32 }); // burn token (USDC)
        const param6 = pad(arcBridgeAddress, { size: 32 }); // Arc Bridge address (NOT TokenMessenger!)
        const param7 = pad(toHex(destinationDomain), { size: 32 }); // destination domain (26)
        const param8 = pad(toHex(1000), { size: 32 }); // finality threshold

        // Construct raw calldata
        const calldata = (methodId +
          param0.slice(2) +
          param1.slice(2) +
          param2.slice(2) +
          param3.slice(2) +
          param4.slice(2) +
          param5.slice(2) +
          param6.slice(2) +
          param7.slice(2) +
          param8.slice(2)) as `0x${string}`;

        console.log('[useBridgeCCTP] Raw calldata:', calldata);
        console.log('[useBridgeCCTP] Expected method ID: 0xd0d4229a');

        // Send raw transaction
        const bridgeTxHash = await walletClient.sendTransaction({
          to: arcBridgeAddress,
          data: calldata,
          chain: sepolia,
        });

        console.log('[useBridgeCCTP] Bridge tx hash:', bridgeTxHash);

        setState(prev => ({
          ...prev,
          transactions: [{
            hash: bridgeTxHash,
            network: 'Ethereum Sepolia',
            explorerUrl: `https://sepolia.etherscan.io/tx/${bridgeTxHash}`,
            status: 'pending',
            step: 'Bridge via Arc Contract',
          }],
        }));

        toast.info('Waiting for bridge confirmation...');

        // Wait for bridge confirmation
        const bridgeReceipt = await publicClient.waitForTransactionReceipt({
          hash: bridgeTxHash,
          confirmations: 2,
        });

        if (bridgeReceipt.status !== 'success') {
          throw new Error('Bridge transaction failed');
        }

        console.log('[useBridgeCCTP] Bridge confirmed!', bridgeReceipt);

        // Update bridge transaction status
        setState(prev => ({
          ...prev,
          isBridging: false,
          transactions: prev.transactions.map(tx =>
            tx.hash === bridgeTxHash ? { ...tx, status: 'success' } : tx
          ),
        }));

        toast.success('Bridge transaction submitted successfully!', {
          description: `Burn completed on Sepolia. Arc Bridge relayer will automatically complete the mint on Arc Testnet in 10-15 minutes.`,
          duration: 15000,
        });

        // Step 4: Start polling for attestation (informational only - relayer will handle mint)
        setAttestationStatus('pending');
        toast.info('Waiting for Circle attestation and auto-relay...');

        try {
          const attestationResult = await pollAttestation(
            bridgeTxHash,
            CCTP_DOMAIN_IDS.ethereumSepolia,
            (status) => {
              setAttestationStatus(status);
              console.log('[useBridgeCCTP] Attestation status:', status);
            }
          );

          if (attestationResult.status === 'complete' && attestationResult.attestation) {
            setAttestationStatus('complete');
            toast.success('Attestation complete! Arc Bridge relayer will mint tokens shortly. Check your balance on Arc Testnet.', {
              duration: 20000,
            });

            // Store attestation for reference (optional manual completion if relayer fails)
            setState(prev => ({
              ...prev,
              result: {
                attestation: attestationResult.attestation,
                message: attestationResult.message,
              },
            }));
          }
        } catch (attestationError: any) {
          console.error('[useBridgeCCTP] Attestation error:', attestationError);
          setAttestationStatus('timeout');
          toast.warning('Attestation timeout. The bridge may still complete via Arc relayer. Check your Arc Testnet balance.', {
            duration: 10000,
          });
        }

      } catch (error: any) {
        console.error('[useBridgeCCTP] Bridge error:', error);

        let errorMsg = error?.message || 'An unexpected error occurred';

        // Handle user rejection
        if (errorMsg.includes('User rejected') || errorMsg.includes('user rejected')) {
          errorMsg = 'Transaction rejected by user';
        }

        setState(prev => ({
          ...prev,
          isBridging: false,
          error: errorMsg,
        }));

        toast.error('Bridge failed', {
          description: errorMsg,
          duration: 10000,
        });
      } finally {
        abortControllerRef.current = null;
      }
    },
    [isConnected, address, walletClient, switchChainAsync, account.chainId]
  );

  /**
   * Complete bridge - manually call receiveMessage() on Arc Testnet
   */
  const completeBridge = useCallback(async () => {
    if (!state.result?.attestation || !state.result?.message) {
      toast.error('No attestation available. Please wait for attestation first.');
      return;
    }

    if (!isConnected || !address || !walletClient) {
      toast.error('Please connect your wallet first');
      return;
    }

    // Check if user is on Arc Testnet
    const currentChainId = account.chainId;
    const requiredChainId = SUPPORTED_NETWORKS.arcTestnet.chainId;

    if (currentChainId !== requiredChainId) {
      try {
        toast.info('Switching to Arc Testnet...');
        await switchChainAsync?.({ chainId: requiredChainId });
        toast.success('Switched to Arc Testnet!');
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error: any) {
        console.error('[useBridgeCCTP] Network switch error:', error);
        toast.error('Failed to switch to Arc Testnet', {
          description: 'Please manually switch to Arc Testnet in your wallet',
        });
        return;
      }
    }

    setState(prev => ({ ...prev, isBridging: true, error: null }));
    toast.info('Completing bridge on Arc Testnet...');

    try {
      const messageTransmitter = CCTP_CONTRACTS.arcTestnet.MessageTransmitter;

      // Call receiveMessage() on Arc Testnet
      const mintTxHash = await walletClient.writeContract({
        address: messageTransmitter,
        abi: MESSAGE_TRANSMITTER_ABI,
        functionName: 'receiveMessage',
        args: [state.result.message, state.result.attestation],
        chain: arcTestnet,
      });

      console.log('[useBridgeCCTP] Mint tx hash:', mintTxHash);

      // Create Arc public client
      const arcPublicClient = createPublicClient({
        chain: arcTestnet,
        transport: http('https://rpc.testnet.arc.network'),
      });

      toast.info('Waiting for mint confirmation on Arc Testnet...');

      // Wait for mint confirmation
      const mintReceipt = await arcPublicClient.waitForTransactionReceipt({
        hash: mintTxHash,
        confirmations: 1,
      });

      if (mintReceipt.status !== 'success') {
        throw new Error('Mint transaction failed');
      }

      console.log('[useBridgeCCTP] Mint confirmed!', mintReceipt);

      setState(prev => ({
        ...prev,
        isBridging: false,
        transactions: [
          ...prev.transactions,
          {
            hash: mintTxHash,
            network: 'Arc Testnet',
            explorerUrl: `https://testnet.arcscan.app/tx/${mintTxHash}`,
            status: 'success',
            step: 'Mint on Arc Testnet',
          },
        ],
      }));

      // Reset state to allow new bridge after success
      setState({
        isBridging: false,
        error: null,
        result: null,
        transactions: [],
      });
      setAttestationStatus(null);

      toast.success('🎉 Bridge completed successfully!', {
        description: 'Your USDC has been minted on Arc Testnet. Check your wallet balance.',
        duration: 10000,
      });
    } catch (error: any) {
      console.error('[useBridgeCCTP] Complete bridge error:', error);

      let errorMsg = error?.message || 'An unexpected error occurred';

      if (errorMsg.includes('User rejected') || errorMsg.includes('user rejected')) {
        errorMsg = 'Transaction rejected by user';
      }

      setState(prev => ({
        ...prev,
        isBridging: false,
        error: errorMsg,
      }));

      toast.error('Failed to complete bridge', {
        description: errorMsg,
        duration: 10000,
      });
    }
  }, [state.result, isConnected, address, walletClient, switchChainAsync, account.chainId]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    ...state,
    bridge,
    completeBridge,
    attestationStatus,
    canCompleteBridge: !!state.result?.attestation && attestationStatus === 'complete',
  };
};
