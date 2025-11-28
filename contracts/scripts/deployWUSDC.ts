import { createWalletClient, createPublicClient, http, formatUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { defineChain } from "viem";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import * as fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, "../../.env") });

const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.arc.network"] } },
});

async function main() {
  console.log("=== Deploying ArcWUSDC ===\n");

  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) throw new Error("PRIVATE_KEY not set");

  const formattedKey = privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`;
  const account = privateKeyToAccount(formattedKey as `0x${string}`);
  console.log("Deployer:", account.address);

  const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });
  const walletClient = createWalletClient({ account, chain: arcTestnet, transport: http() });

  // Check balance
  const balance = await publicClient.getBalance({ address: account.address });
  console.log("Balance:", formatUnits(balance, 18), "USDC");

  // Load compiled contract
  const artifactPath = resolve(__dirname, "../artifacts/contracts/ArcWUSDC.sol/ArcWUSDC.json");
  if (!fs.existsSync(artifactPath)) {
    throw new Error("Artifact not found. Run: npx hardhat compile");
  }

  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  const bytecode = artifact.bytecode as `0x${string}`;

  console.log("\nDeploying ArcWUSDC...");

  const gasPrice = await publicClient.getGasPrice();

  const hash = await walletClient.deployContract({
    abi: artifact.abi,
    bytecode,
    gas: 1_000_000n,
    gasPrice,
  });

  console.log("Deploy tx:", hash);

  const receipt = await publicClient.waitForTransactionReceipt({
    hash,
    timeout: 120_000,
  });

  console.log("Status:", receipt.status === "success" ? "SUCCESS" : "FAILED");
  console.log("Gas used:", receipt.gasUsed.toString());

  if (receipt.contractAddress) {
    console.log("\n================================");
    console.log("ArcWUSDC deployed at:", receipt.contractAddress);
    console.log("================================");
    console.log("\nNext step: Set WUSDC in vault:");
    console.log(`npx tsx scripts/setWUSDC.ts ${receipt.contractAddress}`);
  }

  console.log("\n=== Done ===");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
