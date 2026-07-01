import { describe, it, expect, beforeEach } from 'vitest';
import { savePendingBurn, loadPendingBurn } from '../bridge/storage';
import type { PendingBurn } from '../bridge/types';

const STORAGE_KEY = 'arc_treasury_pending_burn';

const makePendingBurn = (overrides?: Partial<PendingBurn>): PendingBurn => ({
  txHash: '0x' + 'ab'.repeat(32),
  fromNetwork: 'ethereumSepolia',
  toNetwork: 'arcTestnet',
  amount: '100',
  timestamp: Date.now(),
  ...overrides,
});

beforeEach(() => {
  localStorage.clear();
});

describe('savePendingBurn', () => {
  it('saves pending burn to localStorage keyed by lowercase address', () => {
    const burn = makePendingBurn();
    savePendingBurn('0xAbCd1234', burn);

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored['0xabcd1234']).toEqual(burn);
  });

  it('removes entry when pendingBurn is null', () => {
    const burn = makePendingBurn();
    savePendingBurn('0xaddr1', burn);
    savePendingBurn('0xaddr1', null);

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('removes only the specified address, keeps others', () => {
    savePendingBurn('0xaddr1', makePendingBurn({ amount: '50' }));
    savePendingBurn('0xaddr2', makePendingBurn({ amount: '100' }));

    const stored1 = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored1['0xaddr1']).toBeDefined();
    expect(stored1['0xaddr2']).toBeDefined();

    savePendingBurn('0xaddr1', null);

    const stored2 = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored2['0xaddr1']).toBeUndefined();
    expect(stored2['0xaddr2']).toBeDefined();
  });

  it('handles localStorage errors gracefully', () => {
    const originalSetItem = localStorage.setItem;
    localStorage.setItem = () => { throw new Error('QuotaExceeded'); };

    expect(() => savePendingBurn('0xaddr', makePendingBurn())).not.toThrow();

    localStorage.setItem = originalSetItem;
  });
});

describe('loadPendingBurn', () => {
  it('returns null when no data stored', () => {
    expect(loadPendingBurn('0xaddr')).toBeNull();
  });

  it('returns burn data for matching address (case-insensitive)', () => {
    const burn = makePendingBurn();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ '0xabcd': burn }));

    expect(loadPendingBurn('0xABCD')).toEqual(burn);
  });

  it('returns null for non-matching address', () => {
    const burn = makePendingBurn();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ '0xabcd': burn }));

    expect(loadPendingBurn('0xother')).toBeNull();
  });

  it('handles corrupted JSON gracefully', () => {
    localStorage.setItem(STORAGE_KEY, '{invalid json');
    expect(loadPendingBurn('0xaddr')).toBeNull();
  });
});
