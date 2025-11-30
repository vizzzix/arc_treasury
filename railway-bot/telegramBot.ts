/**
 * Arc Treasury APY Monitor Telegram Bot
 *
 * Commands:
 *   /status  - Full vault status
 *   /apy     - Current APY only
 *   /tvl     - Total Value Locked
 *   /help    - Show commands
 *
 * Deploy to Railway:
 *   1. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in Railway variables
 *   2. Deploy this folder
 */

import { createPublicClient, createWalletClient, http, formatUnits, parseAbiItem, decodeAbiParameters } from "viem";
import { defineChain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { createClient } from "@supabase/supabase-js";

// Config from environment
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours for auto-alerts
const POLL_INTERVAL_MS = 3000; // 3 seconds for command polling
const FIXER_API_KEY = process.env.FIXER_API_KEY || "80f6690ad5c8e6aafe4373f4a0ce6e96";
const EXCHANGE_RATE_UPDATE_INTERVAL_MS = 12 * 60 * 60 * 1000; // 12 hours - update exchange rate twice a day

// Supabase for tracking bridge users
const SUPABASE_URL = process.env.SUPABASE_URL || "https://tclvgmhluhayiflwvkfq.supabase.co";
const SUPABASE_ANON_KEY = process.env.SUPABASE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRjbHZnbWhsdWhheWlmbHd2a2ZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzNTEyNTIsImV4cCI6MjA3ODkyNzI1Mn0.oiLvKlLj-vvD7wRT70RLiBrCvJQYosDPIGDyV6NzXuU";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.arc.network"] } },
});

// Ethereum Sepolia for bridge monitoring
const sepoliaChain = defineChain({
  id: 11155111,
  name: "Sepolia",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [`https://sepolia.infura.io/v3/${process.env.INFURA_API}`] } },
});

// Contract addresses
const PROXY_ADDRESS = "0x17ca5232415430bC57F646A72fD15634807bF729" as `0x${string}`;
const USYC_ORACLE = "0x4b4b1dad50f07def930ba2b17fdcb0e565dae4e9" as `0x${string}`;
const BADGE_ADDRESS = "0xb26a5b1d783646a7236ca956f2e954e002bf8d13" as `0x${string}`;
const TELLER = "0x9fdF14c5B14173D74C08Af27AebFf39240dC105A" as `0x${string}`;
const STABLECOIN_SWAP = "0x3a5964ce5cd8b09e55af9323a894e78bdd7f04bf" as `0x${string}`;

// CCTP Bridge contracts for monitoring
const CCTP_MESSAGE_TRANSMITTER_ARC = "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275" as `0x${string}`;
const CCTP_MESSAGE_TRANSMITTER_SEPOLIA = "0x7865fAfC2db2093669d92c0F33AeEF291086BEFD" as `0x${string}`;
const USDC_ARC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831" as `0x${string}`; // USDC on Arc Testnet

// Auto USDC->USYC conversion settings
const AUTO_CONVERT_ENABLED = !!process.env.PRIVATE_KEY_OPERATOR;
const CONVERT_CHECK_INTERVAL_MS = 60_000; // Check every 60 seconds

// Thresholds
const ALERT_APY_LOW = 3.0;
const ALERT_APY_HIGH = 6.0;
const ALERT_DRIFT = 0.3;
const USYC_DRIFT_THRESHOLD = 0.2; // Alert if contract APY differs from USYC by more than 0.2%

// In-memory state (Railway restarts will reset this, which is fine)
let lastUpdateId = 0;
let lastContractAPY = 0;
let lastBlockChecked = 0n;
let lastBadgeBlockChecked = 0n;
let lastBridgeBlockChecked = 0n;
let lastSepoliaBridgeBlockChecked = 0n;
let lastSwapBlockChecked = 0n;
let lastConvertCheck = Date.now();
let lastExchangeRateUpdate = 0; // Force update on startup

// Operator wallet for auto-conversion
let operatorWalletClient: ReturnType<typeof createWalletClient> | null = null;
let operatorAddress: `0x${string}` | null = null;

// Event monitoring interval (check every 30 seconds)
const EVENT_CHECK_INTERVAL_MS = 30 * 1000;

const VAULT_ABI = [
  { inputs: [], name: "baseAPYBps", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "totalUSDC", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "totalUSYC", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "totalShares", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "totalLockedUSDC", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "totalEURC", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "totalLockedEURC", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
];

const ORACLE_ABI = [
  { inputs: [], name: "getUSYCPrice", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
];

const BADGE_ABI = [
  { inputs: [], name: "totalSupply", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "MAX_SUPPLY", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
];

const TELLER_ABI = [
  { name: "maxDeposit", type: "function", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }], stateMutability: "view" },
] as const;

const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });
const sepoliaPublicClient = createPublicClient({ chain: sepoliaChain, transport: http() });

// Initialize operator wallet for auto-conversion
function initOperatorWallet(): boolean {
  let operatorKey = process.env.PRIVATE_KEY_OPERATOR;
  if (!operatorKey) {
    console.log("⚠️ PRIVATE_KEY_OPERATOR not set - auto-conversion disabled");
    return false;
  }
  if (!operatorKey.startsWith("0x")) {
    operatorKey = "0x" + operatorKey;
  }
  const account = privateKeyToAccount(operatorKey as `0x${string}`);
  operatorAddress = account.address;
  operatorWalletClient = createWalletClient({ account, chain: arcTestnet, transport: http() });
  console.log("✅ Operator wallet initialized:", operatorAddress);
  return true;
}

// ============ Bridge User Tracking (Supabase) ============

interface BridgeUserResult {
  isNew: boolean;
  bridgeCount: number;
  totalVolume: number;
}

async function trackBridgeUser(walletAddress: string, amountUsd: number): Promise<BridgeUserResult> {
  const defaultResult: BridgeUserResult = { isNew: true, bridgeCount: 1, totalVolume: amountUsd };

  if (!supabase) {
    console.log("⚠️ Supabase not configured - user tracking disabled");
    return defaultResult;
  }

  const wallet = walletAddress.toLowerCase();

  try {
    // Check if user exists
    const { data: existing, error: selectError } = await supabase
      .from('bridge_users')
      .select('bridge_count, total_volume_usd')
      .eq('wallet_address', wallet)
      .single();

    if (selectError && selectError.code !== 'PGRST116') { // PGRST116 = not found
      console.error("Supabase select error:", selectError);
      return defaultResult;
    }

    if (existing) {
      // Returning user - update stats
      const newCount = (existing.bridge_count || 0) + 1;
      const newVolume = (parseFloat(existing.total_volume_usd) || 0) + amountUsd;

      await supabase
        .from('bridge_users')
        .update({
          last_bridge_at: new Date().toISOString(),
          bridge_count: newCount,
          total_volume_usd: newVolume,
        })
        .eq('wallet_address', wallet);

      return { isNew: false, bridgeCount: newCount, totalVolume: newVolume };
    } else {
      // New user - insert
      await supabase
        .from('bridge_users')
        .insert({
          wallet_address: wallet,
          total_volume_usd: amountUsd,
        });

      return { isNew: true, bridgeCount: 1, totalVolume: amountUsd };
    }
  } catch (e) {
    console.error("Bridge user tracking error:", e);
    return defaultResult;
  }
}

