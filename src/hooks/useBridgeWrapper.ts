/**
 * useBridgeWrapper - Bridge through our BridgeWrapper contract
 *
 * This hook bridges USDC from Arc Testnet to Sepolia using our BridgeWrapper contract.
 * Benefits:
 * - Tracks all bridges through our UI
 * - Collects small fee (0.05%)
 * - Enables accurate statistics
 *
 * Flow:
 * 1. User approves USDC to BridgeWrapper
 * 2. User calls bridgeToSepolia()
 * 3. BridgeWrapper takes fee, calls Circle CCTP
 * 4. User waits for attestation and claims on Sepolia
 */

import { useState, useCallback } from 'react';
import { useAccount, useWalletClient, usePublicClient, useSwitchChain } from 'wagmi';
import { parseUnits, formatUnits, encodeFunctionData, pad } from 'viem';
import { TREASURY_CONTRACTS, SUPPORTED_NETWORKS, TOKEN_ADDRESSES, CCTP_CONTRACTS, CCTP_DOMAINS, CIRCLE_ATTESTATION_API } from '@/lib/constants';
import { toast } from 'sonner';

const BRIDGE_WRAPPER_ADDRESS = TREASURY_CONTRACTS.BridgeWrapper;

const BRIDGE_WRAPPER_ABI = [
  {
    name: 'bridgeToSepolia',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'amount', type: 'uint256' },
      { name: 'mintRecipient', type: 'bytes32' }
    ],
    outputs: [{ name: 'nonce', type: 'uint64' }]
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

interface BridgeWrapperState {
  isBridging: boolean;
  isApproving: boolean;
  isClaiming: boolean;
  error: string | null;
  burnTxHash: string | null;
  claimTxHash: string | null;
  step: 'idle' | 'approving' | 'burning' | 'waiting_attestation' | 'claiming' | 'complete';
  fee: { amount: string; basisPoints: number } | null;
}

