import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { useUnifiedWallet } from './useUnifiedWallet';

const REFERRAL_STORAGE_KEY = 'arc_treasury_referrer';

function cleanRefFromUrl() {
  const params = new URLSearchParams(window.location.search);
  params.delete('ref');
  const newUrl = `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`;
  window.history.replaceState({}, '', newUrl);
}

/**
 * Detects referral codes from URL, resolves them, and registers
 * the referral when the wallet connects. Handles the case where
 * the wallet is already connected on page load.
 */
export const useReferralDetection = () => {
  const account = useAccount();
  const unifiedWallet = useUnifiedWallet();
  const address = account?.address || unifiedWallet.address;
  const [referrerResolved, setReferrerResolved] = useState(false);

  // Step 1: Resolve ref param from URL into localStorage
  useEffect(() => {
    const resolve = async () => {
      const params = new URLSearchParams(window.location.search);
      const refParam = params.get('ref');

      if (refParam) {
        const codeRegex = /^[A-Z2-9]{8}$/i;
        const addressRegex = /^0x[a-fA-F0-9]{40}$/;

        if (codeRegex.test(refParam)) {
          try {
            const response = await fetch(`/api/referral?action=resolve-code&code=${refParam}`);
            const data = await response.json();
            if (data.success && data.address) {
              localStorage.setItem(REFERRAL_STORAGE_KEY, data.address.toLowerCase());
            }
          } catch {
          }
          cleanRefFromUrl();
        } else if (addressRegex.test(refParam)) {
          localStorage.setItem(REFERRAL_STORAGE_KEY, refParam.toLowerCase());
          cleanRefFromUrl();
        }
      }

      setReferrerResolved(true);
    };

    resolve();
  }, []);

  // Step 2: Register referral once URL is resolved AND wallet is connected
  useEffect(() => {
    if (!referrerResolved || !address) return;

    const register = async () => {
      const referrerAddress = localStorage.getItem(REFERRAL_STORAGE_KEY);
      if (!referrerAddress) return;
      if (referrerAddress.toLowerCase() === address.toLowerCase()) return;

      const registeredKey = `arc_treasury_ref_registered_${address.toLowerCase()}`;
      if (localStorage.getItem(registeredKey)) return;

      try {
        const response = await fetch('/api/referral?action=register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            referrerAddress,
            refereeAddress: address,
          }),
        });

        if (response.ok) {
          localStorage.setItem(registeredKey, 'true');
          localStorage.removeItem(REFERRAL_STORAGE_KEY);
        }
      } catch {
      }
    };

    register();
  }, [referrerResolved, address]);

  const getReferrer = (): string | null => {
    return localStorage.getItem(REFERRAL_STORAGE_KEY);
  };

  return { getReferrer };
};
