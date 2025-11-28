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

// ABI for setBaseAPY and baseAPYBps
const VAULT_ABI = [
  {
    inputs: [{ name: "_newAPYBps", type: "uint256" }],
    name: "setBaseAPY",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "baseAPYBps",
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

async function main() {
  // Get APY from command line argument (default 420 = 4.2%)
  const newAPYBps = process.argv[2] ? parseInt(process.argv[2]) : 420;

  console.log(`=== Setting Base APY to ${newAPYBps} bps (${newAPYBps / 100}%) ===\n`);

  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) throw new Error("PRIVATE_KEY not set");

  const formattedKey = privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`;
  const account = privateKeyToAccount(formattedKey as `0x${string}`);
  console.log("Caller:", account.address);

  const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });
  const walletClient = createWalletClient({ account, chain: arcTestnet, transport: http() });

  // Check current APY
  const currentAPY = await publicClient.readContract({
    address: PROXY_ADDRESS,
    abi: VAULT_ABI,
    functionName: "baseAPYBps",
  });
  console.log(`Current APY: ${currentAPY} bps (${Number(currentAPY) / 100}%)`);

  if (Number(currentAPY) === newAPYBps) {
    console.log("APY already set to this value. No action needed.");
    return;
  }

  const gasPrice = await publicClient.getGasPrice();

  console.log(`\nSetting APY to ${newAPYBps} bps...`);
  const hash = await walletClient.writeContract({
    address: PROXY_ADDRESS,
    abi: VAULT_ABI,
    functionName: "setBaseAPY",
    args: [BigInt(newAPYBps)],
    gas: 100_000n,
    gasPrice,
  });
  console.log("Tx:", hash);

  const receipt = await publicClient.waitForTransactionReceipt({
    hash,
    timeout: 120_000,
  });
  console.log("Confirmed in block:", receipt.blockNumber);

  // Verify new APY
  const newAPY = await publicClient.readContract({
    address: PROXY_ADDRESS,
    abi: VAULT_ABI,
    functionName: "baseAPYBps",
  });
  console.log(`\nNew APY: ${newAPY} bps (${Number(newAPY) / 100}%)`);
  console.log("\n=== Done ===");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
