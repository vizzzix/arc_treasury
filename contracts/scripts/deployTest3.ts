import { createWalletClient, createPublicClient, http, parseAbi, pad, decodeEventLog } from "viem";
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

  console.log("Deploying TestBridge3...");
  const artifact = await hre.artifacts.readArtifact("TestBridge3");

  const hash = await walletClient.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode as `0x${string}`,
    args: [USDC, TOKEN_MESSENGER],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  const testContract = receipt.contractAddress!;
  console.log("Deployed to:", testContract);

  // Check allowance was set in constructor
  const allowanceAbi = parseAbi(["function allowance(address owner, address spender) view returns (uint256)"]);
  const allowance = await publicClient.readContract({
    address: USDC,
    abi: allowanceAbi,
    functionName: "allowance",
    args: [testContract, TOKEN_MESSENGER],
  }) as bigint;
  console.log("Contract -> TokenMessenger allowance:", allowance > 0n ? "MAX" : "ZERO");

  // Approve
  const erc20Abi = parseAbi(["function approve(address spender, uint256 amount) returns (bool)"]);
  const approveHash = await walletClient.writeContract({
    address: USDC,
    abi: erc20Abi,
    functionName: "approve",
    args: [testContract, BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff")],
  });
  await publicClient.waitForTransactionReceipt({ hash: approveHash });
  console.log("User approved contract!");

  // Test bridge
  console.log("\nTesting bridge with 0.5 USDC...");
  const bridgeAbi = parseAbi(["function bridge(uint256 amount, bytes32 recipient) external returns (uint64)"]);

  const bridgeHash = await walletClient.writeContract({
    address: testContract,
    abi: bridgeAbi,
    functionName: "bridge",
    args: [500000n, pad(account.address, { size: 32 })],
    gas: 300000n,
  });
  console.log("TX:", bridgeHash);

  const bridgeReceipt = await publicClient.waitForTransactionReceipt({ hash: bridgeHash });
  console.log("Status:", bridgeReceipt.status);
  console.log("Logs:", bridgeReceipt.logs.length);

  // Decode events
  const eventAbi = parseAbi(["event Step(string message)"]);
  for (const log of bridgeReceipt.logs) {
    if (log.address.toLowerCase() === testContract.toLowerCase()) {
      try {
        const decoded = decodeEventLog({ abi: eventAbi, data: log.data, topics: log.topics });
        console.log("Step:", (decoded.args as any).message);
      } catch {}
    }
  }

  if (bridgeReceipt.status === "success") {
    console.log("\n=== SUCCESS! Bridge through contract works! ===");
  }
}

main().catch(console.error);
