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

// Current proxy address
const PROXY_ADDRESS = "0x17ca5232415430bC57F646A72fD15634807bF729" as `0x${string}`;
const CORRECT_EURC = "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a" as `0x${string}`;

const PROXY_ABI = [
  {
    inputs: [
      { name: "newImplementation", type: "address" },
      { name: "data", type: "bytes" },
    ],
    name: "upgradeToAndCall",
    outputs: [],
    stateMutability: "payable",
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
    name: "eurc",
    outputs: [{ type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "_eurc", type: "address" }],
    name: "setEURC",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

async function main() {
  console.log("=== Upgrade V8 and Set Correct EURC Address ===\n");

  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) throw new Error("PRIVATE_KEY not set");

  const formattedKey = privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`;
  const account = privateKeyToAccount(formattedKey as `0x${string}`);
  console.log("Deployer:", account.address);

  const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });
  const walletClient = createWalletClient({ account, chain: arcTestnet, transport: http() });

  // Check balance
  const balance = await publicClient.getBalance({ address: account.address });
  console.log("Balance:", formatUnits(balance, 18), "USDC\n");

  // Check current state
  console.log("--- Current State ---");
  console.log("Proxy:", PROXY_ADDRESS);

  const owner = await publicClient.readContract({
    address: PROXY_ADDRESS,
    abi: PROXY_ABI,
    functionName: "owner",
  });
  console.log("Owner:", owner);

  if (owner.toLowerCase() !== account.address.toLowerCase()) {
    throw new Error("You are not the owner of this proxy!");
  }

  const currentEurc = await publicClient.readContract({
    address: PROXY_ADDRESS,
    abi: PROXY_ABI,
    functionName: "eurc",
  });
  console.log("Current EURC address:", currentEurc);
  console.log("Correct EURC address:", CORRECT_EURC);
  console.log("Need fix:", currentEurc.toLowerCase() !== CORRECT_EURC.toLowerCase());

  // Load V8 artifact
  const v8ArtifactPath = resolve(
    __dirname,
    "../artifacts/contracts/TreasuryVaultV8.sol/TreasuryVaultV8.json"
  );
  if (!fs.existsSync(v8ArtifactPath)) {
    throw new Error("V8 artifact not found. Run: npx hardhat compile");
  }

  const v8Artifact = JSON.parse(fs.readFileSync(v8ArtifactPath, "utf8"));
  const v8Bytecode = v8Artifact.bytecode as `0x${string}`;

  console.log("\n--- Step 1: Deploy New V8 Implementation (with setEURC) ---");
  const gasPrice = await publicClient.getGasPrice();

  const deployHash = await walletClient.deployContract({
    abi: v8Artifact.abi,
    bytecode: v8Bytecode,
    gas: 8_000_000n,
    gasPrice,
  });
  console.log("Deploy tx:", deployHash);

  const deployReceipt = await publicClient.waitForTransactionReceipt({
    hash: deployHash,
    timeout: 120_000,
  });

  if (deployReceipt.status !== "success") {
    throw new Error("Deploy failed!");
  }

  const v8Implementation = deployReceipt.contractAddress!;
  console.log("V8 Implementation deployed at:", v8Implementation);

  console.log("\n--- Step 2: Upgrade Proxy to New V8 ---");

  const upgradeHash = await walletClient.writeContract({
    address: PROXY_ADDRESS,
    abi: PROXY_ABI,
    functionName: "upgradeToAndCall",
    args: [v8Implementation, "0x"],
    gas: 500_000n,
    gasPrice,
  });
  console.log("Upgrade tx:", upgradeHash);

  const upgradeReceipt = await publicClient.waitForTransactionReceipt({
    hash: upgradeHash,
    timeout: 120_000,
  });

  if (upgradeReceipt.status !== "success") {
    throw new Error("Upgrade failed!");
  }
  console.log("Upgrade successful!");

  console.log("\n--- Step 3: Call setEURC to Fix Address ---");

  const setEurcHash = await walletClient.writeContract({
    address: PROXY_ADDRESS,
    abi: PROXY_ABI,
    functionName: "setEURC",
    args: [CORRECT_EURC],
    gas: 100_000n,
    gasPrice,
  });
  console.log("setEURC tx:", setEurcHash);

  const setEurcReceipt = await publicClient.waitForTransactionReceipt({
    hash: setEurcHash,
    timeout: 120_000,
  });

  if (setEurcReceipt.status !== "success") {
    throw new Error("setEURC failed!");
  }
  console.log("setEURC successful!");

  // Verify
  console.log("\n--- Step 4: Verify ---");

  const newEurc = await publicClient.readContract({
    address: PROXY_ADDRESS,
    abi: PROXY_ABI,
    functionName: "eurc",
  });
  console.log("New EURC address:", newEurc);
  console.log("Expected:", CORRECT_EURC);

  if (newEurc.toLowerCase() === CORRECT_EURC.toLowerCase()) {
    console.log("\n✅ SUCCESS! EURC address fixed!");
  } else {
    console.log("\n❌ FAILED! EURC address mismatch!");
  }

  console.log("\n========================================");
  console.log("DONE!");
  console.log("========================================");
  console.log("New implementation:", v8Implementation);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
