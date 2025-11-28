import { onchainTable, index } from "@ponder/core";

// Global stats
export const stats = onchainTable("stats", (t) => ({
  id: t.text().primaryKey(), // "global"
  totalDeposits: t.bigint().notNull(),
  totalWithdrawals: t.bigint().notNull(),
  totalLocked: t.bigint().notNull(),
  totalUSYCMinted: t.bigint().notNull(),
  totalBadgesMinted: t.integer().notNull(),
  uniqueUsers: t.integer().notNull(),
  totalTransactions: t.integer().notNull(),
}));

// User stats
export const user = onchainTable("user", (t) => ({
  id: t.text().primaryKey(), // address
  totalDeposited: t.bigint().notNull(),
  totalWithdrawn: t.bigint().notNull(),
  totalLocked: t.bigint().notNull(),
  hasBadge: t.boolean().notNull(),
  firstDepositAt: t.bigint(),
  lastActivityAt: t.bigint().notNull(),
  depositCount: t.integer().notNull(),
  withdrawCount: t.integer().notNull(),
}));

// Individual deposits
export const deposit = onchainTable(
  "deposit",
  (t) => ({
    id: t.text().primaryKey(), // txHash-logIndex
    user: t.text().notNull(),
    amount: t.bigint().notNull(),
    shares: t.bigint().notNull(),
    timestamp: t.bigint().notNull(),
    blockNumber: t.bigint().notNull(),
    txHash: t.text().notNull(),
  }),
  (table) => ({
    userIdx: index().on(table.user),
  })
);

// Individual withdrawals
export const withdrawal = onchainTable(
  "withdrawal",
  (t) => ({
    id: t.text().primaryKey(),
    user: t.text().notNull(),
    amount: t.bigint().notNull(),
    shares: t.bigint().notNull(),
    timestamp: t.bigint().notNull(),
    blockNumber: t.bigint().notNull(),
    txHash: t.text().notNull(),
  }),
  (table) => ({
    userIdx: index().on(table.user),
  })
);

// Locked positions
export const lockedPosition = onchainTable(
  "locked_position",
  (t) => ({
    id: t.text().primaryKey(), // user-lockId
    user: t.text().notNull(),
    lockId: t.bigint().notNull(),
    amount: t.bigint().notNull(),
    token: t.text().notNull(),
    lockPeriodMonths: t.integer().notNull(),
    unlockTime: t.bigint().notNull(),
    createdAt: t.bigint().notNull(),
    withdrawn: t.boolean().notNull(),
    yieldEarned: t.bigint(),
  }),
  (table) => ({
    userIdx: index().on(table.user),
  })
);

// Badge mints
export const badgeMint = onchainTable(
  "badge_mint",
  (t) => ({
    id: t.text().primaryKey(), // tokenId
    to: t.text().notNull(),
    tokenId: t.bigint().notNull(),
    wasWhitelisted: t.boolean().notNull(),
    timestamp: t.bigint().notNull(),
    txHash: t.text().notNull(),
  }),
  (table) => ({
    toIdx: index().on(table.to),
  })
);

// Daily stats for charts
export const dailyStats = onchainTable("daily_stats", (t) => ({
  id: t.text().primaryKey(), // YYYY-MM-DD
  date: t.text().notNull(),
  deposits: t.bigint().notNull(),
  withdrawals: t.bigint().notNull(),
  newUsers: t.integer().notNull(),
  badgesMinted: t.integer().notNull(),
  transactionCount: t.integer().notNull(),
}));
