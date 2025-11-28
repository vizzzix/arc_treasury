/**
 * Arc Treasury APY Monitor Telegram Bot
 *
 * Commands:
 *   /status  - Full vault status
 *   /apy     - Current APY only
 *   /tvl     - Total Value Locked
 *   /help    - Show commands
 *
 * Run:
 *   npx tsx scripts/telegramBot.ts
 */

import { createPublicClient, createWalletClient, http, formatUnits } from "viem";
import { defineChain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { readFileSync, writeFileSync, existsSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, "../../.env") });

// Config
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours for auto-alerts
const POLL_INTERVAL_MS = 3000; // 3 seconds for command polling

const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.arc.network"] } },
});

// Contract addresses
const PROXY_ADDRESS = "0x17ca5232415430bC57F646A72fD15634807bF729" as `0x${string}`;
const USYC_ORACLE = "0x4b4b1dad50f07def930ba2b17fdcb0e565dae4e9" as `0x${string}`;
const BADGE_ADDRESS = "0xb26a5b1d783646a7236ca956f2e954e002bf8d13" as `0x${string}`;
const TELLER = "0x9fdF14c5B14173D74C08Af27AebFf39240dC105A" as `0x${string}`;
const USYC = "0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C" as `0x${string}`;
const NATIVE_USDC = "0x3600000000000000000000000000000000000000" as `0x${string}`;

// Badge mint check interval (30 seconds)
const BADGE_CHECK_INTERVAL_MS = 30_000;

// Auto USDC->USYC conversion settings
const AUTO_CONVERT_ENABLED = true;
const CONVERT_CHECK_INTERVAL_MS = 60_000; // Check every 60 seconds

// Thresholds
const ALERT_APY_LOW = 3.0;
const ALERT_APY_HIGH = 6.0;
const ALERT_DRIFT = 0.3;

const STATE_FILE = resolve(__dirname, "../bot_state.json");

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

// ERC721 Transfer event - from 0x0 means mint
const TRANSFER_EVENT = {
  type: "event",
  name: "Transfer",
  inputs: [
    { indexed: true, name: "from", type: "address" },
    { indexed: true, name: "to", type: "address" },
    { indexed: true, name: "tokenId", type: "uint256" },
  ],
} as const;

// ABIs for auto-conversion
const ERC20_ABI = [
  { name: "approve", type: "function", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }], stateMutability: "nonpayable" },
  { name: "allowance", type: "function", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ type: "uint256" }], stateMutability: "view" },
  { name: "balanceOf", type: "function", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }], stateMutability: "view" },
  { name: "transfer", type: "function", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }], stateMutability: "nonpayable" },
] as const;

const TELLER_ABI = [
  { name: "deposit", type: "function", inputs: [{ name: "assets", type: "uint256" }, { name: "receiver", type: "address" }], outputs: [{ type: "uint256" }], stateMutability: "nonpayable" },
  { name: "maxDeposit", type: "function", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }], stateMutability: "view" },
] as const;

