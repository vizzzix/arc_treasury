import { createWalletClient, createPublicClient, http } from "viem";
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

const PROXY_ADDRESS = "0x17ca5232415430bC57F646A72fD15634807bF729" as `0x${string}`;

const VAULT_ABI = [
  {
    inputs: [{ name: "_wusdc", type: "address" }],
    name: "setWUSDC",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "wusdc",
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
] as const;

async function main() {
  const newWusdcAddress = process.argv[2] as `0x${string}`;

  if (!newWusdcAddress || !newWusdcAddress.startsWith("0x")) {
    console.log("Usage: npx tsx scripts/setWUSDC.ts <wusdc_address>");
    process.exit(1);
  }

  console.log("=== Set WUSDC Address ===\n");

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

  // Check current WUSDC
  const currentWusdc = await publicClient.readContract({
    address: PROXY_ADDRESS,
    abi: VAULT_ABI,
    functionName: "wusdc",
  });
  console.log("Current WUSDC:", currentWusdc);

  if (currentWusdc.toLowerCase() === newWusdcAddress.toLowerCase()) {
    console.log("\nWUSDC already set to this address. No action needed.");
    return;
  }

  // Check if new WUSDC has code
  const code = await publicClient.getCode({ address: newWusdcAddress });
  if (!code || code === "0x") {
    throw new Error("New WUSDC address has no code!");
  }
  console.log("New WUSDC has code (valid contract)");

  console.log(`\nSetting WUSDC to: ${newWusdcAddress}`);

  const gasPrice = await publicClient.getGasPrice();

  const hash = await walletClient.writeContract({
    address: PROXY_ADDRESS,
    abi: VAULT_ABI,
    functionName: "setWUSDC",
    args: [newWusdcAddress],
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

  // Verify
  const verifyWusdc = await publicClient.readContract({
    address: PROXY_ADDRESS,
    abi: VAULT_ABI,
    functionName: "wusdc",
  });
  console.log("\nNew WUSDC:", verifyWusdc);

  console.log("\n=== Done ===");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
