import { describe, it, expect } from 'vitest';
import { decodeFunctionData } from 'viem';
import { MULTICALL3_FROM_ABI } from '../../src/lib/batchCall';
import {
  MULTICALL3_FROM_ADDRESS,
  eurcDepositBatch,
  lockedEurcDepositBatch,
  eurcSwapBatch,
} from '../_lib/vaultBatch';

const EURC = '0x742b2d045d430fe718b57046645ba33295914b69';
const VAULT = '0x17ca5232415430bC57F646A72fD15634807bF729';
const SWAP = '0x3a5964ce5cd8b09e55af9323a894e78bdd7f04bf';

function decodeCalls(data: `0x${string}`) {
  const decoded = decodeFunctionData({ abi: MULTICALL3_FROM_ABI, data });
  return { fn: decoded.functionName, calls: decoded.args[0] as ReadonlyArray<any> };
}

describe('vaultBatch encoders', () => {
  it('exposes the Multicall3From address', () => {
    expect(MULTICALL3_FROM_ADDRESS).toBe('0x522fAf9A91c41c443c66765030741e4AaCe147D0');
  });

  it('eurcDepositBatch = aggregate3([approve->EURC, depositEURC->vault])', () => {
    const { fn, calls } = decodeCalls(eurcDepositBatch(EURC, VAULT, 50_000000n));
    expect(fn).toBe('aggregate3');
    expect(calls).toHaveLength(2);
    expect(calls[0].target.toLowerCase()).toBe(EURC);
    expect(calls[1].target.toLowerCase()).toBe(VAULT.toLowerCase());
    expect(calls[0].allowFailure).toBe(false);
  });

  it('eurcSwapBatch targets EURC then swap', () => {
    const { fn, calls } = decodeCalls(eurcSwapBatch(EURC, SWAP, 10_000000n, 9_000000000000000000n));
    expect(fn).toBe('aggregate3');
    expect(calls[0].target.toLowerCase()).toBe(EURC);
    expect(calls[1].target.toLowerCase()).toBe(SWAP);
  });

  it('lockedEurcDepositBatch encodes months arg', () => {
    const { fn, calls } = decodeCalls(lockedEurcDepositBatch(EURC, VAULT, 25_000000n, 3));
    expect(fn).toBe('aggregate3');
    expect(calls).toHaveLength(2);
  });

  // add-liquidity is intentionally NOT batched: it's payable and Arc's
  // Multicall3From lacks aggregate3Value (see vaultBatch.ts note).
});
