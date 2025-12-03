import { createWalletClient, createPublicClient, http, formatEther } from "viem";
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
  console.log("Deploying BridgeWrapper contract...\n");

  // Contract addresses on Arc Testnet
  const USDC_ADDRESS = "0x3600000000000000000000000000000000000000" as `0x${string}`;

  // Circle CCTP TokenMessenger on Arc Testnet
  const TOKEN_MESSENGER_ADDRESS = "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA" as `0x${string}`;

  // Initial fee: 5 basis points = 0.05%
  const INITIAL_FEE_BPS = 5n;

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

  console.log("Deploying with account:", account.address);
  const balance = await publicClient.getBalance({ address: account.address });
  console.log("Account balance:", formatEther(balance), "USDC\n");

  // Get contract artifact
  const artifact = await hre.artifacts.readArtifact("BridgeWrapper");

  // Deploy BridgeWrapper
  console.log("Deploying BridgeWrapper...");
  console.log("  USDC:", USDC_ADDRESS);
  console.log("  TokenMessenger:", TOKEN_MESSENGER_ADDRESS);
  console.log("  Initial fee:", INITIAL_FEE_BPS.toString(), "bps (0.05%)\n");

  const hash = await walletClient.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode as `0x${string}`,
    args: [USDC_ADDRESS, TOKEN_MESSENGER_ADDRESS, INITIAL_FEE_BPS],
  });

  console.log("Deploy tx:", hash);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  const contractAddress = receipt.contractAddress!;

  console.log("\n=== Deployment Complete ===");
  console.log("BridgeWrapper deployed to:", contractAddress);
  console.log("\nNext steps:");
  console.log("1. Update src/lib/constants.ts with BridgeWrapper address");
  console.log("2. Update useBridgeCCTP.ts to use BridgeWrapper");
  console.log("3. Update telegramBot.ts to track BridgeInitiated events");
  console.log("\nTo change fee, call setFee(newBasisPoints) as owner");
  console.log("To withdraw fees, call withdrawFees(toAddress) as owner");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