// Save bridge transaction for live feed
async function saveBridgeTransaction(
  walletAddress: string,
  amountUsd: number,
  direction: 'to_arc' | 'to_sepolia',
  txHash: string
): Promise<void> {
  if (!supabase) return;

  try {
    await supabase
      .from('bridge_transactions')
      .upsert({
        wallet_address: walletAddress.toLowerCase(),
        amount_usd: amountUsd,
        direction,
        tx_hash: txHash,
      }, { onConflict: 'tx_hash' });
  } catch (e) {
    console.error("Save bridge transaction error:", e);
  }
}

// ============ Telegram API ============

async function sendMessage(chatId: string | number, text: string, keyboard?: any) {
  if (!TELEGRAM_BOT_TOKEN) return;

  const body: any = {
    chat_id: chatId,
    text,
    parse_mode: "Markdown",
    disable_web_page_preview: true,
  };

  if (keyboard) {
    body.reply_markup = keyboard;
  }

  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e) {
    console.error("Send message error:", e);
  }
}

async function getUpdates(offset: number): Promise<any[]> {
  if (!TELEGRAM_BOT_TOKEN) return [];

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 35000); // 35s timeout for long polling

    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates?offset=${offset}&timeout=30`,
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);

    const data = await response.json() as any;
    if (data.result?.length > 0) {
      console.log(`[${new Date().toISOString()}] Received ${data.result.length} update(s)`);
    }
    return data.ok ? data.result : [];
  } catch (e: any) {
    if (e.name !== 'AbortError') {
      console.error("Get updates error:", e.message);
    }
    return [];
  }
}

// ============ Data Fetching ============

// Sanitize value - return 0 if garbage data (> $1M on testnet is likely garbage)
function sanitize(value: number, maxReasonable: number = 1000000): number {
  return value > maxReasonable ? 0 : value;
}

// Fetch real USYC APY from Hashnote API
async function getUSYCRealAPY(): Promise<number | null> {
  try {
    const response = await fetch('https://usyc.hashnote.com/api/price-reports', {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Arc-Treasury-Bot/1.0',
      },
    });

    if (!response.ok) {
      console.error('Hashnote API error:', response.status);
      return null;
    }

    const responseData = await response.json() as any;
    const data = responseData.data;
    if (!data || data.length === 0) return null;

    // Get latest (first) and oldest (last) price reports
    const latestReport = data[0];
    const oldestReport = data[data.length - 1];

    const currentPrice = parseFloat(latestReport.price);
    const oldestPrice = parseFloat(oldestReport.price);
    const latestTimestamp = parseInt(latestReport.timestamp);
    const oldestTimestamp = parseInt(oldestReport.timestamp);

    // Calculate time elapsed in years
    const secondsElapsed = latestTimestamp - oldestTimestamp;
    const yearsElapsed = secondsElapsed / (365.25 * 24 * 60 * 60);

    // Calculate real APY from historical price change
    if (yearsElapsed > 0 && oldestPrice > 0) {
      const totalReturn = currentPrice / oldestPrice;
      const apy = (Math.pow(totalReturn, 1 / yearsElapsed) - 1) * 100;
      return Math.round(apy * 100) / 100; // Round to 2 decimals
    }

    return null;
  } catch (e) {
    console.error('Error fetching USYC APY:', e);
    return null;
  }
}

async function getVaultData() {
  try {
    // @ts-ignore - viem type issues
    const contractAPYBps = await publicClient.readContract({ address: PROXY_ADDRESS, abi: VAULT_ABI, functionName: "baseAPYBps" }) as bigint;
    // @ts-ignore
    const totalUSDC = await publicClient.readContract({ address: PROXY_ADDRESS, abi: VAULT_ABI, functionName: "totalUSDC" }) as bigint;
    // @ts-ignore
    const totalUSYC = await publicClient.readContract({ address: PROXY_ADDRESS, abi: VAULT_ABI, functionName: "totalUSYC" }) as bigint;
    // @ts-ignore
    const totalLockedUSDC = await publicClient.readContract({ address: PROXY_ADDRESS, abi: VAULT_ABI, functionName: "totalLockedUSDC" }) as bigint;
    // @ts-ignore
    const totalEURC = await publicClient.readContract({ address: PROXY_ADDRESS, abi: VAULT_ABI, functionName: "totalEURC" }) as bigint;
    // @ts-ignore
    const totalLockedEURC = await publicClient.readContract({ address: PROXY_ADDRESS, abi: VAULT_ABI, functionName: "totalLockedEURC" }) as bigint;

    let navPrice = 1000000n; // Default $1.00
    try {
      // @ts-ignore
      navPrice = await publicClient.readContract({ address: USYC_ORACLE, abi: ORACLE_ABI, functionName: "getUSYCPrice" }) as bigint;
    } catch (e) {
      // Oracle stale on testnet
    }

    const contractAPY = Number(contractAPYBps) / 100;
    const netAPY = contractAPY * 0.95;
    const navPriceNum = Number(formatUnits(navPrice, 6));

    // USDC uses 18 decimals (native currency on Arc)
    const totalUSDCNum = sanitize(Number(formatUnits(totalUSDC, 18)));
    const totalLockedUSDCNum = sanitize(Number(formatUnits(totalLockedUSDC, 18)));

    // EURC uses 6 decimals
    const totalEURCNum = sanitize(Number(formatUnits(totalEURC, 6)));
    const totalLockedEURCNum = sanitize(Number(formatUnits(totalLockedEURC, 6)));

    // USYC uses 18 decimals in V8
    const totalUSYCNum = sanitize(Number(formatUnits(totalUSYC, 18)));

    // TVL = all USDC + all EURC (as USD) + USYC value
    const tvl = totalUSDCNum + totalLockedUSDCNum + totalEURCNum + totalLockedEURCNum + (totalUSYCNum * navPriceNum);

    return {
      contractAPY,
      netAPY,
      navPriceNum,
      totalUSDCNum,
      totalUSYCNum,
      totalLockedUSDCNum,
      totalEURCNum,
      totalLockedEURCNum,
      tvl,
    };
  } catch (e) {
    console.error("Vault data error:", e);
    return null;
  }
}

// ============ Command Handlers ============

async function handleStatus(chatId: number) {
  const data = await getVaultData();
  if (!data) {
    await sendMessage(chatId, "❌ Error fetching vault data");
    return;
  }

  const message = `
