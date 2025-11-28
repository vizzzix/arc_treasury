import { createPublicClient, http, formatUnits } from "viem";
import { defineChain } from "viem";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { readFileSync, writeFileSync, existsSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, "../../.env") });

const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.arc.network"] } },
});

// Contract addresses
const PROXY_ADDRESS = "0x17ca5232415430bC57F646A72fD15634807bF729" as `0x${string}`;
const USYC_ORACLE = "0x4b4b1dad50f07def930ba2b17fdcb0e565dae4e9" as `0x${string}`;

const HISTORY_FILE = resolve(__dirname, "../apy_history.json");

// Thresholds for alerts (in basis points)
const ALERT_THRESHOLD_LOW = 360;  // Alert if APY < 3.6%
const ALERT_THRESHOLD_HIGH = 500; // Alert if APY > 5.0%
const DRIFT_THRESHOLD = 20;       // Alert if contract APY differs from oracle by > 0.2%

const VAULT_ABI = [
  { inputs: [], name: "baseAPYBps", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
] as const;

const ORACLE_ABI = [
  { inputs: [], name: "getUSYCPrice", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
] as const;

interface APYHistory {
  readings: Array<{
    timestamp: number;
    navPrice: number;
    estimatedAPY: number;
    contractAPY: number;
  }>;
}

function loadHistory(): APYHistory {
  if (existsSync(HISTORY_FILE)) {
    return JSON.parse(readFileSync(HISTORY_FILE, "utf8"));
  }
  return { readings: [] };
}

function saveHistory(history: APYHistory) {
  writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
}

function calculateAPYFromNAV(currentNAV: number, previousNAV: number, daysBetween: number): number {
  if (previousNAV === 0 || daysBetween === 0) return 0;
  const dailyReturn = (currentNAV / previousNAV) ** (1 / daysBetween) - 1;
  const annualizedAPY = ((1 + dailyReturn) ** 365 - 1) * 100;
  return annualizedAPY;
}

async function main() {
  console.log("=== USYC APY Monitor ===\n");
  console.log(`Timestamp: ${new Date().toISOString()}`);

  const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });

  // Read current NAV price from Oracle
  let navPrice: bigint;
  try {
    navPrice = await publicClient.readContract({
      address: USYC_ORACLE,
      abi: ORACLE_ABI,
      functionName: "getUSYCPrice",
    });
  } catch (e) {
    console.error("Failed to read USYC Oracle:", e);
    navPrice = 0n;
  }

  const navPriceNum = Number(formatUnits(navPrice, 6)); // USYC uses 6 decimals
  console.log(`\nUSYC NAV Price: $${navPriceNum.toFixed(6)}`);

  // Read current contract APY
  const contractAPYBps = await publicClient.readContract({
    address: PROXY_ADDRESS,
    abi: VAULT_ABI,
    functionName: "baseAPYBps",
  });
  const contractAPY = Number(contractAPYBps) / 100;
  console.log(`Contract Base APY: ${contractAPY.toFixed(2)}%`);

  // Load history and calculate estimated APY
  const history = loadHistory();
  let estimatedAPY = 0;

  if (history.readings.length > 0) {
    // Find reading from ~7 days ago for more stable APY estimate
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const oldReading = history.readings.find(r => r.timestamp <= sevenDaysAgo) || history.readings[0];

    if (oldReading && oldReading.navPrice > 0) {
      const daysBetween = (now - oldReading.timestamp) / (24 * 60 * 60 * 1000);
      estimatedAPY = calculateAPYFromNAV(navPriceNum, oldReading.navPrice, daysBetween);
      console.log(`Estimated APY (from ${daysBetween.toFixed(1)} days): ${estimatedAPY.toFixed(2)}%`);
    }
  }

  // Save current reading
  history.readings.push({
    timestamp: Date.now(),
    navPrice: navPriceNum,
    estimatedAPY,
    contractAPY,
  });

  // Keep only last 90 days of readings
  const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
  history.readings = history.readings.filter(r => r.timestamp > ninetyDaysAgo);
  saveHistory(history);

  // Check for alerts
  console.log("\n--- Alert Check ---");
  const alerts: string[] = [];

  if (estimatedAPY > 0) {
    const estimatedAPYBps = Math.round(estimatedAPY * 100);

    if (estimatedAPYBps < ALERT_THRESHOLD_LOW) {
      alerts.push(`⚠️ LOW APY ALERT: Estimated APY (${estimatedAPY.toFixed(2)}%) is below ${ALERT_THRESHOLD_LOW / 100}%`);
    }

    if (estimatedAPYBps > ALERT_THRESHOLD_HIGH) {
      alerts.push(`⚠️ HIGH APY ALERT: Estimated APY (${estimatedAPY.toFixed(2)}%) is above ${ALERT_THRESHOLD_HIGH / 100}%`);
    }

    const drift = Math.abs(estimatedAPYBps - Number(contractAPYBps));
    if (drift > DRIFT_THRESHOLD) {
      alerts.push(`⚠️ DRIFT ALERT: Contract APY (${contractAPY.toFixed(2)}%) differs from estimated (${estimatedAPY.toFixed(2)}%) by ${(drift / 100).toFixed(2)}%`);
      alerts.push(`   → Consider running: npx tsx scripts/setBaseAPY.ts ${estimatedAPYBps}`);
    }
  }

  if (alerts.length === 0) {
    console.log("✅ All checks passed. No action needed.");
  } else {
    console.log("\n" + alerts.join("\n"));
    console.log("\n🔔 Action may be required!");
  }

  // Summary
  console.log("\n--- Summary ---");
  console.log(`NAV Price: $${navPriceNum.toFixed(6)}`);
  console.log(`Contract APY: ${contractAPY.toFixed(2)}% (${contractAPYBps} bps)`);
  console.log(`Estimated APY: ${estimatedAPY.toFixed(2)}%`);
  console.log(`Net User APY: ~${(contractAPY * 0.95).toFixed(2)}% (after 5% fee)`);
  console.log(`History entries: ${history.readings.length}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
