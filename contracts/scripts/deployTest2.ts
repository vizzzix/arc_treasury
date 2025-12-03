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

  console.log("Deploying TestDepositForBurn2...");

  const artifact = await hre.artifacts.readArtifact("TestDepositForBurn2");

  const hash = await walletClient.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode as `0x${string}`,
    args: [USDC, TOKEN_MESSENGER],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  const testContract = receipt.contractAddress!;
  console.log("Deployed to:", testContract);

  // Approve
  const erc20Abi = parseAbi(["function approve(address spender, uint256 amount) returns (bool)"]);
  const approveHash = await walletClient.writeContract({
    address: USDC,
    abi: erc20Abi,
    functionName: "approve",
    args: [testContract, BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff")],
  });
  await publicClient.waitForTransactionReceipt({ hash: approveHash });
  console.log("Approved!");

  // Test
  console.log("\nTesting bridge with 0.5 USDC...");
  const testBridgeAbi = parseAbi(["function testBridge(uint256 amount, bytes32 mintRecipient) external returns (uint64)"]);

  const bridgeHash = await walletClient.writeContract({
    address: testContract,
    abi: testBridgeAbi,
    functionName: "testBridge",
    args: [500000n, pad(account.address, { size: 32 })],
    gas: 500000n,
  });
  console.log("TX:", bridgeHash);

  const bridgeReceipt = await publicClient.waitForTransactionReceipt({ hash: bridgeHash });
  console.log("Status:", bridgeReceipt.status);
  console.log("Logs count:", bridgeReceipt.logs.length);

  // Decode our custom events
  const stepAbi = parseAbi(["event Step(string message)"]);
  const stepValueAbi = parseAbi(["event StepValue(string message, uint256 value)"]);
  const stepErrorAbi = parseAbi(["event StepError(string message, bytes errorData)"]);

  for (const log of bridgeReceipt.logs) {
    if (log.address.toLowerCase() === testContract.toLowerCase()) {
      try {
        const decoded = decodeEventLog({ abi: stepAbi, data: log.data, topics: log.topics });
        console.log("Step:", decoded.args.message);
      } catch {}
      try {
        const decoded = decodeEventLog({ abi: stepValueAbi, data: log.data, topics: log.topics });
        console.log("StepValue:", decoded.args.message, "=", decoded.args.value.toString());
      } catch {}
      try {
        const decoded = decodeEventLog({ abi: stepErrorAbi, data: log.data, topics: log.topics });
        console.log("StepError:", decoded.args.message, "data:", decoded.args.errorData);
      } catch {}
    }
  }
}

main().catch(console.error);
