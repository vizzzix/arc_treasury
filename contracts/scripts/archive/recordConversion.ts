import { createWalletClient, createPublicClient, http, parseUnits, formatUnits } from "viem";
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
  rpcUrls: {
    default: { http: ["https://rpc.testnet.arc.network"] },
  },
});

const TREASURY_VAULT = "0x5d4f0b80db539c8f8f798505358214d16d7ad55e" as `0x${string}`;
const USYC_ADDRESS = "0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C" as `0x${string}`;

// ERC20 ABI
const erc20ABI = [
  {
    name: "transfer",
    type: "function",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" }
    ],
    outputs: [{ type: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    name: "balanceOf",
    type: "function",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
] as const;

// Vault ABI
const vaultABI = [
  {
    name: "recordUSYCConversion",
    type: "function",
    inputs: [{ name: "usycAmount", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    name: "totalUSDC",
    type: "function",
    inputs: [],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    name: "totalUSYC",
    type: "function",
    inputs: [],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
] as const;

async function main() {
  console.log("=== Record USYC Conversion ===\n");

  let privateKey = process.env.PRIVATE_KEY_operator || process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("PRIVATE_KEY_operator not set");
  }
  if (!privateKey.startsWith("0x")) {
    privateKey = "0x" + privateKey;
  }

  const account = privateKeyToAccount(privateKey as `0x${string}`);
  console.log("Operator wallet:", account.address);

  const publicClient = createPublicClient({
    chain: arcTestnet,
    transport: http(),
  });

  const walletClient = createWalletClient({
    account,
    chain: arcTestnet,
    transport: http(),
  });

  // Check current state
  const operatorUSYC = await publicClient.readContract({
    address: USYC_ADDRESS,
    abi: erc20ABI,
    functionName: "balanceOf",
    args: [account.address],
  });
  console.log("Operator USYC balance:", formatUnits(operatorUSYC, 6), "USYC");

  const vaultUSYC = await publicClient.readContract({
    address: USYC_ADDRESS,
    abi: erc20ABI,
    functionName: "balanceOf",
    args: [TREASURY_VAULT],
  });
  console.log("Vault USYC balance:", formatUnits(vaultUSYC, 6), "USYC");

  const totalUSYC = await publicClient.readContract({
    address: TREASURY_VAULT,
    abi: vaultABI,
    functionName: "totalUSYC",
  });
  console.log("Vault totalUSYC (recorded):", formatUnits(totalUSYC, 6), "USYC");

  const totalUSDC = await publicClient.readContract({
    address: TREASURY_VAULT,
    abi: vaultABI,
    functionName: "totalUSDC",
  });
  console.log("Vault totalUSDC:", formatUnits(totalUSDC, 18), "USDC");

  // Amount to record - operator holds USYC, we just record it in vault
  // Note: Vault is not whitelisted for USYC transfers, so operator keeps USYC
  const amountToRecord = parseUnits("10", 6); // 10 USYC

  if (operatorUSYC < amountToRecord) {
    console.log("\n⚠️ Not enough USYC on operator!");
    return;
  }

  // Record conversion in vault (operator keeps USYC, vault tracks amount)
  console.log("\n--- Recording USYC Conversion ---");
  console.log("Amount:", formatUnits(amountToRecord, 6), "USYC");
  console.log("(Operator keeps USYC - vault not whitelisted for transfers)");
  console.log("Calling recordUSYCConversion()...");

  const recordHash = await walletClient.writeContract({
    address: TREASURY_VAULT,
    abi: vaultABI,
    functionName: "recordUSYCConversion",
    args: [amountToRecord],
  });
  console.log("Record tx:", recordHash);
  await publicClient.waitForTransactionReceipt({ hash: recordHash });
  console.log("Recorded!");

  // Verify
  const newVaultUSYC = await publicClient.readContract({
    address: USYC_ADDRESS,
    abi: erc20ABI,
    functionName: "balanceOf",
    args: [TREASURY_VAULT],
  });
  const newTotalUSYC = await publicClient.readContract({
    address: TREASURY_VAULT,
    abi: vaultABI,
    functionName: "totalUSYC",
  });
  const newTotalUSDC = await publicClient.readContract({
    address: TREASURY_VAULT,
    abi: vaultABI,
    functionName: "totalUSDC",
  });

  console.log("\n--- Final State ---");
  console.log("Vault USYC balance:", formatUnits(newVaultUSYC, 6), "USYC");
  console.log("Vault totalUSYC:", formatUnits(newTotalUSYC, 6), "USYC");
  console.log("Vault totalUSDC:", formatUnits(newTotalUSDC, 18), "USDC");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
