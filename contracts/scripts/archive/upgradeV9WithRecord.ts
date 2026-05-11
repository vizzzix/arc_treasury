import { createWalletClient, createPublicClient, http, encodeFunctionData, formatUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { defineChain } from "viem";
import * as dotenv from "dotenv";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, "../../.env") });

const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.arc.network"] } },
});

const PROXY_ADDRESS = "0x17ca5232415430bc57f646a72fd15634807bf729" as `0x${string}`;

async function main() {
  console.log("=== Upgrade V9 with recordUSYCConversion ===\n");

  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) throw new Error("PRIVATE_KEY not set");

  const formattedKey = privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`;
  const account = privateKeyToAccount(formattedKey as `0x${string}`);
  console.log("Deploying from:", account.address);

  const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });
  const walletClient = createWalletClient({ account, chain: arcTestnet, transport: http() });

  const balance = await publicClient.getBalance({ address: account.address });
  console.log("Balance:", formatUnits(balance, 18), "ETH\n");

  // Get V9 bytecode
  const artifactPath = resolve(__dirname, "../artifacts/contracts/TreasuryVaultV9.sol/TreasuryVaultV9.json");
  const artifact = JSON.parse(readFileSync(artifactPath, "utf8"));

  console.log("--- Deploy New V9 Implementation ---");
  const gasPrice = await publicClient.getGasPrice();

  const deployHash = await walletClient.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode as `0x${string}`,
    gas: 8_000_000n,
    gasPrice,
  });

  console.log("Deploy tx:", deployHash);
  const receipt = await publicClient.waitForTransactionReceipt({ hash: deployHash, timeout: 120_000 });

  if (receipt.status !== "success") {
    throw new Error("Deploy failed!");
  }

  const implAddress = receipt.contractAddress!;
  console.log("New implementation:", implAddress);

  // Upgrade proxy
  console.log("\n--- Upgrade Proxy ---");
  const upgradeData = encodeFunctionData({
    abi: [{ name: "upgradeToAndCall", type: "function", inputs: [{ name: "newImplementation", type: "address" }, { name: "data", type: "bytes" }], outputs: [] }],
    functionName: "upgradeToAndCall",
    args: [implAddress, "0x"],
  });

  const upgradeTx = await walletClient.sendTransaction({
    to: PROXY_ADDRESS,
    data: upgradeData,
    gas: 500_000n,
    gasPrice,
  });
  console.log("Upgrade tx:", upgradeTx);
  const upgradeReceipt = await publicClient.waitForTransactionReceipt({ hash: upgradeTx, timeout: 120_000 });

  if (upgradeReceipt.status !== "success") {
    throw new Error("Upgrade failed!");
  }

  // Verify
  const code = await publicClient.getCode({ address: implAddress });
  const hasRecord = code?.toLowerCase().includes("40b9de5e");
  console.log("\nrecordUSYCConversion:", hasRecord ? "EXISTS" : "NOT FOUND");

  console.log("\n========================================");
  console.log("UPGRADE COMPLETE!");
  console.log("========================================");
  console.log("Proxy:", PROXY_ADDRESS);
  console.log("Implementation:", implAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