const VAULT_RECORD_ABI = [
  { name: "recordUSYCConversion", type: "function", inputs: [{ name: "usycAmount", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
] as const;

interface BotState {
  lastCheck: number;
  lastNAV: number;
  lastContractAPY: number;
  lastUpdateId: number;
  lastBadgeBlock: number;
  lastConvertCheck: number;
}

function loadState(): BotState {
  if (existsSync(STATE_FILE)) {
    const saved = JSON.parse(readFileSync(STATE_FILE, "utf8"));
    return {
      lastCheck: saved.lastCheck ?? 0,
      lastNAV: saved.lastNAV ?? 0,
      lastContractAPY: saved.lastContractAPY ?? 0,
      lastUpdateId: saved.lastUpdateId ?? 0,
      lastBadgeBlock: saved.lastBadgeBlock ?? 0,
      lastConvertCheck: saved.lastConvertCheck ?? 0,
    };
  }
  return { lastCheck: 0, lastNAV: 0, lastContractAPY: 0, lastUpdateId: 0, lastBadgeBlock: 0, lastConvertCheck: 0 };
}

function saveState(state: BotState) {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });

// Operator wallet client for auto-conversion
let operatorWalletClient: ReturnType<typeof createWalletClient> | null = null;
let operatorAddress: `0x${string}` | null = null;

function initOperatorWallet() {
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

// ============ Telegram API ============

async function sendMessage(chatId: string | number, text: string, keyboard?: any) {
  if (!TELEGRAM_BOT_TOKEN) return;

  const body: any = {
    chat_id: chatId,
    text,
    parse_mode: "Markdown",
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
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates?offset=${offset}&timeout=5`,
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);

    const data = await response.json() as any;
    if (data.result?.length > 0) {
      console.log(`Received ${data.result.length} update(s)`);
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

    const tvl = totalUSDCNum + totalLockedUSDCNum + totalEURCNum + totalLockedEURCNum + (totalUSYCNum * navPriceNum);

    return {
      contractAPY,
      netAPY,
      navPriceNum,
      totalUSDCNum,
      totalLockedUSDCNum,
      totalEURCNum,
      totalLockedEURCNum,
      totalUSYCNum,
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

💵 *USDC Balances*
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

_Updated: ${new Date().toLocaleString()}_
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

Breakdown:
• USDC Flex: $${data.totalUSDCNum.toFixed(2)}
• USDC Locked: $${data.totalLockedUSDCNum.toFixed(2)}
• EURC Flex: €${data.totalEURCNum.toFixed(2)}
• EURC Locked: €${data.totalLockedEURCNum.toFixed(2)}
• USYC: ${data.totalUSYCNum.toFixed(2)} (~$${(data.totalUSYCNum * data.navPriceNum).toFixed(2)})
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
/help - Show this help

*Auto-Alerts:*
• APY drops below ${ALERT_APY_LOW}%
• APY rises above ${ALERT_APY_HIGH}%
• APY changes by >${ALERT_DRIFT}%

_Monitoring every 6 hours_
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
        { text: "🔄 Refresh", callback_data: "status" },
      ],
    ],
  };
}

// ============ Alert Check ============

async function checkAlerts(state: BotState) {
  const data = await getVaultData();
  if (!data || !TELEGRAM_CHAT_ID) return;

  const alerts: string[] = [];

  if (data.contractAPY < ALERT_APY_LOW) {
    alerts.push(`⚠️ *LOW APY ALERT*\nAPY dropped to ${data.contractAPY.toFixed(2)}%`);
  }

  if (data.contractAPY > ALERT_APY_HIGH) {
    alerts.push(`⚠️ *HIGH APY ALERT*\nAPY is ${data.contractAPY.toFixed(2)}%`);
  }

  if (state.lastContractAPY > 0 && Math.abs(data.contractAPY - state.lastContractAPY) > ALERT_DRIFT) {
    alerts.push(`📝 *APY Changed*\n${state.lastContractAPY.toFixed(2)}% → ${data.contractAPY.toFixed(2)}%`);
  }

  for (const alert of alerts) {
    await sendMessage(TELEGRAM_CHAT_ID, alert);
  }

  state.lastContractAPY = data.contractAPY;
  state.lastCheck = Date.now();
  saveState(state);
}

// ============ Badge Mint Monitoring ============

async function checkBadgeMints(state: BotState) {
  if (!TELEGRAM_CHAT_ID) return;

  try {
    const currentBlock = await publicClient.getBlockNumber();

    // On first run, start from current block (don't scan all history)
    if (state.lastBadgeBlock === 0) {
      state.lastBadgeBlock = Number(currentBlock);
      saveState(state);
      console.log(`Badge monitoring started from block ${currentBlock}`);
      return;
    }

    // Don't scan if no new blocks
    if (Number(currentBlock) <= state.lastBadgeBlock) {
      return;
    }

    // Get Transfer events from badge contract (from 0x0 = mint)
    const logs = await publicClient.getLogs({
      address: BADGE_ADDRESS,
      event: TRANSFER_EVENT,
      args: {
        from: "0x0000000000000000000000000000000000000000" as `0x${string}`,
      },
      fromBlock: BigInt(state.lastBadgeBlock + 1),
      toBlock: currentBlock,
    });

    for (const log of logs) {
      const minter = log.args.to;
      const tokenId = log.args.tokenId;

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

      const shortAddr = `${minter?.slice(0, 6)}...${minter?.slice(-4)}`;
      const message = `
🏅 *New Badge Minted!*

Minter: \`${minter}\`
Token ID: #${tokenId?.toString()}
Supply: ${totalSupply.toString()} / ${maxSupply.toString()}

[View on ArcScan](https://testnet.arcscan.app/address/${minter})
      `;

      await sendMessage(TELEGRAM_CHAT_ID, message);
      console.log(`Badge mint notification sent: ${shortAddr} minted #${tokenId}`);
    }

    state.lastBadgeBlock = Number(currentBlock);
    saveState(state);
  } catch (e) {
    console.error("Badge mint check error:", e);
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
      return; // Not enough to convert
    }

    // Convert up to maxDeposit (Teller limit)
    const maxConvert18Dec = maxDeposit * BigInt(1e12); // Convert 6dec limit to 18dec
    const amountToConvert = totalUSDC < maxConvert18Dec ? totalUSDC : maxConvert18Dec;

    console.log(`[Auto-Convert] Converting ${formatUnits(amountToConvert, 18)} USDC to USYC...`);

    // Call vault.mintUSYC() - this now works in V11!
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

    const message = `🔄 *Auto USDC→USYC Conversion*\n\nConverted: ${formatUnits(amountToConvert, 18)} USDC\nNew totalUSYC: ${formatUnits(totalUSYC, 6)} USYC\n\n[View Tx](https://testnet.arcscan.app/tx/${hash})`;
    await sendMessage(TELEGRAM_CHAT_ID, message);
    console.log(`[Auto-Convert] Success! New totalUSYC: ${formatUnits(totalUSYC, 6)}`);

  } catch (e: any) {
    console.error("[Auto-Convert] Error:", e.message?.slice(0, 150));
  }
}

// ============ Main Loop ============

async function processUpdates(state: BotState) {
  const updates = await getUpdates(state.lastUpdateId + 1);

  for (const update of updates) {
    state.lastUpdateId = update.update_id;

    // Handle text commands
    if (update.message?.text) {
      const chatId = update.message.chat.id;
      const text = update.message.text.toLowerCase();

      if (text === "/start" || text === "/help") {
        await handleHelp(chatId);
      } else if (text === "/status") {
        await handleStatus(chatId);
      } else if (text === "/apy") {
        await handleAPY(chatId);
      } else if (text === "/tvl") {
        await handleTVL(chatId);
      }
    }

    // Handle button callbacks
    if (update.callback_query) {
      const chatId = update.callback_query.message.chat.id;
      const data = update.callback_query.data;

      if (data === "status") {
        await handleStatus(chatId);
      } else if (data === "apy") {
        await handleAPY(chatId);
      } else if (data === "tvl") {
        await handleTVL(chatId);
      }

      // Answer callback to remove loading state
      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callback_query_id: update.callback_query.id }),
      });
    }
  }

  saveState(state);
}

