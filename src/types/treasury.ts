// Treasury types
export interface TreasuryMetadata {
  name: string;
  avatar: string; // emoji or image URL
  createdAt: number;
  owner: string;
  address: string;
}

export interface UserPoints {
  total: number;
  depositPoints: number;
  withdrawPoints: number;
  referralPoints: number;
  holdingPoints: number;
  lastUpdate: number;
}

export interface ReferralData {
  code: string; // Уникальный код пользователя
  referredBy?: string; // Кто пригласил
  referrals: string[]; // Кого пригласил
  earnings: number; // Заработано с рефералов
}

// Points calculation rates
export const POINTS_RATES = {
  DEPOSIT: 0.01, // 1 point за каждые $100 депозита
  WITHDRAW: 0.005, // 0.5 point за каждые $100 вывода
  HOLDING_DAILY: 0.1, // 0.1 point за день холда $100
  REFERRAL_SIGNUP: 100, // 100 points за регистрацию реферала
  REFERRAL_DEPOSIT: 0.05, // 5% от депозита реферала
};

// Treasury avatars (emojis)
export const TREASURY_AVATARS = [
  "🏦", "💰", "💎", "🏛️", "🌟", "⚡", "🚀", "🔥",
  "💵", "💶", "💷", "💴", "🪙", "📈", "📊", "🎯",
  "🏆", "👑", "💫", "✨", "🌙", "☀️", "🌈", "🦄"
];

