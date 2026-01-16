import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';

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

interface Referral {
  address: string;
  joinedDate: string;
  pointsEarned: number;
  bonusEarned: number;
  isActive: boolean;
}

export const useReferral = () => {
  const account = useAccount();
  const address = account?.address;

  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load cached referral code immediately for instant display
  const getCachedCode = () => {
    if (!address) return null;
    const cached = localStorage.getItem(`referral_code_${address.toLowerCase()}`);
    return cached;
  };

  const [referralCode, setReferralCode] = useState<string | null>(getCachedCode());

  // Generate referral URL from code
  const referralUrl = referralCode
    ? `${window.location.origin}?ref=${referralCode}`
    : '';

  // Fetch referral code and stats
  useEffect(() => {
    if (!address) {
      setStats(null);
      setReferrals([]);
      setReferralCode(null);
      setIsLoading(false);
      return;
    }

    // Load cached code immediately
    const cached = getCachedCode();
    if (cached) {
      setReferralCode(cached);
    }

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Fetch only code first if not cached, then stats and list
        let codePromise: Promise<Response>;

        if (!cached) {
          codePromise = fetch(`/api/referral?action=generate-code&address=${address}`);
        } else {
          // Still fetch in background to validate/update cache
          codePromise = fetch(`/api/referral?action=generate-code&address=${address}`);
        }

        // Fetch stats and list in parallel
        const [codeRes, statsRes, listRes] = await Promise.all([
          codePromise,
          fetch(`/api/referral?action=stats&address=${address}`),
          fetch(`/api/referral?action=list&address=${address}&limit=10`),
        ]);

        if (!codeRes.ok || !statsRes.ok || !listRes.ok) {
          throw new Error('Failed to fetch referral data');
        }

        const codeData = await codeRes.json();
        const statsData = await statsRes.json();
        const listData = await listRes.json();

        // Cache the referral code for instant loading next time
        localStorage.setItem(`referral_code_${address.toLowerCase()}`, codeData.code);

        setReferralCode(codeData.code);
        setStats(statsData);
        setReferrals(listData.referrals || []);
      } catch (err) {
        console.error('Error fetching referral data:', err);
        setError((err as Error).message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [address]);

  // Register a referral
  const registerReferral = async (referrerAddress: string, refereeAddress: string) => {
    try {
      const response = await fetch('/api/referral?action=register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          referrerAddress,
          refereeAddress,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to register referral');
      }

      const data = await response.json();
      return data;
    } catch (err) {
      console.error('Error registering referral:', err);
      throw err;
    }
  };

  return {
    referralCode,
    referralUrl,
    stats,
    referrals,
    isLoading,
    error,
    registerReferral,
  };
};
