import { createWalletClient, createPublicClient, http, parseAbi, pad, formatUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import hre from "hardhat";

const SEPOLIA_RPC = "https://ethereum-sepolia-rpc.publicnode.com";
const USDC = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238" as `0x${string}`;
const TOKEN_MESSENGER = "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA" as `0x${string}`;

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

  console.log("Deploying TestDepositForBurn...");

  const artifact = await hre.artifacts.readArtifact("TestDepositForBurn");

  const hash = await walletClient.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode as `0x${string}`,
    args: [USDC, TOKEN_MESSENGER],
  });

  console.log("Deploy tx:", hash);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  const testContract = receipt.contractAddress!;
  console.log("TestDepositForBurn deployed to:", testContract);

  // Check allowance
  const checkAllowanceAbi = parseAbi(["function checkAllowance() view returns (uint256)"]);
  const allowance = await publicClient.readContract({
    address: testContract,
    abi: checkAllowanceAbi,
    functionName: "checkAllowance",
  }) as bigint;
  console.log("Contract -> TokenMessenger allowance:", allowance > 0n ? "MAX" : "ZERO");

  // Approve this contract
  const erc20Abi = parseAbi([
    "function approve(address spender, uint256 amount) returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)",
  ]);

  console.log("\nApproving test contract...");
  const approveHash = await walletClient.writeContract({
    address: USDC,
    abi: erc20Abi,
    functionName: "approve",
    args: [testContract, BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff")],
  });
  await publicClient.waitForTransactionReceipt({ hash: approveHash });
  console.log("Approved!");

  // Test bridge
  console.log("\nTesting bridge with 0.5 USDC...");
  const testBridgeAbi = parseAbi([
    "function testBridge(uint256 amount, bytes32 mintRecipient) external returns (uint64)"
  ]);

  const amount = 500000n; // 0.5 USDC
  const mintRecipient = pad(account.address, { size: 32 });

  try {
    const bridgeHash = await walletClient.writeContract({
      address: testContract,
      abi: testBridgeAbi,
      functionName: "testBridge",
      args: [amount, mintRecipient],
    });
    console.log("Bridge tx:", bridgeHash);

    const bridgeReceipt = await publicClient.waitForTransactionReceipt({ hash: bridgeHash });
    console.log("Status:", bridgeReceipt.status);
    console.log("Logs:", bridgeReceipt.logs.length);

    if (bridgeReceipt.status === "success") {
      console.log("\n=== TEST PASSED! Bridge through wrapper works! ===");
    }
  } catch (err: any) {
    console.log("FAILED:", err.message.slice(0, 800));
  }
}

main().catch(console.error);
