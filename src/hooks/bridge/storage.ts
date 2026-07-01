import type { PendingBurn } from './types';

const PENDING_BURN_STORAGE_KEY = 'arc_treasury_pending_burn';

const readAllPendingBurns = (): Record<string, PendingBurn> => {
  try {
    const stored = localStorage.getItem(PENDING_BURN_STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {
    // Corrupted JSON — start fresh rather than blocking saves
  }
  return {};
};

export const savePendingBurn = (address: string, pendingBurn: PendingBurn | null) => {
  try {
    const data = readAllPendingBurns();
    if (pendingBurn) {
      const updated = { ...data, [address.toLowerCase()]: pendingBurn };
      localStorage.setItem(PENDING_BURN_STORAGE_KEY, JSON.stringify(updated));
    } else {
      const { [address.toLowerCase()]: _removed, ...rest } = data;
      if (Object.keys(rest).length === 0) {
        localStorage.removeItem(PENDING_BURN_STORAGE_KEY);
      } else {
        localStorage.setItem(PENDING_BURN_STORAGE_KEY, JSON.stringify(rest));
      }
    }
  } catch (e) {
    console.error('[bridge/storage] Failed to save pending burn:', e);
  }
};

export const loadPendingBurn = (address: string): PendingBurn | null => {
  try {
    const stored = localStorage.getItem(PENDING_BURN_STORAGE_KEY);
    if (stored) {
      const data = JSON.parse(stored);
      return data[address.toLowerCase()] || null;
    }
  } catch (e) {
    console.error('[bridge/storage] Failed to load pending burn:', e);
  }
  return null;
};
