/**
 * vaultBatch - Encodes approve + action into a single Multicall3From batch for
 * the Circle server path, so the two-step "approve -> waitForCircleTx -> action"
 * flows collapse into one atomic contractExecution.
 *
 * Multicall3From preserves the original msg.sender (the Circle wallet EOA) via
 * the CallFrom precompile, so `approve` registers the allowance under the user
 * and the vault/swap action's transferFrom succeeds in the same tx. Because it's
 * atomic, we approve the EXACT amount (no more 10x standing allowance).
 */

import { encodeFunctionData } from 'viem';
import {
  MULTICALL3_FROM_ADDRESS,
  buildCall3,
  encodeAggregate3,
} from '../../src/lib/batchCall';

export { MULTICALL3_FROM_ADDRESS };

type Addr = `0x${string}`;
const hex = (a: string): Addr => a as Addr;

const APPROVE_ABI = [{
  type: 'function', name: 'approve', stateMutability: 'nonpayable',
  inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }],
  outputs: [{ name: '', type: 'bool' }],
}] as const;

const DEPOSIT_EURC_ABI = [{
  type: 'function', name: 'depositEURC', stateMutability: 'nonpayable',
  inputs: [{ name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'uint256' }],
}] as const;

const DEPOSIT_LOCKED_EURC_ABI = [{
  type: 'function', name: 'depositLockedEURC', stateMutability: 'nonpayable',
  inputs: [{ name: 'amount', type: 'uint256' }, { name: 'lockPeriodMonths', type: 'uint8' }],
  outputs: [{ name: '', type: 'uint256' }],
}] as const;

const SWAP_EURC_USDC_ABI = [{
  type: 'function', name: 'swapEurcForUsdc', stateMutability: 'nonpayable',
  inputs: [{ name: 'eurcIn', type: 'uint256' }, { name: 'minUsdcOut', type: 'uint256' }],
  outputs: [{ name: '', type: 'uint256' }],
}] as const;

const approveData = (spender: string, amount: bigint) =>
  encodeFunctionData({ abi: APPROVE_ABI, functionName: 'approve', args: [hex(spender), amount] });

/** approve(EURC->vault) + depositEURC(amount) */
export function eurcDepositBatch(eurc: string, vault: string, amountMicro: bigint): `0x${string}` {
  return encodeAggregate3([
    buildCall3(hex(eurc), approveData(vault, amountMicro)),
    buildCall3(hex(vault), encodeFunctionData({ abi: DEPOSIT_EURC_ABI, functionName: 'depositEURC', args: [amountMicro] })),
  ]);
}

/** approve(EURC->vault) + depositLockedEURC(amount, months) */
export function lockedEurcDepositBatch(eurc: string, vault: string, amountMicro: bigint, months: number): `0x${string}` {
  return encodeAggregate3([
    buildCall3(hex(eurc), approveData(vault, amountMicro)),
    buildCall3(hex(vault), encodeFunctionData({ abi: DEPOSIT_LOCKED_EURC_ABI, functionName: 'depositLockedEURC', args: [amountMicro, months] })),
  ]);
}

/** approve(EURC->swap) + swapEurcForUsdc(eurcIn, minUsdcOut) */
export function eurcSwapBatch(eurc: string, swap: string, eurcMicro: bigint, minUsdcOutWei: bigint): `0x${string}` {
  return encodeAggregate3([
    buildCall3(hex(eurc), approveData(swap, eurcMicro)),
    buildCall3(hex(swap), encodeFunctionData({ abi: SWAP_EURC_USDC_ABI, functionName: 'swapEurcForUsdc', args: [eurcMicro, minUsdcOutWei] })),
  ]);
}

// NOTE: add-liquidity is payable (native USDC). Arc's Multicall3From has no
// aggregate3Value, so it cannot be batched and stays a two-step flow in vault.ts.
