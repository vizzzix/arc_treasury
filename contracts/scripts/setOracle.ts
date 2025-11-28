import { createWalletClient, createPublicClient, http, formatUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { defineChain } from "viem";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

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

const VAULT_ABI = [
  {
    inputs: [{ name: "_usycOracle", type: "address" }],
    name: "setUsycOracle",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "usycOracle",
    outputs: [{ type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "owner",
    outputs: [{ type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getTotalPoolValue",
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

async function main() {
  const newOracleAddress = process.argv[2] as `0x${string}`;

  if (!newOracleAddress || !newOracleAddress.startsWith("0x")) {
    console.log("Usage: npx tsx scripts/setOracle.ts <oracle_address>");
    console.log("Example: npx tsx scripts/setOracle.ts 0x1234...");
    console.log("\nTo disable oracle (use fallback price), use address(0):");
    console.log("npx tsx scripts/setOracle.ts 0x0000000000000000000000000000000000000000");
    process.exit(1);
  }

  console.log("=== Set USYC Oracle Address ===\n");

  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) throw new Error("PRIVATE_KEY not set");

  const formattedKey = privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`;
  const account = privateKeyToAccount(formattedKey as `0x${string}`);
  console.log("Caller:", account.address);

  const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });
  const walletClient = createWalletClient({ account, chain: arcTestnet, transport: http() });

  // Check owner
  const owner = await publicClient.readContract({
    address: PROXY_ADDRESS,
    abi: VAULT_ABI,
    functionName: "owner",
  });
  console.log("Contract Owner:", owner);

  if (owner.toLowerCase() !== account.address.toLowerCase()) {
    throw new Error("You are not the owner of this contract!");
  }

  // Check current oracle
  const currentOracle = await publicClient.readContract({
    address: PROXY_ADDRESS,
    abi: VAULT_ABI,
    functionName: "usycOracle",
  });
  console.log("Current Oracle:", currentOracle);

  if (currentOracle.toLowerCase() === newOracleAddress.toLowerCase()) {
    console.log("\nOracle already set to this address. No action needed.");
    return;
  }

  // Check if new oracle has code (unless it's address(0))
  if (newOracleAddress !== "0x0000000000000000000000000000000000000000") {
    const code = await publicClient.getCode({ address: newOracleAddress });
    if (!code || code === "0x") {
      console.log("\nWARNING: New oracle address has no code!");
      console.log("This might be intentional if oracle not deployed yet.");
    } else {
      console.log("New oracle has code (valid contract)");
    }
  }

  console.log(`\nSetting Oracle to: ${newOracleAddress}`);

  const gasPrice = await publicClient.getGasPrice();

  const hash = await walletClient.writeContract({
    address: PROXY_ADDRESS,
    abi: VAULT_ABI,
    functionName: "setUsycOracle",
    args: [newOracleAddress],
    gas: 100_000n,
    gasPrice,
  });
  console.log("Tx:", hash);

  const receipt = await publicClient.waitForTransactionReceipt({
    hash,
    timeout: 120_000,
  });
  console.log("Status:", receipt.status === "success" ? "SUCCESS" : "FAILED");

  if (receipt.status !== "success") {
    throw new Error("Transaction failed!");
  }

  // Verify new oracle
  const verifyOracle = await publicClient.readContract({
    address: PROXY_ADDRESS,
    abi: VAULT_ABI,
    functionName: "usycOracle",
  });
  console.log("\nNew Oracle:", verifyOracle);

  // Test getTotalPoolValue
  console.log("\n--- Testing getTotalPoolValue() ---");
  try {
    const totalValue = await publicClient.readContract({
      address: PROXY_ADDRESS,
      abi: VAULT_ABI,
      functionName: "getTotalPoolValue",
    });
    console.log("getTotalPoolValue():", formatUnits(totalValue, 18), "USDC");
    console.log("Oracle integration working!");
  } catch (error: any) {
    console.log("getTotalPoolValue() failed:", error.message);
  }

  console.log("\n=== Done ===");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