📊 *Arc Treasury Status*

💰 *APY*
• Contract: ${data.contractAPY.toFixed(2)}%
• Net (user): ~${data.netAPY.toFixed(2)}%

📈 *USDC Balances*
• Flexible: $${data.totalUSDCNum.toFixed(2)}
• Locked: $${data.totalLockedUSDCNum.toFixed(2)}

💶 *EURC Balances*
• Flexible: €${data.totalEURCNum.toFixed(2)}
• Locked: €${data.totalLockedEURCNum.toFixed(2)}

🏦 *USYC Holdings*
• ${data.totalUSYCNum.toFixed(2)} USYC

💎 *TVL*
• Total: ~$${data.tvl.toFixed(2)}

🔗 [View Contract](https://testnet.arcscan.app/address/${PROXY_ADDRESS})
  `;

  await sendMessage(chatId, message, mainKeyboard());
}

async function handleAPY(chatId: number) {
  const data = await getVaultData();
  if (!data) {
    await sendMessage(chatId, "❌ Error fetching APY");
    return;
  }

  const emoji = data.contractAPY >= 4 ? "🟢" : data.contractAPY >= 3 ? "🟡" : "🔴";

  const message = `
${emoji} *Current APY*

Contract APY: *${data.contractAPY.toFixed(2)}%*
Net User APY: *~${data.netAPY.toFixed(2)}%*

_(5% platform fee applied)_
  `;

  await sendMessage(chatId, message, mainKeyboard());
}

async function handleTVL(chatId: number) {
  const data = await getVaultData();
  if (!data) {
    await sendMessage(chatId, "❌ Error fetching TVL");
    return;
  }

  const message = `
💎 *Total Value Locked*

*$${data.tvl.toFixed(2)}*

*USDC Breakdown:*
• Flexible: $${data.totalUSDCNum.toFixed(2)}
• Locked: $${data.totalLockedUSDCNum.toFixed(2)}

*EURC Breakdown:*
• Flexible: €${data.totalEURCNum.toFixed(2)}
• Locked: €${data.totalLockedEURCNum.toFixed(2)}

*USYC:*
• ${data.totalUSYCNum.toFixed(2)} (~$${(data.totalUSYCNum * data.navPriceNum).toFixed(2)})
  `;

  await sendMessage(chatId, message, mainKeyboard());
}

async function handleSync(chatId: number) {
  const data = await getVaultData();
  const usycRealAPY = await getUSYCRealAPY();

  if (!data) {
    await sendMessage(chatId, "❌ Error fetching vault data");
    return;
  }

  if (usycRealAPY === null) {
    await sendMessage(chatId, "❌ Error fetching USYC APY from Hashnote");
    return;
  }

  // Calculate target APY
  const targetContractAPY = usycRealAPY / 0.95;
  const suggestedBps = Math.round(targetContractAPY * 100);
  const drift = Math.abs(data.contractAPY - targetContractAPY);
  const isOverpaying = data.contractAPY > targetContractAPY;
  const status = drift <= USYC_DRIFT_THRESHOLD ? "✅" : (isOverpaying ? "⚠️" : "📉");

  const message = `
🔄 *APY Sync Check*

📊 *Current State:*
• Contract APY: *${data.contractAPY.toFixed(2)}%*
• Net User APY: *${data.netAPY.toFixed(2)}%*
• Real USYC APY: *${usycRealAPY.toFixed(2)}%*

📐 *Analysis:*
• Target Contract APY: ${targetContractAPY.toFixed(2)}%
• Drift: ${drift.toFixed(2)}%
• Status: ${status} ${drift <= USYC_DRIFT_THRESHOLD ? "In sync" : (isOverpaying ? "OVERPAYING" : "Underpaying")}

${drift > USYC_DRIFT_THRESHOLD ? `*To sync:*
\`\`\`
cd contracts
npx tsx scripts/setBaseAPY.ts ${suggestedBps}
\`\`\`` : "_No action needed_"}
  `;

  await sendMessage(chatId, message, mainKeyboard());
}

async function handleHelp(chatId: number) {
  const message = `
🤖 *Arc Treasury Bot*

*Commands:*
/status - Full vault status
/apy - Current APY
/tvl - Total Value Locked
/sync - Check APY vs real USYC
/help - Show this help

*Auto-Alerts (every 6h):*
• Compare with real USYC APY
• Alert if drift > ${USYC_DRIFT_THRESHOLD}%
• Provide exact command to sync

_Monitoring real Hashnote USYC data_
  `;

  await sendMessage(chatId, message, mainKeyboard());
}

function mainKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: "📊 Status", callback_data: "status" },
        { text: "💰 APY", callback_data: "apy" },
        { text: "💎 TVL", callback_data: "tvl" },
      ],
      [
        { text: "🔄 Sync Check", callback_data: "sync" },
      ],
    ],
  };
}

// ============ Deposit Event Monitoring ============

async function checkDepositEvents() {
  if (!TELEGRAM_CHAT_ID) return;

  try {
    const currentBlock = await publicClient.getBlockNumber();

    // On first run, start from current block (don't alert old events)
    if (lastBlockChecked === 0n) {
      lastBlockChecked = currentBlock;
      console.log(`[${new Date().toISOString()}] Starting event monitoring from block ${currentBlock}`);
      return;
    }

    // Check for new blocks
    if (currentBlock <= lastBlockChecked) return;

    console.log(`[${new Date().toISOString()}] Checking blocks ${lastBlockChecked + 1n} to ${currentBlock}`);

    // Get Deposit events (flexible deposits)
    const depositLogs = await publicClient.getLogs({
      address: PROXY_ADDRESS,
      event: parseAbiItem("event Deposit(address indexed user, uint256 amount, uint256 shares)"),
      fromBlock: lastBlockChecked + 1n,
      toBlock: currentBlock,
    });

    // Get DepositEURC events (flexible EURC deposits)
    const eurcLogs = await publicClient.getLogs({
      address: PROXY_ADDRESS,
      event: parseAbiItem("event DepositEURC(address indexed user, uint256 amount, uint256 shares)"),
      fromBlock: lastBlockChecked + 1n,
      toBlock: currentBlock,
    });

    // Get DepositLocked events (locked deposits)
    const lockedLogs = await publicClient.getLogs({
      address: PROXY_ADDRESS,
      event: parseAbiItem("event DepositLocked(address indexed user, uint256 indexed lockId, uint256 amount, address token, uint8 lockPeriodMonths, uint256 unlockTime)"),
      fromBlock: lastBlockChecked + 1n,
      toBlock: currentBlock,
    });

    // Send alerts for flexible deposits
    for (const log of depositLogs) {
      const args = log.args as any;
      const amount = Number(formatUnits(args.amount || 0n, 18));
      const user = args.user ? `${args.user.slice(0, 6)}...${args.user.slice(-4)}` : "Unknown";

      const message = `💰 *New Flexible Deposit*

User: \`${user}\`
Amount: *$${amount.toFixed(2)} USDC*

[View Tx](https://testnet.arcscan.app/tx/${log.transactionHash})`;

      await sendMessage(TELEGRAM_CHAT_ID, message);
      console.log(`[${new Date().toISOString()}] Deposit alert: ${amount} USDC from ${user}`);
    }

    // Send alerts for flexible EURC deposits
    for (const log of eurcLogs) {
      const args = log.args as any;
      const amount = Number(formatUnits(args.amount || 0n, 6)); // EURC uses 6 decimals
      const user = args.user ? `${args.user.slice(0, 6)}...${args.user.slice(-4)}` : "Unknown";

      const message = `💶 *New Flexible EURC Deposit*

User: \`${user}\`
Amount: *€${amount.toFixed(2)} EURC*

[View Tx](https://testnet.arcscan.app/tx/${log.transactionHash})`;

      await sendMessage(TELEGRAM_CHAT_ID, message);
      console.log(`[${new Date().toISOString()}] Deposit alert: ${amount} EURC from ${user}`);
    }

    // Send alerts for locked deposits
    for (const log of lockedLogs) {
      const args = log.args as any;
      const tokenAddress = (args.token || "").toLowerCase();
      const isEURC = tokenAddress === "0x89b50855aa3be2f677cd6303cec089b5f319d72a";
      const decimals = isEURC ? 6 : 18;
      const symbol = isEURC ? "EURC" : "USDC";
      const currencySymbol = isEURC ? "€" : "$";

      const amount = Number(formatUnits(args.amount || 0n, decimals));
      const user = args.user ? `${args.user.slice(0, 6)}...${args.user.slice(-4)}` : "Unknown";
      const lockMonths = args.lockPeriodMonths || 0;
      const multiplier = lockMonths === 1 ? "1.5x" : lockMonths === 3 ? "2x" : lockMonths === 12 ? "3x" : "1x";

      const message = `🔒 *New Locked Deposit*

User: \`${user}\`
Amount: *${currencySymbol}${amount.toFixed(2)} ${symbol}*
Lock Period: *${lockMonths} months*
Points Multiplier: *${multiplier}*

[View Tx](https://testnet.arcscan.app/tx/${log.transactionHash})`;

      await sendMessage(TELEGRAM_CHAT_ID, message);
      console.log(`[${new Date().toISOString()}] Locked deposit alert: ${amount} ${symbol} for ${lockMonths}mo from ${user}`);
    }

    // Get LockedPositionWithdrawn events (normal unlock)
    const unlockLogs = await publicClient.getLogs({
      address: PROXY_ADDRESS,
      event: parseAbiItem("event LockedPositionWithdrawn(address indexed user, uint256 indexed lockId, uint256 amount, uint256 yield)"),
      fromBlock: lastBlockChecked + 1n,
      toBlock: currentBlock,
    });

    // Send alerts for unlocked positions
    for (const log of unlockLogs) {
      const args = log.args as any;
      const amount = Number(formatUnits(args.amount || 0n, 18)); // USDC 18 decimals
      const yieldAmount = Number(formatUnits(args.yield || 0n, 18));
      const user = args.user ? `${args.user.slice(0, 6)}...${args.user.slice(-4)}` : "Unknown";
      const lockId = args.lockId?.toString() || "?";

      const message = `🔓 *Lock Position Withdrawn*

User: \`${user}\`
Lock ID: #${lockId}
Principal: *$${amount.toFixed(2)}*
Yield Earned: *+$${yieldAmount.toFixed(2)}*
Total: *$${(amount + yieldAmount).toFixed(2)}*

[View Tx](https://testnet.arcscan.app/tx/${log.transactionHash})`;

      await sendMessage(TELEGRAM_CHAT_ID, message);
      console.log(`[${new Date().toISOString()}] Unlock alert: ${user} withdrew lock #${lockId}`);
    }

    // Get EarlyWithdrawPenalty events (forced early unlock)
    const earlyWithdrawLogs = await publicClient.getLogs({
      address: PROXY_ADDRESS,
      event: parseAbiItem("event EarlyWithdrawPenalty(address indexed user, uint256 indexed lockId, uint256 penaltyAmount)"),
      fromBlock: lastBlockChecked + 1n,
      toBlock: currentBlock,
    });

    // Send alerts for early withdrawals
    for (const log of earlyWithdrawLogs) {
      const args = log.args as any;
      const penalty = Number(formatUnits(args.penaltyAmount || 0n, 18));
      const user = args.user ? `${args.user.slice(0, 6)}...${args.user.slice(-4)}` : "Unknown";
      const lockId = args.lockId?.toString() || "?";

      const message = `⚠️ *Early Withdrawal Penalty*

User: \`${user}\`
Lock ID: #${lockId}
Penalty Paid: *-$${penalty.toFixed(2)}*

_User broke lock early and paid 10% penalty_

[View Tx](https://testnet.arcscan.app/tx/${log.transactionHash})`;

      await sendMessage(TELEGRAM_CHAT_ID, message);
      console.log(`[${new Date().toISOString()}] Early withdrawal: ${user} broke lock #${lockId}, penalty $${penalty.toFixed(2)}`);
    }

    lastBlockChecked = currentBlock;
  } catch (e) {
    console.error("Event check error:", e);
  }
}

