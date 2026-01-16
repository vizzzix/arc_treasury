/**
 * useBridgeWrapperSepolia - Bridge through our BridgeWrapperSepolia contract
 *
 * This hook bridges USDC from Sepolia to Arc Testnet using our BridgeWrapper contract.
 * Benefits:
 * - Tracks all bridges through our UI
 * - Collects small fee (0.05%)
 * - Enables accurate statistics
 *
 * Flow (FULLY AUTOMATIC):
 * 1. User approves USDC to BridgeWrapperSepolia
 * 2. User calls bridgeToArc()
 * 3. BridgeWrapper takes fee, calls Circle CCTP
 * 4. Hook automatically polls for attestation (~30 sec)
 * 5. Hook automatically claims on Arc when attestation ready
 *
 * User confirmations required:
 * 1. Approve USDC (if needed)
 * 2. Bridge transaction
 * 3. Claim transaction on Arc
 */

import { useState, useCallback, useRef } from 'react';
import { useAccount, useWalletClient, usePublicClient, useSwitchChain } from 'wagmi';
import { parseUnits, formatUnits, pad, defineChain } from 'viem';
import { sepolia } from 'viem/chains';
import { TREASURY_CONTRACTS, SUPPORTED_NETWORKS, TOKEN_ADDRESSES, CCTP_CONTRACTS, CCTP_DOMAINS, CIRCLE_ATTESTATION_API } from '@/lib/constants';
import { toast } from 'sonner';

// Define Arc Testnet chain for viem
const arcTestnet = defineChain({
  id: SUPPORTED_NETWORKS.arcTestnet.chainId,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc-testnet.arcplatform.io'] },
  },
});

// Polling configuration
const ATTESTATION_POLL_INTERVAL = 10000; // 10 seconds
const ATTESTATION_MAX_ATTEMPTS = 30; // 5 minutes max wait

const BRIDGE_WRAPPER_SEPOLIA_ADDRESS = TREASURY_CONTRACTS.BridgeWrapperSepolia;

const BRIDGE_WRAPPER_ABI = [
  {
    name: 'bridgeToArc',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'amount', type: 'uint256' },
      { name: 'mintRecipient', type: 'bytes32' }
    ],
    outputs: [] // V7: no return value due to CCTP proxy issues
  },
  {
    name: 'calculateFee',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [
      { name: 'fee', type: 'uint256' },
      { name: 'bridgeAmount', type: 'uint256' }
    ]
  },
  {
    name: 'feeBasisPoints',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    name: 'addressToBytes32',
    type: 'function',
    stateMutability: 'pure',
    inputs: [{ name: 'addr', type: 'address' }],
    outputs: [{ name: '', type: 'bytes32' }]
  }
] as const;

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
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }]
  }
] as const;

