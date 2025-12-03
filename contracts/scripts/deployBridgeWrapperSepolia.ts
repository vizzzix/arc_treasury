import { createWalletClient, createPublicClient, http, formatEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import hre from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  console.log("Deploying BridgeWrapperSepolia contract...\n");

  // Contract addresses on Sepolia
  const USDC_ADDRESS = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238" as `0x${string}`;

  // Circle CCTP V2 TokenMessenger on Sepolia
  const TOKEN_MESSENGER_ADDRESS = "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA" as `0x${string}`;

  // Circle CCTP V2 TokenMinter (localMinter) on Sepolia - THIS is what we need to approve for burns!
  // TokenMessenger.depositForBurn() delegates to TokenMinter.burn() which does transferFrom
  // Got this by calling tokenMessenger.localMinter()
  const TOKEN_MINTER_ADDRESS = "0xb43db544E2c27092c107639Ad201b3dEfAbcF192" as `0x${string}`;

  // Initial fee: 5 basis points = 0.05%
  const INITIAL_FEE_BPS = 5n;

  // Setup wallet and public client
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("PRIVATE_KEY environment variable is not set");
  }

  const account = privateKeyToAccount(privateKey as `0x${string}`);

  // Use BlockPi public RPC for Sepolia
  const SEPOLIA_RPC = "https://ethereum-sepolia-rpc.publicnode.com";

  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(SEPOLIA_RPC),
  });

  const walletClient = createWalletClient({
    account,
    chain: sepolia,
    transport: http(SEPOLIA_RPC),
  });

  console.log("Deploying with account:", account.address);
  const balance = await publicClient.getBalance({ address: account.address });
  console.log("Account balance:", formatEther(balance), "ETH\n");

  if (balance === 0n) {
    throw new Error("Account has no ETH for gas! Please fund the account first.");
  }

  // Get contract artifact
  const artifact = await hre.artifacts.readArtifact("BridgeWrapperSepolia");

  // Deploy BridgeWrapperSepolia
  console.log("Deploying BridgeWrapperSepolia...");
  console.log("  USDC:", USDC_ADDRESS);
  console.log("  TokenMessenger:", TOKEN_MESSENGER_ADDRESS);
  console.log("  TokenMinter:", TOKEN_MINTER_ADDRESS);
  console.log("  Initial fee:", INITIAL_FEE_BPS.toString(), "bps (0.05%)\n");

  const hash = await walletClient.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode as `0x${string}`,
    args: [USDC_ADDRESS, TOKEN_MESSENGER_ADDRESS, TOKEN_MINTER_ADDRESS, INITIAL_FEE_BPS],
  });

  console.log("Deploy tx:", hash);
  console.log("Waiting for confirmation...");

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  const contractAddress = receipt.contractAddress!;

  console.log("\n=== Deployment Complete ===");
  console.log("BridgeWrapperSepolia deployed to:", contractAddress);
  console.log("\nNext steps:");
  console.log("1. Update src/lib/constants.ts with BridgeWrapperSepolia address");
  console.log("2. Create useBridgeWrapperSepolia.ts hook");
  console.log("3. Update Bridge.tsx to use Sepolia wrapper");
  console.log("4. Update telegramBot.ts to track Sepolia BridgeInitiated events");
  console.log("\nTo change fee, call setFee(newBasisPoints) as owner");
  console.log("To withdraw fees, call withdrawFees(toAddress) as owner");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
