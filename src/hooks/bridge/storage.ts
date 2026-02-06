import type { PendingBurn } from './types';

const PENDING_BURN_STORAGE_KEY = 'arc_treasury_pending_burn';

export const savePendingBurn = (address: string, pendingBurn: PendingBurn | null) => {
  try {
    if (pendingBurn) {
      const data = { [address.toLowerCase()]: pendingBurn };
      localStorage.setItem(PENDING_BURN_STORAGE_KEY, JSON.stringify(data));
    } else {
      const stored = localStorage.getItem(PENDING_BURN_STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        delete data[address.toLowerCase()];
        if (Object.keys(data).length === 0) {
          localStorage.removeItem(PENDING_BURN_STORAGE_KEY);
        } else {
          localStorage.setItem(PENDING_BURN_STORAGE_KEY, JSON.stringify(data));
        }
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
