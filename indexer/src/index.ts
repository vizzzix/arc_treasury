import { ponder } from "@/generated";
import * as schema from "../ponder.schema";

// Helper to get date string
const getDateString = (timestamp: bigint): string => {
  const date = new Date(Number(timestamp) * 1000);
  return date.toISOString().split("T")[0];
};

// Initialize or get global stats
const getOrCreateStats = async (db: any) => {
  let globalStats = await db.find(schema.stats, { id: "global" });
  if (!globalStats) {
    globalStats = await db.insert(schema.stats).values({
      id: "global",
      totalDeposits: 0n,
      totalWithdrawals: 0n,
      totalLocked: 0n,
      totalUSYCMinted: 0n,
      totalBadgesMinted: 0,
      uniqueUsers: 0,
      totalTransactions: 0,
    });
  }
  return globalStats;
};

// Initialize or get user
const getOrCreateUser = async (db: any, address: string, timestamp: bigint) => {
  await getOrCreateStats(db);
  let userData = await db.find(schema.user, { id: address });
  if (!userData) {
    // New user - increment unique users count
    await db
      .update(schema.stats, { id: "global" })
      .set((row: any) => ({ uniqueUsers: row.uniqueUsers + 1 }));

    userData = await db.insert(schema.user).values({
      id: address,
      totalDeposited: 0n,
      totalWithdrawn: 0n,
      totalLocked: 0n,
      hasBadge: false,
      firstDepositAt: timestamp,
      lastActivityAt: timestamp,
      depositCount: 0,
      withdrawCount: 0,
    });
  }
  return userData;
};

// Get or create daily stats
const getOrCreateDailyStats = async (db: any, dateStr: string) => {
  let daily = await db.find(schema.dailyStats, { id: dateStr });
  if (!daily) {
    daily = await db.insert(schema.dailyStats).values({
      id: dateStr,
      date: dateStr,
      deposits: 0n,
      withdrawals: 0n,
      newUsers: 0,
      badgesMinted: 0,
      transactionCount: 0,
    });
  }
  return daily;
};

// TreasuryVaultV5 Events
ponder.on("TreasuryVaultV5:Deposit", async ({ event, context }) => {
  const { db } = context;
  const { user: userAddress, amount, shares } = event.args;
  const timestamp = BigInt(event.block.timestamp);
  const dateStr = getDateString(timestamp);

  // Create deposit record
  await db.insert(schema.deposit).values({
    id: `${event.transaction.hash}-${event.log.logIndex}`,
    user: userAddress,
    amount,
    shares,
    timestamp,
    blockNumber: BigInt(event.block.number),
    txHash: event.transaction.hash,
  });

  // Check if new user
  const existingUser = await db.find(schema.user, { id: userAddress });
  const isNewUser = !existingUser;

  // Update user
  await getOrCreateUser(db, userAddress, timestamp);
  await db
    .update(schema.user, { id: userAddress })
    .set((row: any) => ({
      totalDeposited: row.totalDeposited + amount,
      lastActivityAt: timestamp,
      depositCount: row.depositCount + 1,
    }));

  // Update global stats
  await getOrCreateStats(db);
  await db
    .update(schema.stats, { id: "global" })
    .set((row: any) => ({
      totalDeposits: row.totalDeposits + amount,
      totalTransactions: row.totalTransactions + 1,
    }));

  // Update daily stats
  await getOrCreateDailyStats(db, dateStr);
  await db
    .update(schema.dailyStats, { id: dateStr })
    .set((row: any) => ({
      deposits: row.deposits + amount,
      transactionCount: row.transactionCount + 1,
      newUsers: isNewUser ? row.newUsers + 1 : row.newUsers,
    }));
});

ponder.on("TreasuryVaultV5:Withdraw", async ({ event, context }) => {
  const { db } = context;
  const { user: userAddress, shares, amount } = event.args;
  const timestamp = BigInt(event.block.timestamp);
  const dateStr = getDateString(timestamp);

  // Create withdrawal record
  await db.insert(schema.withdrawal).values({
    id: `${event.transaction.hash}-${event.log.logIndex}`,
    user: userAddress,
    amount,
    shares,
    timestamp,
    blockNumber: BigInt(event.block.number),
    txHash: event.transaction.hash,
  });

  // Update user
  await db
    .update(schema.user, { id: userAddress })
    .set((row: any) => ({
      totalWithdrawn: row.totalWithdrawn + amount,
      lastActivityAt: timestamp,
      withdrawCount: row.withdrawCount + 1,
    }));

  // Update global stats
  await getOrCreateStats(db);
  await db
    .update(schema.stats, { id: "global" })
    .set((row: any) => ({
      totalWithdrawals: row.totalWithdrawals + amount,
      totalTransactions: row.totalTransactions + 1,
    }));

  // Update daily stats
  await getOrCreateDailyStats(db, dateStr);
  await db
    .update(schema.dailyStats, { id: dateStr })
    .set((row: any) => ({
      withdrawals: row.withdrawals + amount,
      transactionCount: row.transactionCount + 1,
    }));
});