// ============ Badge Mint Monitoring ============

async function checkBadgeMints() {
  if (!TELEGRAM_CHAT_ID) return;

  try {
    const currentBlock = await publicClient.getBlockNumber();

    // On first run, start from current block
    if (lastBadgeBlockChecked === 0n) {
      lastBadgeBlockChecked = currentBlock;
      console.log(`[${new Date().toISOString()}] Badge monitoring started from block ${currentBlock}`);
      return;
    }

    if (currentBlock <= lastBadgeBlockChecked) return;

    // Get Transfer events from badge contract (from 0x0 = mint)
    const logs = await publicClient.getLogs({
      address: BADGE_ADDRESS,
      event: parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"),
      args: {
        from: "0x0000000000000000000000000000000000000000" as `0x${string}`,
      },
      fromBlock: lastBadgeBlockChecked + 1n,
      toBlock: currentBlock,
    });

    for (const log of logs) {
      const args = log.args as any;
      const minter = args.to;
      const tokenId = args.tokenId;

      // Get current total supply
      let totalSupply = 0n;
      let maxSupply = 5000n;
      try {
        // @ts-ignore
        totalSupply = await publicClient.readContract({ address: BADGE_ADDRESS, abi: BADGE_ABI, functionName: "totalSupply" }) as bigint;
        // @ts-ignore
        maxSupply = await publicClient.readContract({ address: BADGE_ADDRESS, abi: BADGE_ABI, functionName: "MAX_SUPPLY" }) as bigint;
      } catch (e) {
        // Ignore errors
      }

      const shortAddr = minter ? `${minter.slice(0, 6)}...${minter.slice(-4)}` : "Unknown";
      const message = `🏅 *New Badge Minted!*

Minter: \`${minter}\`
Token ID: #${tokenId?.toString()}
Supply: ${totalSupply.toString()} / ${maxSupply.toString()}

[View on ArcScan](https://testnet.arcscan.app/address/${minter})`;

      await sendMessage(TELEGRAM_CHAT_ID, message);
      console.log(`[${new Date().toISOString()}] Badge mint: ${shortAddr} minted #${tokenId}`);
    }

    lastBadgeBlockChecked = currentBlock;
  } catch (e) {
    console.error("Badge mint check error:", e);
  }
}

