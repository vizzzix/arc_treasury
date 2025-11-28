/**
 * Deploy USYCOracle contract
 *
 * This is needed because the current vault V6 was initialized with
 * an oracle address that doesn't exist (0xc7dc6e10...), causing deposits to fail.
 *
 * After deployment, the vault needs to be upgraded to use the new oracle.
 */
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
  console.log("=== Deploying USYCOracle ===\n");

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
  const artifactPath = resolve(__dirname, "../artifacts/contracts/USYCOracle.sol/USYCOracle.json");
  if (!fs.existsSync(artifactPath)) {
    console.log("\nArtifact not found. Compiling...");
    console.log("Run: cd contracts && npx hardhat compile");
    return;
  }

  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  const bytecode = artifact.bytecode as `0x${string}`;

  // Constructor params: (address _priceUpdater, uint256 _initialPrice)
  // Initial price: 1.10 USDC (1100000 with 6 decimals) - approximate current USYC NAV
  const priceUpdater = account.address; // Owner will be the updater initially
  const initialPrice = 1_100_000n; // 1.10 USDC (6 decimals)

  console.log("\nDeploying with params:");
  console.log("  priceUpdater:", priceUpdater);
  console.log("  initialPrice:", initialPrice.toString(), "(1.10 USDC)");

  const gasPrice = await publicClient.getGasPrice();

  // Deploy contract
  const hash = await walletClient.deployContract({
    abi: artifact.abi,
    bytecode,
    args: [priceUpdater, initialPrice],
    gas: 1_000_000n,
    gasPrice,
  });

  console.log("\nDeploy tx:", hash);

  const receipt = await publicClient.waitForTransactionReceipt({
    hash,
    timeout: 120_000,
  });

  console.log("Status:", receipt.status === "success" ? "SUCCESS" : "FAILED");
  console.log("Gas used:", receipt.gasUsed.toString());

  if (receipt.contractAddress) {
    console.log("\n================================");
    console.log("USYCOracle deployed at:", receipt.contractAddress);
    console.log("================================");
    console.log("\nNext step: Update vault to use this oracle.");
    console.log("The vault V6 needs to be upgraded with a function to set new oracle,");
    console.log("or a new V7 must be deployed.");
  }

  console.log("\n=== Done ===");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