ponder.on("TreasuryVaultV5:DepositLocked", async ({ event, context }) => {
  const { db } = context;
  const { user: userAddress, lockId, amount, token, lockPeriodMonths, unlockTime } = event.args;
  const timestamp = BigInt(event.block.timestamp);

  // Create locked position record
  await db.insert(schema.lockedPosition).values({
    id: `${userAddress}-${lockId}`,
    user: userAddress,
    lockId,
    amount,
    token,
    lockPeriodMonths: Number(lockPeriodMonths),
    unlockTime,
    createdAt: timestamp,
    withdrawn: false,
    yieldEarned: null,
  });

  // Update user
  await db
    .update(schema.user, { id: userAddress })
    .set((row: any) => ({
      totalLocked: row.totalLocked + amount,
      lastActivityAt: timestamp,
    }));

  // Update global stats
  await getOrCreateStats(db);
  await db
    .update(schema.stats, { id: "global" })
    .set((row: any) => ({
      totalLocked: row.totalLocked + amount,
      totalTransactions: row.totalTransactions + 1,
    }));
});

ponder.on("TreasuryVaultV5:LockedPositionWithdrawn", async ({ event, context }) => {
  const { db } = context;
  const { user: userAddress, lockId, amount, yield: yieldAmount } = event.args;
  const timestamp = BigInt(event.block.timestamp);

  // Update locked position
  await db
    .update(schema.lockedPosition, { id: `${userAddress}-${lockId}` })
    .set({
      withdrawn: true,
      yieldEarned: yieldAmount,
    });

  // Update user
  await db
    .update(schema.user, { id: userAddress })
    .set((row: any) => ({
      totalLocked: row.totalLocked - amount,
      lastActivityAt: timestamp,
    }));

  // Update global stats
  await getOrCreateStats(db);
  await db
    .update(schema.stats, { id: "global" })
    .set((row: any) => ({
      totalLocked: row.totalLocked - amount,
      totalTransactions: row.totalTransactions + 1,
    }));
});

ponder.on("TreasuryVaultV5:USYCMinted", async ({ event, context }) => {
  const { db } = context;
  const { usycAmount } = event.args;

  // Update global stats
  await getOrCreateStats(db);
  await db
    .update(schema.stats, { id: "global" })
    .set((row: any) => ({
      totalUSYCMinted: row.totalUSYCMinted + usycAmount,
    }));
});

// EarlySupporterBadge Events
ponder.on("EarlySupporterBadge:Mint", async ({ event, context }) => {
  const { db } = context;
  const { to, tokenId, wasWhitelisted } = event.args;
  const timestamp = BigInt(event.block.timestamp);
  const dateStr = getDateString(timestamp);

  // Create badge mint record
  await db.insert(schema.badgeMint).values({
    id: tokenId.toString(),
    to,
    tokenId,
    wasWhitelisted,
    timestamp,
    txHash: event.transaction.hash,
  });

  // Update user (create if doesn't exist)
  const existingUser = await db.find(schema.user, { id: to });
  if (existingUser) {
    await db
      .update(schema.user, { id: to })
      .set({ hasBadge: true, lastActivityAt: timestamp });
  } else {
    await db.insert(schema.user).values({
      id: to,
      totalDeposited: 0n,
      totalWithdrawn: 0n,
      totalLocked: 0n,
      hasBadge: true,
      firstDepositAt: null,
      lastActivityAt: timestamp,
      depositCount: 0,
      withdrawCount: 0,
    });
  }

  // Update global stats
  await getOrCreateStats(db);
  await db
    .update(schema.stats, { id: "global" })
    .set((row: any) => ({
      totalBadgesMinted: row.totalBadgesMinted + 1,
      totalTransactions: row.totalTransactions + 1,
    }));

  // Update daily stats
  await getOrCreateDailyStats(db, dateStr);
  await db
    .update(schema.dailyStats, { id: dateStr })
    .set((row: any) => ({
      badgesMinted: row.badgesMinted + 1,
      transactionCount: row.transactionCount + 1,
    }));
});
