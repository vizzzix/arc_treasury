/**
 * Test BridgeWrapperSepolia V5 step by step
 * This script will:
 * 1. Check allowances
 * 2. Transfer 1 USDC to V5 wrapper manually
 * 3. Call depositForBurn from V5 wrapper perspective (simulate)
 */

import { createWalletClient, createPublicClient, http, parseAbi, encodeFunctionData, pad, formatUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

const SEPOLIA_RPC = "https://ethereum-sepolia-rpc.publicnode.com";

const V5_WRAPPER = "0x52bf7b1fcd983dfe897ce194fe686719995d87c3" as `0x${string}`;
const USDC = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238" as `0x${string}`;
const TOKEN_MESSENGER = "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA" as `0x${string}`;
const LOCAL_MINTER = "0xb43db544E2c27092c107639Ad201b3dEfAbcF192" as `0x${string}`;

const erc20Abi = parseAbi([
  "function transfer(address to, uint256 amount) returns (bool)",
  "function transferFrom(address from, address to, uint256 amount) returns (bool)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
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

  console.log("Testing from:", account.address);
  console.log("V5 Wrapper:", V5_WRAPPER);
  console.log("");

  // 1. Check current state
  console.log("=== Current State ===");

  const userBalance = await publicClient.readContract({
    address: USDC, abi: erc20Abi, functionName: "balanceOf",
    args: [account.address],
  });
  console.log("User USDC balance:", formatUnits(userBalance, 6));

  const wrapperBalance = await publicClient.readContract({
    address: USDC, abi: erc20Abi, functionName: "balanceOf",
    args: [V5_WRAPPER],
  });
  console.log("V5 Wrapper balance:", formatUnits(wrapperBalance, 6));

  const wrapperToMessenger = await publicClient.readContract({
    address: USDC, abi: erc20Abi, functionName: "allowance",
    args: [V5_WRAPPER, TOKEN_MESSENGER],
  });
  console.log("V5 -> TokenMessenger allowance:", wrapperToMessenger > 0n ? "MAX" : "ZERO");

  // 2. Transfer 1 USDC to V5 wrapper
  console.log("\n=== Transferring 1 USDC to V5 Wrapper ===");
  const transferAmount = 1000000n; // 1 USDC

  const transferHash = await walletClient.writeContract({
    address: USDC,
    abi: erc20Abi,
    functionName: "transfer",
    args: [V5_WRAPPER, transferAmount],
  });
  console.log("Transfer tx:", transferHash);
  await publicClient.waitForTransactionReceipt({ hash: transferHash });
  console.log("Transfer confirmed!");

  // 3. Check V5 wrapper balance now
  const newWrapperBalance = await publicClient.readContract({
    address: USDC, abi: erc20Abi, functionName: "balanceOf",
    args: [V5_WRAPPER],
  });
  console.log("V5 Wrapper new balance:", formatUnits(newWrapperBalance, 6));

  // 4. Now simulate depositForBurn
  console.log("\n=== Simulating depositForBurn from V5 Wrapper ===");

  const depositForBurnAbi = parseAbi([
    "function depositForBurn(uint256 amount, uint32 destinationDomain, bytes32 mintRecipient, address burnToken, bytes32 destinationCaller, uint256 maxFee, uint32 minFinalityThreshold) external returns (uint64 nonce)"
  ]);

  const mintRecipient = pad(account.address, { size: 32 });
  const bridgeAmount = 950000n; // 0.95 USDC (after hypothetical fee)

  try {
    const result = await publicClient.simulateContract({
      account: V5_WRAPPER,
      address: TOKEN_MESSENGER,
      abi: depositForBurnAbi,
      functionName: "depositForBurn",
      args: [bridgeAmount, 26, mintRecipient, USDC, "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`, 0n, 1000],
    });
    console.log("SUCCESS! Nonce:", result.result.toString());
  } catch (err: any) {
    console.log("FAILED:", err.message.slice(0, 500));
  }
}

main().catch(console.error);
