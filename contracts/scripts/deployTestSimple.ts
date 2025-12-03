import { createWalletClient, createPublicClient, http, parseAbi, decodeEventLog } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import hre from "hardhat";

const SEPOLIA_RPC = "https://ethereum-sepolia-rpc.publicnode.com";
const USDC = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238" as `0x${string}`;

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

  console.log("Deploying TestSimple...");
  const artifact = await hre.artifacts.readArtifact("TestSimple");

  const hash = await walletClient.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode as `0x${string}`,
    args: [USDC],
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

  // Test simple transfer
  console.log("\nTesting simple transfer...");
  const testAbi = parseAbi(["function testTransfer(uint256 amount) external"]);

  const testHash = await walletClient.writeContract({
    address: testContract,
    abi: testAbi,
    functionName: "testTransfer",
    args: [100000n], // 0.1 USDC
  });
  console.log("TX:", testHash);

  const testReceipt = await publicClient.waitForTransactionReceipt({ hash: testHash });
  console.log("Status:", testReceipt.status);
  console.log("Logs:", testReceipt.logs.length);

  // Decode events
  const eventAbi = parseAbi(["event TestEvent(string message, uint256 value)"]);
  for (const log of testReceipt.logs) {
    if (log.address.toLowerCase() === testContract.toLowerCase()) {
      try {
        const decoded = decodeEventLog({ abi: eventAbi, data: log.data, topics: log.topics });
        console.log("Event:", (decoded.args as any).message, "=", (decoded.args as any).value.toString());
      } catch {}
    }
  }
}

main().catch(console.error);
