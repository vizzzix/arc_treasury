/**
 * Circle CCTP Contract ABIs
 *
 * These ABIs are for interacting directly with Circle's Cross-Chain Transfer Protocol (CCTP) contracts.
 * References:
 * - Circle CCTP Docs: https://developers.circle.com/stablecoins/docs/cctp-getting-started
 * - TokenMessenger: Handles burn and mint operations
 * - MessageTransmitter: Handles cross-chain message passing with attestations
 */

import { parseAbi } from 'viem';

/**
 * TokenMessenger ABI (CCTP V2)
 *
 * Main contract for burning USDC on source chain.
 * depositForBurn() is the key function that initiates the bridge.
 *
 * V2 Parameters:
 * - amount: USDC quantity to transfer (in smallest units)
 * - destinationDomain: Target blockchain ID
 * - mintRecipient: Receiving wallet address in bytes32 format
 * - burnToken: Source chain USDC contract address
 * - destinationCaller: Address authorized to call receiveMessage (use zero bytes32 for any caller)
 * - maxFee: Maximum transfer fee (in smallest units)
 * - minFinalityThreshold: 1000 or less for fast transfers
 */
export const TOKEN_MESSENGER_ABI = parseAbi([
  // CCTP V2 - Burn USDC with fee and finality params
  'function depositForBurn(uint256 amount, uint32 destinationDomain, bytes32 mintRecipient, address burnToken, bytes32 destinationCaller, uint256 maxFee, uint32 minFinalityThreshold) external returns (uint64 nonce)',

  // Get local minter address
  'function localMinter() external view returns (address)',

  // Events
  'event DepositForBurn(uint64 indexed nonce, address indexed burnToken, uint256 amount, address indexed depositor, bytes32 mintRecipient, uint32 destinationDomain, bytes32 destinationTokenMessenger, bytes32 destinationCaller)',
]) as const;

/**
 * MessageTransmitter ABI
 *
 * Contract for receiving bridged messages with Circle attestations.
 * receiveMessage() is called on destination chain to mint USDC.
 */
export const MESSAGE_TRANSMITTER_ABI = parseAbi([
  // Receive message with attestation to mint USDC
  'function receiveMessage(bytes message, bytes attestation) external returns (bool)',

  // Check if message has been used
  'function usedNonces(bytes32 hashSourceAndNonce) external view returns (uint256)',

  // Get attestation threshold
  'function attesterManager() external view returns (address)',

  // Events
  'event MessageReceived(address indexed caller, uint32 sourceDomain, uint64 indexed nonce, bytes32 sender, bytes messageBody)',
]) as const;

/**
 * ERC20 ABI (minimal)
 * For USDC approval operations
 */
export const ERC20_ABI = parseAbi([
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function balanceOf(address account) external view returns (uint256)',
  'function decimals() external view returns (uint8)',
]) as const;

/**
 * CCTP Domain IDs
 * Required for depositForBurn() destinationDomain parameter
 */
export const CCTP_DOMAIN_IDS = {
  ethereumSepolia: 0,
  arcTestnet: 26,
} as const;

/**
 * Arc Bridge ABI
 * Custom bridge wrapper for Arc Testnet that handles CCTP routing
 * Contract: 0xC5567a5E3370d4DBfB0540025078e283e36A363d (Sepolia)
 *
 * Based on working transaction: https://sepolia.etherscan.io/tx/0x0aede40986b5db5af58423740bc802f1ef0a9aafb8285446103c55a4b8b7f9d4
 */
export const ARC_BRIDGE_ABI = parseAbi([
  // Bridge with preapproval - includes destination token messenger and finality threshold
  'function bridgeWithPreapproval((uint256 amount, uint32 destinationDomain, bytes32 mintRecipient, address burnToken, address destinationTokenMessenger, uint32 destinationDomain2, uint32 finalityThreshold) bridgeParams) external returns (uint64 nonce)',
]) as const;
