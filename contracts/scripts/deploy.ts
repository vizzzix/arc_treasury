import { createWalletClient, createPublicClient, http, parseUnits, formatEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { defineChain } from "viem";
import hre from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

// Define Arc Testnet chain
const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.testnet.arc.network"] },
  },
});

async function main() {
  console.log("Deploying Treasury Vault contracts...");

  // Contract addresses on Arc Testnet
  const USDC_ADDRESS = "0x3600000000000000000000000000000000000000" as `0x${string}`;
  const EURC_ADDRESS = "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a" as `0x${string}`;
  const USYC_ADDRESS = "0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C" as `0x${string}`;
  const ENTITLEMENTS_ADDRESS = "0xcc205224862c7641930c87679e98999d23c26113" as `0x${string}`;
  const TELLER_ADDRESS = "0x9fdF14c5B14173D74C08Af27AebFf39240dC105A" as `0x${string}`;

  // Treasury operator (must be allowlisted)
  const TREASURY_OPERATOR = (process.env.TREASURY_OPERATOR || "0xB66D4229Bb5A82De94610d63677cF5370e6a81cb") as `0x${string}`;

  // Platform fee: 0.5% = 50 basis points
  const PLATFORM_FEE_BPS = 50n;

  // Initial USYC price (1 USYC = 1 USDC for testnet, will be updated via oracle)
  const INITIAL_USYC_PRICE = parseUnits("1", 6); // 1.0 USDC with 6 decimals

  // Setup wallet and public client
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("PRIVATE_KEY environment variable is not set");
  }

  const account = privateKeyToAccount(privateKey as `0x${string}`);

  const publicClient = createPublicClient({
    chain: arcTestnet,
    transport: http(),
  });

  const walletClient = createWalletClient({
    account,
    chain: arcTestnet,
    transport: http(),
  });

  console.log("Deploying contracts with account:", account.address);
  const balance = await publicClient.getBalance({ address: account.address });
  console.log("Account balance:", formatEther(balance), "USDC");

  // Get contract artifacts
  const oracleArtifact = await hre.artifacts.readArtifact("USYCOracle");
  const vaultArtifact = await hre.artifacts.readArtifact("TreasuryVault");

  // Deploy USYC Oracle
  console.log("\n1. Deploying USYCOracle...");
  const oracleHash = await walletClient.deployContract({
    abi: oracleArtifact.abi,
    bytecode: oracleArtifact.bytecode as `0x${string}`,
    args: [account.address, INITIAL_USYC_PRICE],
  });
  console.log("Oracle deploy tx:", oracleHash);
  const oracleReceipt = await publicClient.waitForTransactionReceipt({ hash: oracleHash });
  const usycOracleAddress = oracleReceipt.contractAddress!;
  console.log("USYCOracle deployed to:", usycOracleAddress);

  // Deploy Treasury Vault
  console.log("\n2. Deploying TreasuryVault...");
  const vaultHash = await walletClient.deployContract({
    abi: vaultArtifact.abi,
    bytecode: vaultArtifact.bytecode as `0x${string}`,
    args: [
      USDC_ADDRESS,
      EURC_ADDRESS,
      USYC_ADDRESS,
      ENTITLEMENTS_ADDRESS,
      usycOracleAddress,
      TREASURY_OPERATOR,
      PLATFORM_FEE_BPS,
    ],
  });
  console.log("Vault deploy tx:", vaultHash);
  const vaultReceipt = await publicClient.waitForTransactionReceipt({ hash: vaultHash });
  const treasuryVaultAddress = vaultReceipt.contractAddress!;
  console.log("TreasuryVault deployed to:", treasuryVaultAddress);

  // Set Teller contract for USDC/USYC conversion
  console.log("\n3. Setting Teller contract...");
  const setTellerHash = await walletClient.writeContract({
    address: treasuryVaultAddress,
    abi: vaultArtifact.abi,
    functionName: "setTeller",
    args: [TELLER_ADDRESS],
  });
  await publicClient.waitForTransactionReceipt({ hash: setTellerHash });
  console.log("✓ Teller set to:", TELLER_ADDRESS);

  console.log("\n=== Deployment Summary ===");
  console.log("USYCOracle:", usycOracleAddress);
  console.log("TreasuryVault:", treasuryVaultAddress);
  console.log("Teller:", TELLER_ADDRESS);
  console.log("Treasury Operator:", TREASURY_OPERATOR);
  console.log("Platform Fee:", PLATFORM_FEE_BPS.toString(), "bps (0.5%)");
  console.log("\nNext steps:");
  console.log("1. Verify vault address is allowlisted in USYC Entitlements");
  console.log("2. Update USYC price in oracle via updatePrice()");
  console.log("3. Operator can call mintUSYC() / redeemUSYC() for real conversion");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