async function main() {
  console.log("=== Arc Treasury Telegram Bot ===\n");

  if (!TELEGRAM_BOT_TOKEN) {
    console.error("❌ TELEGRAM_BOT_TOKEN not set in .env");
    process.exit(1);
  }

  console.log("✅ Bot token configured");

  const state = loadState();

  // Initialize operator wallet for auto-conversion
  if (AUTO_CONVERT_ENABLED) {
    initOperatorWallet();
  }

  console.log("🚀 Starting bot...\n");

  // Send startup message
  if (TELEGRAM_CHAT_ID) {
    await sendMessage(TELEGRAM_CHAT_ID, "🟢 *Bot Started*\nArc Treasury monitor is online.", mainKeyboard());
  }

  // Main loop
  let lastAlertCheck = Date.now();
  let lastBadgeCheck = Date.now();
  let lastConvertCheck = state.lastConvertCheck || Date.now();

  while (true) {
    try {
      // Process incoming commands
      await processUpdates(state);

      // Check for badge mints (every 30 seconds)
      if (Date.now() - lastBadgeCheck > BADGE_CHECK_INTERVAL_MS) {
        await checkBadgeMints(state);
        lastBadgeCheck = Date.now();
      }

      // Auto USDC->USYC conversion (every 60 seconds)
      if (AUTO_CONVERT_ENABLED && operatorWalletClient && Date.now() - lastConvertCheck > CONVERT_CHECK_INTERVAL_MS) {
        await autoConvertUSDCtoUSYC();
        lastConvertCheck = Date.now();
        state.lastConvertCheck = lastConvertCheck;
        saveState(state);
      }

      // Periodic alert check (every 6 hours)
      if (Date.now() - lastAlertCheck > CHECK_INTERVAL_MS) {
        console.log(`[${new Date().toISOString()}] Running alert check...`);
        await checkAlerts(state);
        lastAlertCheck = Date.now();
      }
    } catch (e) {
      console.error("Loop error:", e);
    }

    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
}

main().catch(console.error);