const MESSAGE_TRANSMITTER_ABI = [
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

interface BridgeWrapperState {
  isBridging: boolean;
  isApproving: boolean;
  isClaiming: boolean;
  error: string | null;
  burnTxHash: string | null;
  claimTxHash: string | null;
  step: 'idle' | 'approving' | 'burning' | 'waiting_attestation' | 'claiming' | 'complete';
  fee: { amount: string; basisPoints: number } | null;
  attestationProgress: number; // 0-100 progress for attestation waiting
}

export const useBridgeWrapperSepolia = () => {
  const account = useAccount();
  const address = account?.address;
  const isConnected = account?.isConnected ?? false;
  const { data: walletClient } = useWalletClient();
  const sepoliaClient = usePublicClient({ chainId: SUPPORTED_NETWORKS.ethereumSepolia.chainId });
  const arcClient = usePublicClient({ chainId: SUPPORTED_NETWORKS.arcTestnet.chainId });
  const { switchChainAsync } = useSwitchChain();

  const [state, setState] = useState<BridgeWrapperState>({
    isBridging: false,
    isApproving: false,
    isClaiming: false,
    error: null,
    burnTxHash: null,
    claimTxHash: null,
    step: 'idle',
    fee: null,
    attestationProgress: 0,
  });

  // Ref to track if we're currently polling (to prevent double polling)
  const isPollingRef = useRef(false);

  // Get current fee info
  const getFeeInfo = useCallback(async (amount: string) => {
    if (!sepoliaClient || !amount || parseFloat(amount) <= 0) return null;

    try {
      const amountWei = parseUnits(amount, 6); // USDC on Sepolia has 6 decimals

      const [feeResult, bpsResult] = await Promise.all([
        sepoliaClient.readContract({
          address: BRIDGE_WRAPPER_SEPOLIA_ADDRESS,
          abi: BRIDGE_WRAPPER_ABI,
          functionName: 'calculateFee',
          args: [amountWei],
        }),
        sepoliaClient.readContract({
          address: BRIDGE_WRAPPER_SEPOLIA_ADDRESS,
          abi: BRIDGE_WRAPPER_ABI,
          functionName: 'feeBasisPoints',
        }),
      ]);

      const [feeWei] = feeResult as [bigint, bigint];
      const bps = bpsResult as bigint;

      return {
        amount: formatUnits(feeWei, 6),
        basisPoints: Number(bps),
      };
    } catch (e) {
      console.error('[useBridgeWrapperSepolia] Failed to get fee info:', e);
      return null;
    }
  }, [sepoliaClient]);

  // Poll for attestation and return message data when ready
  const pollForAttestation = useCallback(async (burnTxHash: string): Promise<{ message: string; attestation: string } | null> => {
    const sourceDomain = CCTP_DOMAINS.ethereumSepolia;
    const attestationUrl = `${CIRCLE_ATTESTATION_API}&domain=${sourceDomain}&transactionHash=${burnTxHash}`;

    for (let attempt = 0; attempt < ATTESTATION_MAX_ATTEMPTS; attempt++) {
      try {
        // Update progress
        const progress = Math.min(95, Math.round((attempt / ATTESTATION_MAX_ATTEMPTS) * 100));
        setState(prev => ({ ...prev, attestationProgress: progress }));

        const response = await fetch(attestationUrl);
        const data = await response.json();

        if (data.messages && data.messages.length > 0) {
          const messageData = data.messages[0];
          const attestation = messageData.attestation;
          const messageBytes = messageData.message;

          if (attestation && attestation !== 'PENDING') {
            console.log('[useBridgeWrapperSepolia] Attestation ready!');
            setState(prev => ({ ...prev, attestationProgress: 100 }));
            return { message: messageBytes, attestation };
          }
        }

        console.log(`[useBridgeWrapperSepolia] Attestation attempt ${attempt + 1}/${ATTESTATION_MAX_ATTEMPTS} - still pending...`);

        // Wait before next attempt
        await new Promise(r => setTimeout(r, ATTESTATION_POLL_INTERVAL));
      } catch (e) {
        console.error('[useBridgeWrapperSepolia] Attestation poll error:', e);
        // Continue polling despite errors
        await new Promise(r => setTimeout(r, ATTESTATION_POLL_INTERVAL));
      }
    }

    return null; // Timeout
  }, []);

  // Execute claim on Arc (internal function)
  const executeClaimOnArc = useCallback(async (messageBytes: string, attestation: string) => {
    if (!walletClient || !arcClient || !address) {
      throw new Error('Wallet not connected');
    }

    // Switch to Arc Testnet
    if (account.chainId !== SUPPORTED_NETWORKS.arcTestnet.chainId) {
      toast.info('Switching to Arc Testnet...');
      await switchChainAsync?.({ chainId: SUPPORTED_NETWORKS.arcTestnet.chainId });
      // Wait a bit longer for wallet to fully switch
      await new Promise(r => setTimeout(r, 2000));
    }

    console.log('[useBridgeWrapperSepolia] Executing claim on Arc...');
    console.log('[useBridgeWrapperSepolia] MessageTransmitter:', CCTP_CONTRACTS.arcTestnet.MessageTransmitter);

    const claimHash = await walletClient.writeContract({
      chain: arcTestnet,
      address: CCTP_CONTRACTS.arcTestnet.MessageTransmitter,
      abi: MESSAGE_TRANSMITTER_ABI,
      functionName: 'receiveMessage',
      args: [messageBytes as `0x${string}`, attestation as `0x${string}`],
    });

    console.log('[useBridgeWrapperSepolia] Claim TX sent:', claimHash);
    await arcClient.waitForTransactionReceipt({ hash: claimHash });

    return claimHash;
  }, [walletClient, arcClient, address, account.chainId, switchChainAsync]);

  // Bridge USDC from Sepolia to Arc (FULLY AUTOMATIC with attestation polling and claim)
  const bridgeToArc = useCallback(async (amount: string) => {
    if (!isConnected || !address || !walletClient || !sepoliaClient) {
      toast.error('Please connect your wallet');
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    setState({
      isBridging: true,
      isApproving: false,
      isClaiming: false,
      error: null,
      burnTxHash: null,
      claimTxHash: null,
      step: 'approving',
      fee: null,
      attestationProgress: 0,
    });

    try {
      // Ensure we're on Sepolia
      if (account.chainId !== SUPPORTED_NETWORKS.ethereumSepolia.chainId) {
        toast.info('Switching to Sepolia...');
        await switchChainAsync?.({ chainId: SUPPORTED_NETWORKS.ethereumSepolia.chainId });
        await new Promise(r => setTimeout(r, 1000));
      }

      const amountWei = parseUnits(amount, 6); // USDC on Sepolia has 6 decimals
      const usdcAddress = TOKEN_ADDRESSES.ethereumSepolia.USDC;

      // Get fee info
      const feeInfo = await getFeeInfo(amount);
      setState(prev => ({ ...prev, fee: feeInfo }));

      // Check balance
      const balance = await sepoliaClient.readContract({
        address: usdcAddress,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [address],
      }) as bigint;

      if (balance < amountWei) {
        throw new Error(`Insufficient balance. You have ${formatUnits(balance, 6)} USDC`);
      }

      // Check allowance
      const allowance = await sepoliaClient.readContract({
        address: usdcAddress,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [address, BRIDGE_WRAPPER_SEPOLIA_ADDRESS],
      }) as bigint;

      // Approve if needed (CONFIRMATION 1)
      if (allowance < amountWei) {
        toast.info('Approving USDC...');
        setState(prev => ({ ...prev, isApproving: true }));

        const approveHash = await walletClient.writeContract({
          chain: sepolia,
          address: usdcAddress,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [BRIDGE_WRAPPER_SEPOLIA_ADDRESS, amountWei],
        });

        await sepoliaClient.waitForTransactionReceipt({ hash: approveHash });
        toast.success('USDC approved!');
        setState(prev => ({ ...prev, isApproving: false }));
      }

      // Convert address to bytes32 for mint recipient
      const mintRecipient = pad(address as `0x${string}`, { size: 32 });

      // Call bridgeToArc (CONFIRMATION 2)
      toast.info('Initiating bridge...');
      setState(prev => ({ ...prev, step: 'burning' }));

      const burnHash = await walletClient.writeContract({
        chain: sepolia,
        address: BRIDGE_WRAPPER_SEPOLIA_ADDRESS,
        abi: BRIDGE_WRAPPER_ABI,
        functionName: 'bridgeToArc',
        args: [amountWei, mintRecipient],
      });

      setState(prev => ({ ...prev, burnTxHash: burnHash }));
      toast.info('Waiting for confirmation...');

      await sepoliaClient.waitForTransactionReceipt({ hash: burnHash });
      toast.success('Bridge initiated! Waiting for attestation (~30 sec)...');

      setState(prev => ({
        ...prev,
        step: 'waiting_attestation',
        isBridging: false,
        attestationProgress: 0,
      }));

      // Prevent double polling
      if (isPollingRef.current) {
        console.log('[useBridgeWrapperSepolia] Already polling, skipping...');
        return burnHash;
      }
      isPollingRef.current = true;

      // AUTOMATIC: Poll for attestation
      console.log('[useBridgeWrapperSepolia] Starting automatic attestation polling...');
      const attestationData = await pollForAttestation(burnHash);

      if (!attestationData) {
        isPollingRef.current = false;
        toast.error('Attestation timeout. Use "Claim" button to retry later.');
        setState(prev => ({
          ...prev,
          error: 'Attestation timeout after 5 minutes',
          step: 'waiting_attestation',
        }));
        return burnHash;
      }

      // AUTOMATIC: Claim on Arc (CONFIRMATION 3)
      toast.info('Attestation ready! Please confirm claim on Arc...');
      setState(prev => ({ ...prev, isClaiming: true, step: 'claiming' }));

      try {
        const claimHash = await executeClaimOnArc(attestationData.message, attestationData.attestation);

        toast.success('Bridge complete! USDC claimed on Arc.');
        setState(prev => ({
          ...prev,
          isClaiming: false,
          claimTxHash: claimHash,
          step: 'complete',
        }));
        isPollingRef.current = false;
        return burnHash;
      } catch (claimError: any) {
        console.error('[useBridgeWrapperSepolia] Auto-claim error:', claimError);

        let errorMsg = claimError?.message || 'Claim failed';

        // Check if already claimed
        if (errorMsg.includes('already received') || errorMsg.includes('Nonce already used')) {
          toast.success('Transfer already claimed!');
          setState(prev => ({
            ...prev,
            isClaiming: false,
            step: 'complete',
          }));
          isPollingRef.current = false;
          return burnHash;
        }

        // User rejected - stay in waiting_attestation so they can retry
        if (errorMsg.includes('User rejected') || errorMsg.includes('user rejected')) {
          toast.error('Claim rejected. Use "Claim" button to retry.');
          setState(prev => ({
            ...prev,
            isClaiming: false,
            step: 'waiting_attestation',
            error: 'Claim transaction rejected',
          }));
          isPollingRef.current = false;
          return burnHash;
        }

        toast.error('Auto-claim failed. Use "Claim" button to retry.', { description: errorMsg });
        setState(prev => ({
          ...prev,
          isClaiming: false,
          step: 'waiting_attestation',
          error: errorMsg,
        }));
        isPollingRef.current = false;
        return burnHash;
      }

    } catch (error: any) {
      console.error('[useBridgeWrapperSepolia] Bridge error:', error);

      let errorMsg = error?.message || 'Bridge failed';
      if (errorMsg.includes('User rejected') || errorMsg.includes('user rejected')) {
        errorMsg = 'Transaction rejected';
      }

      setState(prev => ({
        ...prev,
        isBridging: false,
        isApproving: false,
        error: errorMsg,
        step: 'idle',
      }));

      toast.error('Bridge failed', { description: errorMsg });
      return null;
    }
  }, [isConnected, address, walletClient, sepoliaClient, account.chainId, switchChainAsync, getFeeInfo, pollForAttestation, executeClaimOnArc]);

  // Manual claim (kept for recovery if user rejected auto-claim or timeout occurred)
  const claimOnArc = useCallback(async (burnTxHash: string) => {
    if (!walletClient || !arcClient || !address) {
      toast.error('Please connect your wallet');
      return;
    }

    setState(prev => ({ ...prev, isClaiming: true, step: 'claiming', error: null }));

    try {
      // Fetch attestation from Circle API
      const sourceDomain = CCTP_DOMAINS.ethereumSepolia;
      const attestationUrl = `${CIRCLE_ATTESTATION_API}&domain=${sourceDomain}&transactionHash=${burnTxHash}`;

      toast.info('Fetching attestation...');

      const response = await fetch(attestationUrl);
      const data = await response.json();

      if (!data.messages || data.messages.length === 0) {
        throw new Error('Attestation not ready. Please try again in a few minutes.');
      }

      const messageData = data.messages[0];
      const attestation = messageData.attestation;
      const messageBytes = messageData.message;

      if (!attestation || attestation === 'PENDING') {
        throw new Error('Attestation still pending. Please wait a few more minutes.');
      }

      toast.info('Claiming USDC...');
      const claimHash = await executeClaimOnArc(messageBytes, attestation);

      toast.success('USDC claimed successfully!');
      setState(prev => ({
        ...prev,
        isClaiming: false,
        claimTxHash: claimHash,
        step: 'complete',
      }));

      return claimHash;

    } catch (error: any) {
      console.error('[useBridgeWrapperSepolia] Claim error:', error);

      let errorMsg = error?.message || 'Claim failed';

      // Check if already claimed
      if (errorMsg.includes('already received') || errorMsg.includes('Nonce already used')) {
        toast.success('Transfer already claimed!');
        setState(prev => ({
          ...prev,
          isClaiming: false,
          step: 'complete',
        }));
        return;
      }

      setState(prev => ({
        ...prev,
        isClaiming: false,
        error: errorMsg,
      }));

      toast.error('Claim failed', { description: errorMsg });
      return null;
    }
  }, [walletClient, arcClient, address, executeClaimOnArc]);

  // Reset state
  const reset = useCallback(() => {
    isPollingRef.current = false;
    setState({
      isBridging: false,
      isApproving: false,
      isClaiming: false,
      error: null,
      burnTxHash: null,
      claimTxHash: null,
      step: 'idle',
      fee: null,
      attestationProgress: 0,
    });
  }, []);

  return {
    ...state,
    bridgeToArc,
    claimOnArc,
    getFeeInfo,
    reset,
  };
};