// ============ Bridge Event Monitoring ============

async function checkBridgeEvents() {
  if (!TELEGRAM_CHAT_ID) return;

  try {
    // === Monitor Arc Testnet (incoming from Sepolia) ===
    const arcCurrentBlock = await publicClient.getBlockNumber();

    if (lastBridgeBlockChecked === 0n) {
      lastBridgeBlockChecked = arcCurrentBlock;
      console.log(`[${new Date().toISOString()}] Arc bridge monitoring started from block ${arcCurrentBlock}`);
    }

    if (arcCurrentBlock > lastBridgeBlockChecked) {
      // Monitor MessageReceived events on Arc (Sepolia → Arc completed)
      const arcMessageLogs = await publicClient.getLogs({
        address: CCTP_MESSAGE_TRANSMITTER_ARC,
        event: parseAbiItem("event MessageReceived(address indexed caller, uint32 sourceDomain, bytes32 indexed messageId, bytes32 sender, uint32 finalityThreshold, bytes messageBody)"),
        fromBlock: lastBridgeBlockChecked + 1n,
        toBlock: arcCurrentBlock,
      });

      for (const log of arcMessageLogs) {
        const args = log.args as any;
        const sourceDomain = Number(args.sourceDomain ?? 0);
        const caller = args.caller as string;
        const callerShort = caller ? `${caller.slice(0, 6)}...${caller.slice(-4)}` : "Unknown";
        const sourceChain = sourceDomain === 0 ? "Sepolia" : `Domain ${sourceDomain}`;

        // Get amount from USDC Transfer event
        let amount = 0;
        try {
          const receipt = await publicClient.getTransactionReceipt({ hash: log.transactionHash });
          const transferLog = receipt.logs.find(l =>
            l.address.toLowerCase() === "0x3600000000000000000000000000000000000000" &&
            l.topics[0] === "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef" &&
            l.topics[1] === "0x0000000000000000000000000000000000000000000000000000000000000000"
          );
          if (transferLog && transferLog.data) {
            amount = Number(formatUnits(BigInt(transferLog.data), 6));
          }
        } catch (e) {
          console.error("Failed to get Arc bridge amount:", e);
        }

        const amountStr = amount > 0 ? `*$${amount.toFixed(2)} USDC*` : "USDC";

        // Track user and save transaction in Supabase
        const userStatus = await trackBridgeUser(caller, amount);
        await saveBridgeTransaction(caller, amount, 'to_arc', log.transactionHash);
        const userBadge = userStatus.isNew ? "🆕 New User" : `🔄 Return #${userStatus.bridgeCount}`;

        const message = `🌉 *Bridge Completed* ${userBadge}

\`${callerShort}\` received ${amountStr}
${sourceChain} → Arc Testnet ✅

[View Tx](https://testnet.arcscan.app/tx/${log.transactionHash})`;

        await sendMessage(TELEGRAM_CHAT_ID, message);
        console.log(`[${new Date().toISOString()}] Bridge to Arc: ${amount} USDC from ${callerShort} (${userStatus.isNew ? 'NEW' : 'returning'})`);
      }

      lastBridgeBlockChecked = arcCurrentBlock;
    }

    // === Monitor Sepolia (incoming from Arc) ===
    // Monitor USDC mint events directly (more reliable than MessageReceived)
    const sepoliaCurrentBlock = await sepoliaPublicClient.getBlockNumber();

    if (lastSepoliaBridgeBlockChecked === 0n) {
      lastSepoliaBridgeBlockChecked = sepoliaCurrentBlock;
      console.log(`[${new Date().toISOString()}] Sepolia USDC mint monitoring started from block ${sepoliaCurrentBlock}`);
    }

    if (sepoliaCurrentBlock > lastSepoliaBridgeBlockChecked) {
      // Sepolia USDC address (Circle)
      const USDC_SEPOLIA = "0x1c7d4b196cb0c7b01d743fbc6116a902379c7238" as `0x${string}`;

      // Monitor USDC Transfer events where from=0x0 (mint = bridge arrived)
      const usdcMintLogs = await sepoliaPublicClient.getLogs({
        address: USDC_SEPOLIA,
        event: parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)"),
        args: {
          from: "0x0000000000000000000000000000000000000000" as `0x${string}`,
        },
        fromBlock: lastSepoliaBridgeBlockChecked + 1n,
        toBlock: sepoliaCurrentBlock,
      });

      console.log(`[${new Date().toISOString()}] Sepolia: checked blocks ${lastSepoliaBridgeBlockChecked + 1n}-${sepoliaCurrentBlock}, found ${usdcMintLogs.length} USDC mints`);

      for (const log of usdcMintLogs) {
        const args = log.args as any;
        const recipient = args.to as string;
        const recipientShort = recipient ? `${recipient.slice(0, 6)}...${recipient.slice(-4)}` : "Unknown";
        const amount = Number(formatUnits(args.value || 0n, 6));

        // Track user and save transaction in Supabase
        const userStatus = await trackBridgeUser(recipient, amount);
        await saveBridgeTransaction(recipient, amount, 'to_sepolia', log.transactionHash);
        const userBadge = userStatus.isNew ? "🆕 New User" : `🔄 Return #${userStatus.bridgeCount}`;

        const amountStr = `*$${amount.toFixed(2)} USDC*`;

        const message = `🌉 *Bridge Completed* ${userBadge}

\`${recipientShort}\` received ${amountStr}
Arc Testnet → Sepolia ✅

[View Tx](https://sepolia.etherscan.io/tx/${log.transactionHash})`;

        await sendMessage(TELEGRAM_CHAT_ID, message);
        console.log(`[${new Date().toISOString()}] Bridge to Sepolia: ${amount} USDC to ${recipientShort} (${userStatus.isNew ? 'NEW' : 'returning'})`);
      }

      lastSepoliaBridgeBlockChecked = sepoliaCurrentBlock;
    }

  } catch (e) {
    console.error("Bridge event check error:", e);
  }
}

