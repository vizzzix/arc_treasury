import { describe, it, expect, beforeEach, vi } from 'vitest';
import { savePendingBurn, loadPendingBurn } from '../storage';
import type { PendingBurn } from '../types';

const makeBurn = (overrides?: Partial<PendingBurn>): PendingBurn => ({
  txHash: '0xabc123',
  fromNetwork: 'arcTestnet',
  toNetwork: 'ethereumSepolia',
  amount: '100',
  timestamp: Date.now(),
  ...overrides,
});

describe('bridge/storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('savePendingBurn + loadPendingBurn roundtrip', () => {
    it('saves and loads a pending burn', () => {
      const burn = makeBurn();
      savePendingBurn('0xABCD1234', burn);
      const loaded = loadPendingBurn('0xABCD1234');
      expect(loaded).toEqual(burn);
    });

    it('normalizes address to lowercase on save and load', () => {
      const burn = makeBurn();
      savePendingBurn('0xABCDef1234567890ABCDEF1234567890AbCdEf12', burn);
      const loaded = loadPendingBurn('0xabcdef1234567890abcdef1234567890abcdef12');
      expect(loaded).toEqual(burn);
    });

    it('returns null when no data stored', () => {
      expect(loadPendingBurn('0x1234')).toBeNull();
    });
  });

  describe('clearing pending burn (null)', () => {
    it('clears a stored pending burn', () => {
      savePendingBurn('0xAddr1', makeBurn());
      expect(loadPendingBurn('0xAddr1')).not.toBeNull();

      savePendingBurn('0xAddr1', null);
      expect(loadPendingBurn('0xAddr1')).toBeNull();
    });

    it('removes storage key entirely when last address is cleared', () => {
      savePendingBurn('0xAddr1', makeBurn());
      savePendingBurn('0xAddr1', null);
      expect(localStorage.getItem('arc_treasury_pending_burn')).toBeNull();
    });
  });

  describe('address isolation', () => {
    it('keeps pending burns of other addresses when saving a new one', () => {
      savePendingBurn('0xAddrA', makeBurn({ amount: '50' }));
      savePendingBurn('0xAddrB', makeBurn({ amount: '200' }));

      expect(loadPendingBurn('0xAddrA')?.amount).toBe('50');
      expect(loadPendingBurn('0xAddrB')?.amount).toBe('200');
    });

    it('clearing one address does not affect others', () => {
      savePendingBurn('0xAddrA', makeBurn({ amount: '50' }));
      savePendingBurn('0xAddrB', makeBurn({ amount: '200' }));

      savePendingBurn('0xAddrA', null);

      expect(loadPendingBurn('0xAddrA')).toBeNull();
      expect(loadPendingBurn('0xAddrB')?.amount).toBe('200');
    });
  });

  describe('error resilience', () => {
    it('returns null for corrupted JSON in localStorage', () => {
      localStorage.setItem('arc_treasury_pending_burn', '{invalid json!!!');
      expect(loadPendingBurn('0x1234')).toBeNull();
    });

    it('does not throw when localStorage.setItem fails', () => {
      const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceeded');
      });

      expect(() => savePendingBurn('0x1234', makeBurn())).not.toThrow();
      spy.mockRestore();
    });

    it('returns null when localStorage.getItem fails', () => {
      const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('SecurityError');
      });

      expect(loadPendingBurn('0x1234')).toBeNull();
      spy.mockRestore();
    });
  });

  describe('edge case: savePendingBurn overwrites previous per-address', () => {
    it('overwrites only the storage for the specific address', () => {
      savePendingBurn('0xAddr1', makeBurn({ amount: '100' }));
      savePendingBurn('0xAddr1', makeBurn({ amount: '999' }));
      expect(loadPendingBurn('0xAddr1')?.amount).toBe('999');
    });
  });

  describe('merge with corrupted existing data', () => {
    it('recovers by overwriting when stored JSON is corrupted', () => {
      localStorage.setItem('arc_treasury_pending_burn', '{invalid json!!!');
      const burn = makeBurn();

      expect(() => savePendingBurn('0xAddrA', burn)).not.toThrow();
      expect(loadPendingBurn('0xAddrA')).toEqual(burn);
    });
  });
});
