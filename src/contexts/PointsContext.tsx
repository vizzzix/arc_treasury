import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useWallet } from "./WalletContext";
import { UserPoints, ReferralData, POINTS_RATES } from "@/types/treasury";

interface PointsContextType {
  points: UserPoints;
  referral: ReferralData;
  addDepositPoints: (amount: number) => void;
  addWithdrawPoints: (amount: number) => void;
  addReferral: (referredAddress: string) => void;
  generateReferralCode: () => string;
  applyReferralCode: (code: string) => boolean;
}

const PointsContext = createContext<PointsContextType>({
  points: {
    total: 0,
    depositPoints: 0,
    withdrawPoints: 0,
    referralPoints: 0,
    holdingPoints: 0,
    lastUpdate: Date.now(),
  },
  referral: {
    code: "",
    referrals: [],
    earnings: 0,
  },
  addDepositPoints: () => {},
  addWithdrawPoints: () => {},
  addReferral: () => {},
  generateReferralCode: () => "",
  applyReferralCode: () => false,
});

export const usePoints = () => useContext(PointsContext);

export const PointsProvider = ({ children }: { children: ReactNode }) => {
  const { address } = useWallet();
  const [points, setPoints] = useState<UserPoints>({
    total: 0,
    depositPoints: 0,
    withdrawPoints: 0,
    referralPoints: 0,
    holdingPoints: 0,
    lastUpdate: Date.now(),
  });
  const [referral, setReferral] = useState<ReferralData>({
    code: "",
    referrals: [],
    earnings: 0,
  });

  // Load points from localStorage
  useEffect(() => {
    if (address) {
      const savedPoints = localStorage.getItem(`points_${address}`);
      const savedReferral = localStorage.getItem(`referral_${address}`);
      
      if (savedPoints) {
        setPoints(JSON.parse(savedPoints));
      }
      
      if (savedReferral) {
        setReferral(JSON.parse(savedReferral));
      } else {
        // Generate referral code for new users
        const code = generateReferralCode();
        const newReferral = { code, referrals: [], earnings: 0 };
        setReferral(newReferral);
        localStorage.setItem(`referral_${address}`, JSON.stringify(newReferral));
      }
    }
  }, [address]);

  const generateReferralCode = (): string => {
    if (!address) return "";
    // Generate code from address
    return address.slice(2, 8).toUpperCase();
  };

  const addDepositPoints = (amount: number) => {
    const earnedPoints = amount * POINTS_RATES.DEPOSIT;
    setPoints((prev) => {
      const newPoints = {
        ...prev,
        depositPoints: prev.depositPoints + earnedPoints,
        total: prev.total + earnedPoints,
        lastUpdate: Date.now(),
      };
      if (address) {
        localStorage.setItem(`points_${address}`, JSON.stringify(newPoints));
      }
      return newPoints;
    });
  };

  const addWithdrawPoints = (amount: number) => {
    const earnedPoints = amount * POINTS_RATES.WITHDRAW;
    setPoints((prev) => {
      const newPoints = {
        ...prev,
        withdrawPoints: prev.withdrawPoints + earnedPoints,
        total: prev.total + earnedPoints,
        lastUpdate: Date.now(),
      };
      if (address) {
        localStorage.setItem(`points_${address}`, JSON.stringify(newPoints));
      }
      return newPoints;
    });
  };

  const addReferral = (referredAddress: string) => {
    setReferral((prev) => {
      const newReferral = {
        ...prev,
        referrals: [...prev.referrals, referredAddress],
      };
      if (address) {
        localStorage.setItem(`referral_${address}`, JSON.stringify(newReferral));
      }
      return newReferral;
    });

    // Add signup bonus
    setPoints((prev) => {
      const newPoints = {
        ...prev,
        referralPoints: prev.referralPoints + POINTS_RATES.REFERRAL_SIGNUP,
        total: prev.total + POINTS_RATES.REFERRAL_SIGNUP,
        lastUpdate: Date.now(),
      };
      if (address) {
        localStorage.setItem(`points_${address}`, JSON.stringify(newPoints));
      }
      return newPoints;
    });
  };

  const applyReferralCode = (code: string): boolean => {
    if (!address || referral.referredBy) return false;

    // Find referrer by code
    const referrerAddress = Object.keys(localStorage)
      .filter((key) => key.startsWith("referral_0x"))
      .find((key) => {
        const data = JSON.parse(localStorage.getItem(key) || "{}");
        return data.code === code.toUpperCase();
      });

    if (referrerAddress) {
      const referrerAddr = referrerAddress.replace("referral_", "");
      
      // Update current user
      const newReferral = {
        ...referral,
        referredBy: referrerAddr,
      };
      setReferral(newReferral);
      localStorage.setItem(`referral_${address}`, JSON.stringify(newReferral));

      // Update referrer
      const referrerData = JSON.parse(localStorage.getItem(referrerAddress) || "{}");
      referrerData.referrals.push(address);
      localStorage.setItem(referrerAddress, JSON.stringify(referrerData));

      return true;
    }

    return false;
  };

  const value = {
    points,
    referral,
    addDepositPoints,
    addWithdrawPoints,
    addReferral,
    generateReferralCode,
    applyReferralCode,
  };

  return <PointsContext.Provider value={value}>{children}</PointsContext.Provider>;
};