// ============ Swap Pool Event Monitoring ============

async function checkSwapEvents() {
  if (!TELEGRAM_CHAT_ID) return;

  try {
    const currentBlock = await publicClient.getBlockNumber();

    // On first run, start from current block
    if (lastSwapBlockChecked === 0n) {
      lastSwapBlockChecked = currentBlock;
      console.log(`[${new Date().toISOString()}] Swap monitoring started from block ${currentBlock}`);
      return;
    }

    if (currentBlock <= lastSwapBlockChecked) return;

    // Monitor Swap events
    const swapLogs = await publicClient.getLogs({
      address: STABLECOIN_SWAP,
      event: parseAbiItem("event Swap(address indexed user, bool indexed usdcToEurc, uint256 amountIn, uint256 amountOut, uint256 fee)"),
      fromBlock: lastSwapBlockChecked + 1n,
      toBlock: currentBlock,
    });

    for (const log of swapLogs) {
      const args = log.args as any;
      const user = args.user ? `${args.user.slice(0, 6)}...${args.user.slice(-4)}` : "Unknown";
      const usdcToEurc = args.usdcToEurc;

      // USDC uses 18 decimals, EURC uses 6 decimals
      const amountIn = usdcToEurc
        ? Number(formatUnits(args.amountIn || 0n, 18))
        : Number(formatUnits(args.amountIn || 0n, 6));
      const amountOut = usdcToEurc
        ? Number(formatUnits(args.amountOut || 0n, 6))
        : Number(formatUnits(args.amountOut || 0n, 18));
      const fee = usdcToEurc
        ? Number(formatUnits(args.fee || 0n, 6))
        : Number(formatUnits(args.fee || 0n, 18));

      const fromToken = usdcToEurc ? "USDC" : "EURC";
      const toToken = usdcToEurc ? "EURC" : "USDC";
      const fromSymbol = usdcToEurc ? "$" : "€";
      const toSymbol = usdcToEurc ? "€" : "$";

      const message = `🔄 *Swap Executed*

From: *${fromSymbol}${amountIn.toFixed(2)} ${fromToken}*
To: *${toSymbol}${amountOut.toFixed(2)} ${toToken}*
Fee: ${toSymbol}${fee.toFixed(4)}
User: \`${user}\`

[View Tx](https://testnet.arcscan.app/tx/${log.transactionHash})`;

      await sendMessage(TELEGRAM_CHAT_ID, message);
      console.log(`[${new Date().toISOString()}] Swap: ${amountIn} ${fromToken} → ${amountOut} ${toToken} by ${user}`);
    }

    // Monitor LiquidityAdded events
    const addLiqLogs = await publicClient.getLogs({
      address: STABLECOIN_SWAP,
      event: parseAbiItem("event LiquidityAdded(address indexed provider, uint256 usdcAmount, uint256 eurcAmount, uint256 lpTokensMinted)"),
      fromBlock: lastSwapBlockChecked + 1n,
      toBlock: currentBlock,
    });

    for (const log of addLiqLogs) {
      const args = log.args as any;
      const provider = args.provider ? `${args.provider.slice(0, 6)}...${args.provider.slice(-4)}` : "Unknown";
      const usdcAmount = Number(formatUnits(args.usdcAmount || 0n, 18));
      const eurcAmount = Number(formatUnits(args.eurcAmount || 0n, 6));
      const lpTokens = Number(formatUnits(args.lpTokensMinted || 0n, 18));

      const message = `💧 *Liquidity Added*

USDC: *$${usdcAmount.toFixed(2)}*
EURC: *€${eurcAmount.toFixed(2)}*
LP Tokens: ${lpTokens.toFixed(4)}
Provider: \`${provider}\`

[View Tx](https://testnet.arcscan.app/tx/${log.transactionHash})`;

      await sendMessage(TELEGRAM_CHAT_ID, message);
      console.log(`[${new Date().toISOString()}] Add liquidity: $${usdcAmount} + €${eurcAmount} by ${provider}`);
    }

    // Monitor LiquidityRemoved events
    const removeLiqLogs = await publicClient.getLogs({
      address: STABLECOIN_SWAP,
      event: parseAbiItem("event LiquidityRemoved(address indexed provider, uint256 usdcAmount, uint256 eurcAmount, uint256 lpTokensBurned)"),
      fromBlock: lastSwapBlockChecked + 1n,
      toBlock: currentBlock,
    });

    for (const log of removeLiqLogs) {
      const args = log.args as any;
      const provider = args.provider ? `${args.provider.slice(0, 6)}...${args.provider.slice(-4)}` : "Unknown";
      const usdcAmount = Number(formatUnits(args.usdcAmount || 0n, 18));
      const eurcAmount = Number(formatUnits(args.eurcAmount || 0n, 6));
      const lpTokens = Number(formatUnits(args.lpTokensBurned || 0n, 18));

      const message = `🔥 *Liquidity Removed*

USDC: *$${usdcAmount.toFixed(2)}*
EURC: *€${eurcAmount.toFixed(2)}*
LP Tokens Burned: ${lpTokens.toFixed(4)}
Provider: \`${provider}\`

[View Tx](https://testnet.arcscan.app/tx/${log.transactionHash})`;

      await sendMessage(TELEGRAM_CHAT_ID, message);
      console.log(`[${new Date().toISOString()}] Remove liquidity: $${usdcAmount} + €${eurcAmount} by ${provider}`);
    }

    lastSwapBlockChecked = currentBlock;
  } catch (e) {
    console.error("Swap event check error:", e);
  }
}

// ============ Auto USDC -> USYC Conversion ============