export const useBridgeWrapper = () => {
  const account = useAccount();
  const address = account?.address;
  const isConnected = account?.isConnected ?? false;
  const { data: walletClient } = useWalletClient();
  const arcClient = usePublicClient({ chainId: SUPPORTED_NETWORKS.arcTestnet.chainId });
  const sepoliaClient = usePublicClient({ chainId: SUPPORTED_NETWORKS.ethereumSepolia.chainId });
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
  });

  // Get current fee info
  const getFeeInfo = useCallback(async (amount: string) => {
    if (!arcClient || !amount || parseFloat(amount) <= 0) return null;

    try {
      const amountWei = parseUnits(amount, 18); // USDC on Arc has 18 decimals

      const [feeResult, bpsResult] = await Promise.all([
        arcClient.readContract({
          address: BRIDGE_WRAPPER_ADDRESS,
          abi: BRIDGE_WRAPPER_ABI,
          functionName: 'calculateFee',
          args: [amountWei],
        }),
        arcClient.readContract({
          address: BRIDGE_WRAPPER_ADDRESS,
          abi: BRIDGE_WRAPPER_ABI,
          functionName: 'feeBasisPoints',
        }),
      ]);

      const [feeWei] = feeResult as [bigint, bigint];
      const bps = bpsResult as bigint;

      return {
        amount: formatUnits(feeWei, 18),
        basisPoints: Number(bps),
      };
    } catch (e) {
      console.error('[useBridgeWrapper] Failed to get fee info:', e);
      return null;
    }
  }, [arcClient]);

  // Bridge USDC from Arc to Sepolia
  const bridgeToSepolia = useCallback(async (amount: string) => {
    if (!isConnected || !address || !walletClient || !arcClient) {
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
    });

    try {
      // Ensure we're on Arc Testnet
      if (account.chainId !== SUPPORTED_NETWORKS.arcTestnet.chainId) {
        toast.info('Switching to Arc Testnet...');
        await switchChainAsync?.({ chainId: SUPPORTED_NETWORKS.arcTestnet.chainId });
        await new Promise(r => setTimeout(r, 1000));
      }

      const amountWei = parseUnits(amount, 18); // USDC on Arc has 18 decimals
      const usdcAddress = TOKEN_ADDRESSES.arcTestnet.USDC;

      // Get fee info
      const feeInfo = await getFeeInfo(amount);
      setState(prev => ({ ...prev, fee: feeInfo }));

      // Check balance
      const balance = await arcClient.readContract({
        address: usdcAddress,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [address],
      }) as bigint;

      if (balance < amountWei) {
        throw new Error(`Insufficient balance. You have ${formatUnits(balance, 18)} USDC`);
      }

      // Check allowance
      const allowance = await arcClient.readContract({
        address: usdcAddress,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [address, BRIDGE_WRAPPER_ADDRESS],
      }) as bigint;

      // Approve if needed
      if (allowance < amountWei) {
        toast.info('Approving USDC...');
        setState(prev => ({ ...prev, isApproving: true }));

        const approveHash = await walletClient.writeContract({
          address: usdcAddress,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [BRIDGE_WRAPPER_ADDRESS, amountWei],
        });

        await arcClient.waitForTransactionReceipt({ hash: approveHash });
        toast.success('USDC approved!');
        setState(prev => ({ ...prev, isApproving: false }));
      }

      // Convert address to bytes32 for mint recipient
      const mintRecipient = pad(address as `0x${string}`, { size: 32 });

      // Call bridgeToSepolia
      toast.info('Initiating bridge...');
      setState(prev => ({ ...prev, step: 'burning' }));

      const burnHash = await walletClient.writeContract({
        address: BRIDGE_WRAPPER_ADDRESS,
        abi: BRIDGE_WRAPPER_ABI,
        functionName: 'bridgeToSepolia',
        args: [amountWei, mintRecipient],
      });

      setState(prev => ({ ...prev, burnTxHash: burnHash }));
      toast.info('Waiting for confirmation...');

      await arcClient.waitForTransactionReceipt({ hash: burnHash });
      toast.success('Bridge initiated! Waiting for attestation (~30 sec)...');

      setState(prev => ({
        ...prev,
        step: 'waiting_attestation',
        isBridging: false,
      }));

      // Return the burn tx hash for tracking
      return burnHash;

    } catch (error: any) {
      console.error('[useBridgeWrapper] Bridge error:', error);

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
  }, [isConnected, address, walletClient, arcClient, account.chainId, switchChainAsync, getFeeInfo]);

  // Claim USDC on Sepolia after attestation
  const claimOnSepolia = useCallback(async (burnTxHash: string) => {
    if (!walletClient || !sepoliaClient || !address) {
      toast.error('Please connect your wallet');
      return;
    }

    setState(prev => ({ ...prev, isClaiming: true, step: 'claiming', error: null }));

    try {
      // Fetch attestation from Circle API
      const sourceDomain = CCTP_DOMAINS.arcTestnet;
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

      // Switch to Sepolia
      if (account.chainId !== SUPPORTED_NETWORKS.ethereumSepolia.chainId) {
        toast.info('Switching to Sepolia...');
        await switchChainAsync?.({ chainId: SUPPORTED_NETWORKS.ethereumSepolia.chainId });
        await new Promise(r => setTimeout(r, 1000));
      }

      // Call receiveMessage on Sepolia MessageTransmitter
      toast.info('Claiming USDC...');

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

      const claimHash = await walletClient.writeContract({
        address: CCTP_CONTRACTS.ethereumSepolia.MessageTransmitter,
        abi: MESSAGE_TRANSMITTER_ABI,
        functionName: 'receiveMessage',
        args: [messageBytes as `0x${string}`, attestation as `0x${string}`],
      });

      await sepoliaClient.waitForTransactionReceipt({ hash: claimHash });

      toast.success('USDC claimed successfully!');
      setState(prev => ({
        ...prev,
        isClaiming: false,
        claimTxHash: claimHash,
        step: 'complete',
      }));

      return claimHash;

    } catch (error: any) {
      console.error('[useBridgeWrapper] Claim error:', error);

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
  }, [walletClient, sepoliaClient, address, account.chainId, switchChainAsync]);

  // Reset state
  const reset = useCallback(() => {
    setState({
      isBridging: false,
      isApproving: false,
      isClaiming: false,
      error: null,
      burnTxHash: null,
      claimTxHash: null,
      step: 'idle',
      fee: null,
    });
  }, []);

  return {
    ...state,
    bridgeToSepolia,
    claimOnSepolia,
    getFeeInfo,
    reset,
  };
};
