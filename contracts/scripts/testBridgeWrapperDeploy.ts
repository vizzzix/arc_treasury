/**
 * Test script to verify BridgeWrapper contract works correctly
 *
 * Tests:
 * 1. Deploy BridgeWrapper
 * 2. Check fee calculation
 * 3. Simulate bridge call (without actual USDC)
 */

import { createWalletClient, createPublicClient, http, formatUnits, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { defineChain } from "viem";
import hre from "hardhat";
import * as dotenv from "dotenv";

dotenv.config({ path: '../.env' });

const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.testnet.arc.network"] },
  },
});

// Contract addresses on Arc Testnet
const USDC_ADDRESS = "0x3600000000000000000000000000000000000000" as `0x${string}`;
const TOKEN_MESSENGER_ADDRESS = "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA" as `0x${string}`;

async function main() {
  console.log("=== BridgeWrapper Test ===\n");

  const privateKey = process.env.PRIVATE_KEY_OPERATOR || process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("PRIVATE_KEY not set");
  }

  const account = privateKeyToAccount(`0x${privateKey.replace('0x', '')}` as `0x${string}`);

  const publicClient = createPublicClient({
    chain: arcTestnet,
    transport: http(),
  });

  const walletClient = createWalletClient({
    account,
    chain: arcTestnet,
    transport: http(),
  });

  console.log("Account:", account.address);

  // Check balance
  const balance = await publicClient.getBalance({ address: account.address });
  console.log("ETH Balance:", formatUnits(balance, 18));

  // Get artifact
  const artifact = await hre.artifacts.readArtifact("BridgeWrapper");
  console.log("\nBridgeWrapper ABI loaded, bytecode length:", artifact.bytecode.length);

  // Test 1: Check if TokenMessenger exists
  console.log("\n--- Test 1: Verify TokenMessenger ---");
  try {
    const code = await publicClient.getCode({ address: TOKEN_MESSENGER_ADDRESS });
    if (code && code !== '0x') {
      console.log("✅ TokenMessenger contract exists at", TOKEN_MESSENGER_ADDRESS);
    } else {
      console.log("❌ TokenMessenger NOT FOUND at", TOKEN_MESSENGER_ADDRESS);
      return;
    }
  } catch (e: any) {
    console.log("❌ Error checking TokenMessenger:", e.message);
    return;
  }

  // Test 2: Check if USDC exists
  console.log("\n--- Test 2: Verify USDC ---");
  try {
    const code = await publicClient.getCode({ address: USDC_ADDRESS });
    if (code && code !== '0x') {
      console.log("✅ USDC contract exists at", USDC_ADDRESS);
    } else {
      console.log("❌ USDC NOT FOUND at", USDC_ADDRESS);
      return;
    }
  } catch (e: any) {
    console.log("❌ Error checking USDC:", e.message);
    return;
  }

  // Test 3: Deploy BridgeWrapper
  console.log("\n--- Test 3: Deploy BridgeWrapper ---");
  const FEE_BPS = 5n; // 0.05%

  try {
    console.log("Deploying with:");
    console.log("  USDC:", USDC_ADDRESS);
    console.log("  TokenMessenger:", TOKEN_MESSENGER_ADDRESS);
    console.log("  Fee:", FEE_BPS.toString(), "bps (0.05%)");

    const hash = await walletClient.deployContract({
      abi: artifact.abi,
      bytecode: artifact.bytecode as `0x${string}`,
      args: [USDC_ADDRESS, TOKEN_MESSENGER_ADDRESS, FEE_BPS],
    });

    console.log("Deploy TX:", hash);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    if (receipt.status === 'success' && receipt.contractAddress) {
      console.log("✅ BridgeWrapper deployed to:", receipt.contractAddress);

      // Test 4: Read fee from deployed contract
      console.log("\n--- Test 4: Verify Contract Functions ---");

      const feeBps = await publicClient.readContract({
        address: receipt.contractAddress,
        abi: artifact.abi,
        functionName: 'feeBasisPoints',
      });
      console.log("feeBasisPoints():", feeBps);

      // Test calculateFee
      const testAmount = parseUnits("100", 18); // 100 USDC
      const [fee, bridgeAmount] = await publicClient.readContract({
        address: receipt.contractAddress,
        abi: artifact.abi,
        functionName: 'calculateFee',
        args: [testAmount],
      }) as [bigint, bigint];

      console.log("calculateFee(100 USDC):");
      console.log("  Fee:", formatUnits(fee, 18), "USDC");
      console.log("  Bridge amount:", formatUnits(bridgeAmount, 18), "USDC");

      // Test addressToBytes32
      const bytes32 = await publicClient.readContract({
        address: receipt.contractAddress,
        abi: artifact.abi,
        functionName: 'addressToBytes32',
        args: [account.address],
      });
      console.log("addressToBytes32():", bytes32);

      console.log("\n=== SUCCESS ===");
      console.log("BridgeWrapper address:", receipt.contractAddress);
      console.log("\nAdd this to constants.ts:");
      console.log(`  BridgeWrapper: '${receipt.contractAddress}' as \`0x\${string}\`,`);

    } else {
      console.log("❌ Deploy failed, status:", receipt.status);
    }
  } catch (e: any) {
    console.log("❌ Deploy error:", e.message);
    if (e.message.includes('revert')) {
      console.log("Contract reverted - check constructor parameters");
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