async function autoConvertUSDCtoUSYC() {
  if (!AUTO_CONVERT_ENABLED || !operatorWalletClient || !operatorAddress || !TELEGRAM_CHAT_ID) {
    return;
  }

  try {
    // Check vault totalUSDC and Teller maxDeposit
    // @ts-ignore
    const totalUSDC = await publicClient.readContract({ address: PROXY_ADDRESS, abi: VAULT_ABI, functionName: "totalUSDC" }) as bigint;
    // @ts-ignore
    const maxDeposit = await publicClient.readContract({ address: TELLER, abi: TELLER_ABI, functionName: "maxDeposit", args: [PROXY_ADDRESS] }) as bigint;

    // Minimum 10 USDC to convert (avoid dust), in 18 decimals
    const MIN_CONVERT = BigInt(10e18);

    if (totalUSDC < MIN_CONVERT || maxDeposit === 0n) {
      return; // Not enough to convert or Teller limit exhausted
    }

    // Convert up to maxDeposit (Teller limit)
    const maxConvert18Dec = maxDeposit * BigInt(1e12); // Convert 6dec limit to 18dec
    const amountToConvert = totalUSDC < maxConvert18Dec ? totalUSDC : maxConvert18Dec;

    console.log(`[Auto-Convert] Converting ${formatUnits(amountToConvert, 18)} USDC to USYC...`);

    // Call vault.mintUSYC()
    const hash = await operatorWalletClient.writeContract({
      address: PROXY_ADDRESS,
      abi: [{ name: "mintUSYC", type: "function", inputs: [{ name: "usdcAmount", type: "uint256" }], outputs: [{ type: "uint256" }], stateMutability: "nonpayable" }] as const,
      functionName: "mintUSYC",
      args: [amountToConvert],
      chain: arcTestnet,
    });

    console.log(`[Auto-Convert] Tx: ${hash}`);
    await publicClient.waitForTransactionReceipt({ hash });

    // Get new totalUSYC
    // @ts-ignore
    const totalUSYC = await publicClient.readContract({ address: PROXY_ADDRESS, abi: VAULT_ABI, functionName: "totalUSYC" }) as bigint;

    const message = `🔄 *Auto USDC→USYC Conversion*

Converted: ${formatUnits(amountToConvert, 18)} USDC
New totalUSYC: ${formatUnits(totalUSYC, 6)} USYC

[View Tx](https://testnet.arcscan.app/tx/${hash})`;

    await sendMessage(TELEGRAM_CHAT_ID, message);
    console.log(`[Auto-Convert] Success! New totalUSYC: ${formatUnits(totalUSYC, 6)}`);

  } catch (e: any) {
    console.error("[Auto-Convert] Error:", e.message?.slice(0, 150));
  }
}

// ============ Auto Exchange Rate Update ============

const SWAP_ABI = [
  { name: "exchangeRate", type: "function", inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" },
  { name: "setExchangeRate", type: "function", inputs: [{ name: "newRate", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  { name: "owner", type: "function", inputs: [], outputs: [{ type: "address" }], stateMutability: "view" },
] as const;

async function fetchFixerRate(): Promise<number | null> {
  try {
    const response = await fetch(`https://data.fixer.io/api/latest?access_key=${FIXER_API_KEY}&symbols=USD`);
    const data = await response.json() as any;
    if (data.success && data.rates?.USD) {
      return data.rates.USD;
    }
    console.error("[Fixer] API error:", data.error?.info || "Unknown error");
    return null;
  } catch (e: any) {
    console.error("[Fixer] Fetch error:", e.message);
    return null;
  }
}

async function updateSwapExchangeRate() {
  if (!operatorWalletClient || !operatorAddress || !TELEGRAM_CHAT_ID) {
    return;
  }

  try {
    // Fetch current rate from Fixer.io
    const fixerRate = await fetchFixerRate();
    if (!fixerRate) {
      console.log("[ExchangeRate] Failed to fetch Fixer rate");
      return;
    }

    // Get current contract rate
    const currentRate = await publicClient.readContract({
      address: STABLECOIN_SWAP,
      abi: SWAP_ABI,
      functionName: "exchangeRate",
    });
    const currentRateNum = Number(currentRate) / 1e6;

    // Check if we are the owner
    const owner = await publicClient.readContract({
      address: STABLECOIN_SWAP,
      abi: SWAP_ABI,
      functionName: "owner",
    });

    if (owner.toLowerCase() !== operatorAddress.toLowerCase()) {
      console.log(`[ExchangeRate] Not owner. Owner: ${owner}, Operator: ${operatorAddress}`);
      return;
    }

    // Only update if rate changed by more than 0.1%
    const drift = Math.abs(fixerRate - currentRateNum) / currentRateNum;
    if (drift < 0.001) {
      console.log(`[ExchangeRate] Rate unchanged: ${currentRateNum.toFixed(4)} (drift ${(drift * 100).toFixed(3)}%)`);
      return;
    }

    // Convert to 6 decimals (e.g., 1.1595 -> 1159500)
    const newRateRaw = Math.round(fixerRate * 1e6);

    console.log(`[ExchangeRate] Updating rate: ${currentRateNum.toFixed(4)} -> ${fixerRate.toFixed(4)}`);

    // Send transaction
    const hash = await operatorWalletClient.writeContract({
      address: STABLECOIN_SWAP,
      abi: SWAP_ABI,
      functionName: "setExchangeRate",
      args: [BigInt(newRateRaw)],
      chain: arcTestnet,
    });

    console.log(`[ExchangeRate] Tx: ${hash}`);
    await publicClient.waitForTransactionReceipt({ hash });

    const message = `💱 *Exchange Rate Updated*

Old: 1 EUR = $${currentRateNum.toFixed(4)}
New: 1 EUR = $${fixerRate.toFixed(4)}
Change: ${((fixerRate - currentRateNum) / currentRateNum * 100).toFixed(2)}%

[View Tx](https://testnet.arcscan.app/tx/${hash})`;

    await sendMessage(TELEGRAM_CHAT_ID, message);
    console.log(`[ExchangeRate] Success! New rate: ${fixerRate.toFixed(4)}`);

  } catch (e: any) {
    console.error("[ExchangeRate] Error:", e.message?.slice(0, 150));
  }
}

// ============ Alert Check ============

async function checkAlerts() {
  const data = await getVaultData();
  if (!data || !TELEGRAM_CHAT_ID) return;

  // Fetch real USYC APY from Hashnote
  const usycRealAPY = await getUSYCRealAPY();
  console.log(`[${new Date().toISOString()}] USYC Real APY: ${usycRealAPY}%, Contract APY: ${data.contractAPY}%`);

  // MAIN CHECK: Compare contract APY with real USYC APY
  if (usycRealAPY !== null) {
    // Calculate what our contract APY should be to match USYC after 5% fee
    // net APY = contract APY * 0.95 = USYC APY
    // contract APY = USYC APY / 0.95
    const targetContractAPY = usycRealAPY / 0.95;
    const drift = Math.abs(data.contractAPY - targetContractAPY);

    if (drift > USYC_DRIFT_THRESHOLD) {
      const suggestedBps = Math.round(targetContractAPY * 100);
      const isOverpaying = data.contractAPY > targetContractAPY;

      const message = `🔔 *APY Sync Required*

📊 *Current State:*
• Contract APY: *${data.contractAPY.toFixed(2)}%*
• Net User APY: *${data.netAPY.toFixed(2)}%*
• Real USYC APY: *${usycRealAPY.toFixed(2)}%*

${isOverpaying ? "⚠️ *We are OVERPAYING!*" : "📉 *We are underpaying*"}
Drift: ${drift.toFixed(2)}%

*Recommended Action:*
\`\`\`
cd contracts
npx tsx scripts/setBaseAPY.ts ${suggestedBps}
\`\`\`

_This sets APY to ${targetContractAPY.toFixed(2)}% (${suggestedBps} bps)_
_Net user APY will be ~${usycRealAPY.toFixed(2)}%_`;

      await sendMessage(TELEGRAM_CHAT_ID, message);
    } else {
      // APY is in sync - send status report
      const message = `✅ *APY Check - All Good*

• Contract APY: ${data.contractAPY.toFixed(2)}%
• Net User APY: ~${data.netAPY.toFixed(2)}%
• Real USYC APY: ${usycRealAPY.toFixed(2)}%
• Drift: ${drift.toFixed(2)}% (threshold: ${USYC_DRIFT_THRESHOLD}%)

_Next check in 6 hours_`;

      await sendMessage(TELEGRAM_CHAT_ID, message);
    }
  }

  // Fallback checks if Hashnote API fails
  if (usycRealAPY === null) {
    // LOW APY alert
    if (data.contractAPY < ALERT_APY_LOW) {
      const message = `🚨 *LOW APY ALERT*

Current APY: *${data.contractAPY.toFixed(2)}%*
Threshold: ${ALERT_APY_LOW}%

⚠️ Could not fetch USYC APY from Hashnote.
Check manually at hashnote.com`;

      await sendMessage(TELEGRAM_CHAT_ID, message);
    }

    // HIGH APY alert
    if (data.contractAPY > ALERT_APY_HIGH) {
      const message = `⚠️ *HIGH APY ALERT*

Current APY: *${data.contractAPY.toFixed(2)}%*
Threshold: ${ALERT_APY_HIGH}%

Could not verify against USYC APY.`;

      await sendMessage(TELEGRAM_CHAT_ID, message);
    }
  }

  // APY Changed significantly (local tracking)
  if (lastContractAPY > 0 && Math.abs(data.contractAPY - lastContractAPY) > ALERT_DRIFT) {
    const direction = data.contractAPY > lastContractAPY ? "📈" : "📉";
    const message = `${direction} *APY Changed*

${lastContractAPY.toFixed(2)}% → *${data.contractAPY.toFixed(2)}%*
Change: ${(data.contractAPY - lastContractAPY).toFixed(2)}%

_Net user APY: ~${data.netAPY.toFixed(2)}%_`;

    await sendMessage(TELEGRAM_CHAT_ID, message);
  }

  lastContractAPY = data.contractAPY;
}

// ============ Main Loop ============

async function processUpdates() {
  const updates = await getUpdates(lastUpdateId + 1);

  for (const update of updates) {
    lastUpdateId = update.update_id;

    // Handle text commands
    if (update.message?.text) {
      const chatId = update.message.chat.id;
      const text = update.message.text.toLowerCase();

      console.log(`[${new Date().toISOString()}] Command: ${text} from ${chatId}`);

      if (text === "/start" || text === "/help") {
        await handleHelp(chatId);
      } else if (text === "/status") {
        await handleStatus(chatId);
      } else if (text === "/apy") {
        await handleAPY(chatId);
      } else if (text === "/tvl") {
        await handleTVL(chatId);
      } else if (text === "/sync") {
        await handleSync(chatId);
      }
    }

    // Handle button callbacks
    if (update.callback_query) {
      const chatId = update.callback_query.message.chat.id;
      const data = update.callback_query.data;

      console.log(`[${new Date().toISOString()}] Callback: ${data} from ${chatId}`);

      if (data === "status") {
        await handleStatus(chatId);
      } else if (data === "apy") {
        await handleAPY(chatId);
      } else if (data === "tvl") {
        await handleTVL(chatId);
      } else if (data === "sync") {
        await handleSync(chatId);
      }

      // Answer callback to remove loading state
      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callback_query_id: update.callback_query.id }),
      });
    }
  }
}

