import { describe, it, expect } from 'vitest';
import { decodeFunctionData, encodeFunctionData, parseEther, parseUnits, type Abi } from 'viem';
import {
  MULTICALL3_FROM_ABI,
  MULTICALL3_FROM_ADDRESS,
  buildCall3,
  buildCall3Value,
  encodeAggregate3,
  encodeAggregate3Value,
  totalValue,
} from '../batchCall';

const EURC = '0x742b2d045d430fe718b57046645ba33295914b69' as const;
const SWAP = '0x3a5964ce5cd8b09e55af9323a894e78bdd7f04bf' as const;

const ERC20_APPROVE_ABI = [
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const satisfies Abi;

const SWAP_EURC_USDC_ABI = [
  {
    type: 'function',
    name: 'swapEurcForUsdc',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'eurcIn', type: 'uint256' },
      { name: 'minUsdcOut', type: 'uint256' },
    ],
    outputs: [],
  },
] as const satisfies Abi;

describe('batchCall', () => {
  it('exposes the Arc Multicall3From predeploy address', () => {
    expect(MULTICALL3_FROM_ADDRESS).toBe('0x522fAf9A91c41c443c66765030741e4AaCe147D0');
  });

  it('buildCall3 defaults allowFailure to false', () => {
    expect(buildCall3(EURC, '0x1234')).toEqual({
      target: EURC,
      allowFailure: false,
      callData: '0x1234',
    });
  });

  it('buildCall3 honors an explicit allowFailure', () => {
    expect(buildCall3(EURC, '0x1234', true).allowFailure).toBe(true);
  });

  it('encodeAggregate3 round-trips an approve + swap batch', () => {
    const amountWei = parseUnits('5', 6);
    const approveData = encodeFunctionData({
      abi: ERC20_APPROVE_ABI,
      functionName: 'approve',
      args: [SWAP, amountWei],
    });
    const swapData = encodeFunctionData({
      abi: SWAP_EURC_USDC_ABI,
      functionName: 'swapEurcForUsdc',
      args: [amountWei, parseEther('5')],
    });

    const encoded = encodeAggregate3([
      buildCall3(EURC, approveData),
      buildCall3(SWAP, swapData),
    ]);

    const decoded = decodeFunctionData({ abi: MULTICALL3_FROM_ABI, data: encoded });
    expect(decoded.functionName).toBe('aggregate3');

    const calls = decoded.args[0] as ReadonlyArray<{
      target: string;
      allowFailure: boolean;
      callData: string;
    }>;
    expect(calls).toHaveLength(2);
    expect(calls[0].target.toLowerCase()).toBe(EURC);
    expect(calls[0].allowFailure).toBe(false);
    expect(calls[0].callData).toBe(approveData);
    expect(calls[1].target.toLowerCase()).toBe(SWAP);
    expect(calls[1].callData).toBe(swapData);
  });

  it('totalValue sums per-call values for a payable batch', () => {
    const calls = [
      buildCall3Value(EURC, '0xaa', 0n),
      buildCall3Value(SWAP, '0xbb', parseEther('10')),
    ];
    expect(totalValue(calls)).toBe(parseEther('10'));
  });

  it('encodeAggregate3Value preserves per-call value', () => {
    const usdcValue = parseEther('10');
    const encoded = encodeAggregate3Value([
      buildCall3Value(EURC, '0xaa', 0n),
      buildCall3Value(SWAP, '0xbb', usdcValue),
    ]);

    const decoded = decodeFunctionData({ abi: MULTICALL3_FROM_ABI, data: encoded });
    expect(decoded.functionName).toBe('aggregate3Value');

    const calls = decoded.args[0] as ReadonlyArray<{ value: bigint }>;
    expect(calls[1].value).toBe(usdcValue);
  });
});
