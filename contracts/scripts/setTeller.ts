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

// Contract addresses
const PROXY_ADDRESS = "0x17ca5232415430bC57F646A72fD15634807bF729" as `0x${string}`;

// Real USYC Teller on Arc Testnet (discovered from your mint transactions)
const REAL_TELLER = "0x9fdF14c5B14173d74c08af27aEBff39240Dc105a" as `0x${string}`;

// ABI for setTeller and teller view
const VAULT_ABI = [
  {
    inputs: [{ name: "_teller", type: "address" }],
    name: "setTeller",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "teller",
    outputs: [{ type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "usyc",
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
  // Get new Teller address from command line or use default
  const newTeller = (process.argv[2] || REAL_TELLER) as `0x${string}`;

  console.log("=== Setting Teller Address ===\n");

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
    console.log("\n⚠️  WARNING: You are not the owner of this contract!");
    console.log("This transaction will likely fail.");
  }

  // Check current Teller
  const currentTeller = await publicClient.readContract({
    address: PROXY_ADDRESS,
    abi: VAULT_ABI,
    functionName: "teller",
  });
  console.log("Current Teller:", currentTeller);

  // Check USYC address
  const usycAddress = await publicClient.readContract({
    address: PROXY_ADDRESS,
    abi: VAULT_ABI,
    functionName: "usyc",
  });
  console.log("USYC in contract:", usycAddress);

  if (currentTeller.toLowerCase() === newTeller.toLowerCase()) {
    console.log("\n✅ Teller already set to this address. No action needed.");
    return;
  }

  console.log(`\nSetting Teller to: ${newTeller}`);
  console.log("(Real USYC Teller on Arc Testnet)\n");

  const gasPrice = await publicClient.getGasPrice();

  const hash = await walletClient.writeContract({
    address: PROXY_ADDRESS,
    abi: VAULT_ABI,
    functionName: "setTeller",
    args: [newTeller],
    gas: 100_000n,
    gasPrice,
  });
  console.log("Tx:", hash);

  const receipt = await publicClient.waitForTransactionReceipt({
    hash,
    timeout: 120_000,
  });
  console.log("Confirmed in block:", receipt.blockNumber);
  console.log("Status:", receipt.status === "success" ? "✅ SUCCESS" : "❌ FAILED");

  // Verify new Teller
  const verifyTeller = await publicClient.readContract({
    address: PROXY_ADDRESS,
    abi: VAULT_ABI,
    functionName: "teller",
  });
  console.log("\n✅ New Teller:", verifyTeller);
  console.log("\n=== Done ===");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
