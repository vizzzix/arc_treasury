/**
 * Test BridgeWrapperSepolia V5 with REAL transaction
 */

import { createWalletClient, createPublicClient, http, parseAbi, pad, formatUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

const SEPOLIA_RPC = "https://ethereum-sepolia-rpc.publicnode.com";

const V5_WRAPPER = "0x52bf7b1fcd983dfe897ce194fe686719995d87c3" as `0x${string}`;
const USDC = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238" as `0x${string}`;

const erc20Abi = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
]);

const bridgeAbi = parseAbi([
  "function bridgeToArc(uint256 amount, bytes32 mintRecipient) external returns (uint64 nonce)"
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

  console.log("Testing V5 with REAL transactions");
  console.log("User:", account.address);
  console.log("V5 Wrapper:", V5_WRAPPER);
  console.log("");

  // Check allowance
  const allowance = await publicClient.readContract({
    address: USDC, abi: erc20Abi, functionName: "allowance",
    args: [account.address, V5_WRAPPER],
  });
  console.log("User -> V5 allowance:", allowance > 0n ? "OK" : "ZERO");

  // Approve if needed
  if (allowance === 0n) {
    console.log("\nApproving V5...");
    const approveHash = await walletClient.writeContract({
      address: USDC,
      abi: erc20Abi,
      functionName: "approve",
      args: [V5_WRAPPER, BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff")],
    });
    await publicClient.waitForTransactionReceipt({ hash: approveHash });
    console.log("Approved!");
  }

  // Bridge 1 USDC
  console.log("\nBridging 1 USDC via V5...");
  const amount = 1000000n; // 1 USDC
  const mintRecipient = pad(account.address, { size: 32 });

  try {
    const bridgeHash = await walletClient.writeContract({
      address: V5_WRAPPER,
      abi: bridgeAbi,
      functionName: "bridgeToArc",
      args: [amount, mintRecipient],
    });
    console.log("Bridge tx:", bridgeHash);

    const receipt = await publicClient.waitForTransactionReceipt({ hash: bridgeHash });
    console.log("Status:", receipt.status === "success" ? "SUCCESS!" : "FAILED");
    console.log("Gas used:", receipt.gasUsed.toString());
    console.log("Logs:", receipt.logs.length);
  } catch (err: any) {
    console.log("FAILED:", err.message.slice(0, 500));
  }
}

main().catch(console.error);
