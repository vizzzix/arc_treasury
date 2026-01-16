import { useEffect } from 'react';
import { useAccount } from 'wagmi';

const REFERRAL_STORAGE_KEY = 'arc_treasury_referrer';

/**
 * Hook to detect and store referral codes from URL
 * Usage: Add this hook to your main App component
 */
export const useReferralDetection = () => {
  const account = useAccount();
  const address = account?.address;

  // Detect referral code from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const refParam = params.get('ref');

    if (refParam) {
      // Check if it's a referral code (8 alphanumeric characters)
      const codeRegex = /^[A-Z2-9]{8}$/i;
      const addressRegex = /^0x[a-fA-F0-9]{40}$/;

      if (codeRegex.test(refParam)) {
        // It's a referral code - resolve it to an address
        fetch(`/api/referral?action=resolve-code&code=${refParam}`)
          .then(response => response.json())
          .then(data => {
            if (data.success && data.address) {
              // Store referrer address in localStorage
              localStorage.setItem(REFERRAL_STORAGE_KEY, data.address.toLowerCase());
              console.log('Referral code resolved:', refParam, '->', data.address);

              // Remove ref param from URL to keep it clean
              params.delete('ref');
              const newUrl = `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`;
              window.history.replaceState({}, '', newUrl);
            }
          })
          .catch(error => {
            console.error('Failed to resolve referral code:', error);
          });
      } else if (addressRegex.test(refParam)) {
        // Legacy: It's a wallet address (for backward compatibility)
        // Store referrer address in localStorage
        localStorage.setItem(REFERRAL_STORAGE_KEY, refParam.toLowerCase());
        console.log('Referral address detected (legacy):', refParam);

        // Remove ref param from URL to keep it clean
        params.delete('ref');
        const newUrl = `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`;
        window.history.replaceState({}, '', newUrl);
      }
    }
  }, []);

  // Get stored referrer address
  const getReferrer = (): string | null => {
    return localStorage.getItem(REFERRAL_STORAGE_KEY);
  };

  // Register referral when user connects wallet (if they came from a ref link)
  useEffect(() => {
    if (!address) return;

    const registerReferralOnce = async () => {
      const referrerAddress = getReferrer();

      // No referrer or self-referral
      if (!referrerAddress || referrerAddress.toLowerCase() === address.toLowerCase()) {
        return;
      }

      // Check if already registered (prevent duplicate calls)
      const registeredKey = `arc_treasury_ref_registered_${address.toLowerCase()}`;
      if (localStorage.getItem(registeredKey)) {
        return; // Already registered
      }

      try {
        console.log('Registering referral:', { referrerAddress, refereeAddress: address });

        const response = await fetch('/api/referral?action=register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            referrerAddress,
            refereeAddress: address,
          }),
        });

        if (response.ok) {
          console.log('Referral registered successfully');
          // Mark as registered to prevent duplicate registrations
          localStorage.setItem(registeredKey, 'true');
          // Clear referrer from storage
          localStorage.removeItem(REFERRAL_STORAGE_KEY);
        } else {
          const error = await response.json();
          console.warn('Failed to register referral:', error);
        }
      } catch (error) {
        console.error('Error registering referral:', error);
      }
    };

    // Register referral when wallet connects
    registerReferralOnce();
  }, [address]);

  return {
    getReferrer,
  };
};
