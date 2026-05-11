import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { useUnifiedWallet } from './useUnifiedWallet';

interface ReferralStats {
  address: string;
  totalReferrals: number;
  activeReferrals: number;
  totalBonusPoints: number;
  currentTier: number;
  tierInfo: {
    name: string;
    minRefs: number;
    multiplier: number;
    emoji: string;
  };
  nextTierInfo: {
    name: string;
    minRefs: number;
    multiplier: number;
    emoji: string;
  };
  nextTierAt: number;
}

export const useReferral = () => {
  const account = useAccount();
  const unifiedWallet = useUnifiedWallet();
  const address = account?.address || unifiedWallet.address;

  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getCachedCode = () => {
    if (!address) return null;
    return localStorage.getItem(`referral_code_${address.toLowerCase()}`);
  };

  const [referralCode, setReferralCode] = useState<string | null>(getCachedCode());

  const referralUrl = referralCode
    ? `${window.location.origin}?ref=${referralCode}`
    : '';

  useEffect(() => {
    if (!address) {
      setStats(null);
      setReferralCode(null);
      setIsLoading(false);
      return;
    }

    const cached = getCachedCode();
    if (cached) {
      setReferralCode(cached);
    }

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const [codeRes, statsRes] = await Promise.all([
          fetch(`/api/referral?action=generate-code&address=${address}`),
          fetch(`/api/referral?action=stats&address=${address}`),
        ]);

        if (!codeRes.ok || !statsRes.ok) {
          throw new Error('Failed to fetch referral data');
        }

        const codeData = await codeRes.json();
        const statsData = await statsRes.json();

        localStorage.setItem(`referral_code_${address.toLowerCase()}`, codeData.code);
        setReferralCode(codeData.code);
        setStats(statsData);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [address]);

  return {
    referralCode,
    referralUrl,
    stats,
    isLoading,
    error,
  };
};
