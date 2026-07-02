/**
 * batchCall - Helpers for Arc Multicall3From batched transactions.
 *
 * Multicall3From (Arc Testnet predeploy) batches multiple calls in a single tx
 * while preserving the original msg.sender in each subcall via the CallFrom
 * precompile. This lets us collapse approve + action flows (e.g. EURC approve +
 * swap) into one atomic transaction, with the user EOA still seen as msg.sender
 * so allowances register under the user, not the multicall.
 *
 * Used by both the MetaMask path (wagmi writeContract with this ABI) and the
 * Circle path (encode the outer calldata and pass it as raw `callData`).
 */

import { encodeFunctionData, type Abi, type Hex } from 'viem';
import { MULTICALL3_FROM_ADDRESS } from './constants';

export { MULTICALL3_FROM_ADDRESS };

export const MULTICALL3_FROM_ABI = [
  {
    type: 'function',
    name: 'aggregate3',
    stateMutability: 'payable',
    inputs: [
      {
        name: 'calls',
        type: 'tuple[]',
        components: [
          { name: 'target', type: 'address' },
          { name: 'allowFailure', type: 'bool' },
          { name: 'callData', type: 'bytes' },
        ],
      },
    ],
    outputs: [
      {
        name: 'returnData',
        type: 'tuple[]',
        components: [
          { name: 'success', type: 'bool' },
          { name: 'returnData', type: 'bytes' },
        ],
      },
    ],
  },
  {
    type: 'function',
    name: 'aggregate3Value',
    stateMutability: 'payable',
    inputs: [
      {
        name: 'calls',
        type: 'tuple[]',
        components: [
          { name: 'target', type: 'address' },
          { name: 'allowFailure', type: 'bool' },
          { name: 'value', type: 'uint256' },
          { name: 'callData', type: 'bytes' },
        ],
      },
    ],
    outputs: [
      {
        name: 'returnData',
        type: 'tuple[]',
        components: [
          { name: 'success', type: 'bool' },
          { name: 'returnData', type: 'bytes' },
        ],
      },
    ],
  },
] as const satisfies Abi;

export interface Call3 {
  target: `0x${string}`;
  allowFailure: boolean;
  callData: Hex;
}

export interface Call3Value {
  target: `0x${string}`;
  allowFailure: boolean;
  value: bigint;
  callData: Hex;
}

/**
 * Build a single Call3 entry. Defaults allowFailure to false so any reverting
 * subcall reverts the whole batch (the desired behavior for approve + action).
 */
export function buildCall3(
  target: `0x${string}`,
  callData: Hex,
  allowFailure = false,
): Call3 {
  return { target, allowFailure, callData };
}

/** Build a single Call3Value entry (for payable subcalls, e.g. native USDC). */
export function buildCall3Value(
  target: `0x${string}`,
  callData: Hex,
  value: bigint,
  allowFailure = false,
): Call3Value {
  return { target, allowFailure, value, callData };
}

/** Encode the outer aggregate3 calldata (for the Circle raw-callData path). */
export function encodeAggregate3(calls: readonly Call3[]): Hex {
  return encodeFunctionData({
    abi: MULTICALL3_FROM_ABI,
    functionName: 'aggregate3',
    args: [calls],
  });
}

/**
 * Encode the outer aggregate3Value calldata.
 *
 * ⚠️ Arc Testnet's Multicall3From does NOT implement aggregate3Value (verified:
 * selector 0x174dea71 absent from bytecode) — calling it reverts empty. Payable
 * subcalls (native USDC) therefore cannot be batched on Arc and must stay
 * two-step. Kept for completeness / other chains only.
 */
export function encodeAggregate3Value(calls: readonly Call3Value[]): Hex {
  return encodeFunctionData({
    abi: MULTICALL3_FROM_ABI,
    functionName: 'aggregate3Value',
    args: [calls],
  });
}

/** Sum of per-call values — the msg.value that must accompany aggregate3Value. */
export function totalValue(calls: readonly Call3Value[]): bigint {
  return calls.reduce((sum, c) => sum + c.value, 0n);
}
