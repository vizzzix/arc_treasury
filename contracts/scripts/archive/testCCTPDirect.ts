/**
 * Test CCTP depositForBurn directly (without wrapper)
 * This verifies if CCTP works at all
 */

import { createWalletClient, createPublicClient, http, parseAbi, pad, formatUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

const SEPOLIA_RPC = "https://ethereum-sepolia-rpc.publicnode.com";

const TOKEN_MESSENGER = "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA" as `0x${string}`;
const USDC = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238" as `0x${string}`;

const erc20Abi = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
]);

const depositForBurnAbi = parseAbi([
  "function depositForBurn(uint256 amount, uint32 destinationDomain, bytes32 mintRecipient, address burnToken, bytes32 destinationCaller, uint256 maxFee, uint32 minFinalityThreshold) external returns (uint64 nonce)"
]);

async function main() {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) throw new Error("PRIVATE_KEY required");

  const account = privateKeyToAccount(privateKey as `0x${string}`);

  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(SEPOLIA_RPC),
  });

  const walletClient = createWalletClient({
    account,
    chain: sepolia,
    transport: http(SEPOLIA_RPC),
  });

  console.log("Testing CCTP DIRECT (no wrapper)");
  console.log("User:", account.address);
  console.log("TokenMessenger:", TOKEN_MESSENGER);
  console.log("");

  // Check user balance
  const balance = await publicClient.readContract({
    address: USDC, abi: erc20Abi, functionName: "balanceOf",
    args: [account.address],
  });
  console.log("User USDC balance:", formatUnits(balance, 6));

  // Check allowance to TokenMessenger
  const allowance = await publicClient.readContract({
    address: USDC, abi: erc20Abi, functionName: "allowance",
    args: [account.address, TOKEN_MESSENGER],
  });
  console.log("User -> TokenMessenger allowance:", allowance > 0n ? formatUnits(allowance, 6) : "ZERO");

  // Approve TokenMessenger if needed
  if (allowance < 1000000n) {
    console.log("\nApproving TokenMessenger for 10 USDC...");
    const approveHash = await walletClient.writeContract({
      address: USDC,
      abi: erc20Abi,
      functionName: "approve",
      args: [TOKEN_MESSENGER, 10000000n], // 10 USDC
    });
    await publicClient.waitForTransactionReceipt({ hash: approveHash });
    console.log("Approved!");
  }

  // Call depositForBurn directly
  console.log("\nCalling depositForBurn directly with 1 USDC...");
  const amount = 1000000n; // 1 USDC
  const mintRecipient = pad(account.address, { size: 32 });

  try {
    const hash = await walletClient.writeContract({
      address: TOKEN_MESSENGER,
      abi: depositForBurnAbi,
      functionName: "depositForBurn",
      args: [
        amount,
        26, // Arc domain
        mintRecipient,
        USDC,
        "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`,
        0n,
        1000
      ],
    });
    console.log("TX:", hash);

    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log("Status:", receipt.status === "success" ? "SUCCESS!" : "FAILED");
    console.log("Gas used:", receipt.gasUsed.toString());
    console.log("Logs:", receipt.logs.length);

    if (receipt.status === "success") {
      console.log("\n=== CCTP WORKS! The problem is in the wrapper contract. ===");
    }
  } catch (err: any) {
    console.log("FAILED:", err.message.slice(0, 800));
  }
}

main().catch(console.error);