async function main() {
  console.log("=== Arc Treasury Telegram Bot ===\n");
  console.log(`Started at: ${new Date().toISOString()}`);

  if (!TELEGRAM_BOT_TOKEN) {
    console.error("❌ TELEGRAM_BOT_TOKEN not set");
    process.exit(1);
  }

  console.log("✅ Bot token configured");
  console.log(`📡 Chat ID: ${TELEGRAM_CHAT_ID || "not set (no auto-alerts)"}`);

  // Initialize operator wallet for auto-conversion
  if (AUTO_CONVERT_ENABLED) {
    initOperatorWallet();
  }

  console.log("🚀 Starting bot...\n");

  // Main loop
  let lastAlertCheck = Date.now();
  let lastEventCheck = Date.now();

  while (true) {
    try {
      // Process incoming commands (long polling)
      await processUpdates();

      // Check for deposit events, badge mints, bridge events, and swaps (every 30 seconds)
      if (Date.now() - lastEventCheck > EVENT_CHECK_INTERVAL_MS) {
        await checkDepositEvents();
        await checkBadgeMints();
        await checkBridgeEvents();
        await checkSwapEvents();
        lastEventCheck = Date.now();
      }

      // Auto USDC->USYC conversion (every 60 seconds)
      if (AUTO_CONVERT_ENABLED && operatorWalletClient && Date.now() - lastConvertCheck > CONVERT_CHECK_INTERVAL_MS) {
        await autoConvertUSDCtoUSYC();
        lastConvertCheck = Date.now();
      }

      // Auto exchange rate update (every 12 hours)
      if (operatorWalletClient && Date.now() - lastExchangeRateUpdate > EXCHANGE_RATE_UPDATE_INTERVAL_MS) {
        console.log(`[${new Date().toISOString()}] Checking exchange rate...`);
        await updateSwapExchangeRate();
        lastExchangeRateUpdate = Date.now();
      }

      // Periodic APY alert check (every 6 hours)
      if (Date.now() - lastAlertCheck > CHECK_INTERVAL_MS) {
        console.log(`[${new Date().toISOString()}] Running APY alert check...`);
        await checkAlerts();
        lastAlertCheck = Date.now();
      }
    } catch (e) {
      console.error("Loop error:", e);
      // Brief pause on error before retrying
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}

main().catch(console.error);
