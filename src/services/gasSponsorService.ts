// Gas Sponsorship Logic

interface UserGasStats {
  totalTransactions: number;
  depositCount: number;
  withdrawCount: number;
  isReferral: boolean;
  firstTransactionDate: number;
}

export function getUserGasStats(address: string): UserGasStats {
  const key = `gas_stats_${address}`;
  const saved = localStorage.getItem(key);
  
  if (saved) {
    return JSON.parse(saved);
  }
  
  return {
    totalTransactions: 0,
    depositCount: 0,
    withdrawCount: 0,
    isReferral: false,
    firstTransactionDate: Date.now()
  };
}

export function updateGasStats(
  address: string, 
  action: "deposit" | "withdraw" | "rebalance"
) {
  const stats = getUserGasStats(address);
  stats.totalTransactions++;
  
  if (action === "deposit") stats.depositCount++;
  if (action === "withdraw") stats.withdrawCount++;
  
  localStorage.setItem(`gas_stats_${address}`, JSON.stringify(stats));
}

export function isGasSponsored(
  address: string,
  action: "deposit" | "withdraw" | "rebalance"
): boolean {
  const stats = getUserGasStats(address);
  
  // First 3 deposits are free
  if (action === "deposit" && stats.depositCount < 3) {
    return true;
  }
  
  // Referrals get 10 free transactions
  if (stats.isReferral && stats.totalTransactions < 10) {
    return true;
  }
  
  // New users (< 24 hours) get free transactions
  const hoursSinceFirst = (Date.now() - stats.firstTransactionDate) / (1000 * 60 * 60);
  if (hoursSinceFirst < 24 && stats.totalTransactions < 5) {
    return true;
  }
  
  return false;
}

export function getSponsorshipMessage(address: string, action: string): string | null {
  if (!isGasSponsored(address, action as any)) return null;
  
  const stats = getUserGasStats(address);
  
  if (action === "deposit" && stats.depositCount < 3) {
    return `🎁 Gas-free deposit! (${3 - stats.depositCount}/3 remaining)`;
  }
  
  if (stats.isReferral && stats.totalTransactions < 10) {
    return `🎁 Referral bonus: Free transaction (${10 - stats.totalTransactions}/10 remaining)`;
  }
  
  const hoursSinceFirst = (Date.now() - stats.firstTransactionDate) / (1000 * 60 * 60);
  if (hoursSinceFirst < 24 && stats.totalTransactions < 5) {
    return `🎁 Welcome bonus: Gas-free for 24h (${5 - stats.totalTransactions}/5 remaining)`;
  }
  
  return null;
}

