import { createWalletClient, createPublicClient, http, parseUnits, pad, keccak256, decodeEventLog } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import hre from "hardhat";

const SEPOLIA_RPC = "https://ethereum-sepolia-rpc.publicnode.com";
const USDC_SEPOLIA = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238" as `0x${string}`;
const TOKEN_MESSENGER = "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA" as `0x${string}`;
const TOKEN_MINTER = "0xb43db544E2c27092c107639Ad201b3dEfAbcF192" as `0x${string}`;

const ERC20_ABI = [
  { name: "approve", type: "function", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] },
] as const;

const BRIDGE_ABI = [
  { name: "bridgeToArc", type: "function", inputs: [{ name: "amount", type: "uint256" }, { name: "mintRecipient", type: "bytes32" }], outputs: [] },
  { name: "feeBasisPoints", type: "function", inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" },
] as const;

const MESSAGE_SENT_EVENT = {
  type: "event" as const,
  name: "MessageSent",
  inputs: [{ indexed: false, name: "message", type: "bytes" }],
};

async function main() {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) throw new Error("PRIVATE_KEY required");

  const account = privateKeyToAccount(privateKey as `0x${string}`);
  console.log("Account:", account.address);

  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(SEPOLIA_RPC),
  });

  const walletClient = createWalletClient({
    account,
    chain: sepolia,
    transport: http(SEPOLIA_RPC),
  });

  // Deploy BridgeWrapperSepolia V8 (with maxFee = 1000)
  console.log("\n=== Deploying BridgeWrapperSepolia V8 (maxFee=1000) ===");
  const artifact = await hre.artifacts.readArtifact("BridgeWrapperSepolia");

  const deployHash = await walletClient.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode as `0x${string}`,
    args: [USDC_SEPOLIA, TOKEN_MESSENGER, TOKEN_MINTER, 5n], // 0.05% fee
  });

  const deployReceipt = await publicClient.waitForTransactionReceipt({ hash: deployHash });
  const contractAddress = deployReceipt.contractAddress!;
  console.log("✅ Deployed V8 to:", contractAddress);

  // Check fee
  const feeBP = await publicClient.readContract({
    address: contractAddress,
    abi: BRIDGE_ABI,
    functionName: "feeBasisPoints",
  });
  console.log("Fee basis points:", feeBP, `(${Number(feeBP) / 100}%)`);

  // Approve USDC
  console.log("\n=== Approving USDC ===");
  const testAmount = parseUnits("0.5", 6);

  const approveHash = await walletClient.writeContract({
    address: USDC_SEPOLIA,
    abi: ERC20_ABI,
    functionName: "approve",
    args: [contractAddress, testAmount * 10n],
  });
  await publicClient.waitForTransactionReceipt({ hash: approveHash });
  console.log("Approved!");

  // Bridge
  console.log("\n=== Bridging 0.5 USDC via V8 (maxFee=1000) ===");
  const mintRecipient = pad(account.address, { size: 32 });

  const bridgeHash = await walletClient.writeContract({
    address: contractAddress,
    abi: BRIDGE_ABI,
    functionName: "bridgeToArc",
    args: [testAmount, mintRecipient],
    gas: 350000n,
  });
  console.log("Bridge TX:", bridgeHash);
  console.log("Explorer: https://sepolia.etherscan.io/tx/" + bridgeHash);

  const receipt = await publicClient.waitForTransactionReceipt({ hash: bridgeHash });
  console.log("Status:", receipt.status);

  if (receipt.status !== "success") {
    console.log("❌ Bridge FAILED!");
    return;
  }

  console.log("✅ Bridge SUCCESS!");

  // Find message hash
  const MESSAGE_TRANSMITTER = "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275";
  const MESSAGE_SENT_SIG = keccak256(Buffer.from("MessageSent(bytes)"));

  for (const log of receipt.logs) {
    if (log.address.toLowerCase() === MESSAGE_TRANSMITTER.toLowerCase() && log.topics[0] === MESSAGE_SENT_SIG) {
      const decoded = decodeEventLog({
        abi: [MESSAGE_SENT_EVENT],
        data: log.data,
        topics: log.topics,
      });
      const message = (decoded.args as any).message;
      const messageHash = keccak256(message);
      console.log("\nMessage Hash:", messageHash);
      break;
    }
  }

  // Poll attestation by TX hash (V2 format)
  console.log("\n=== Polling Attestation (by TX hash) ===");
  for (let i = 0; i < 30; i++) {
    console.log(`Attempt ${i + 1}/30...`);

    try {
      const url = `https://iris-api-sandbox.circle.com/v2/messages/0?transactionHash=${bridgeHash}`;
      const response = await fetch(url);
      const data = await response.json();

      console.log("Status:", data.messages?.[0]?.status || "unknown");

      if (data.messages?.[0]?.status === "complete") {
        console.log("\n🎉 ATTESTATION COMPLETE!");
        console.log("Attestation:", data.messages[0].attestation?.substring(0, 50) + "...");
        console.log("\n📋 UPDATE constants.ts with:");
        console.log(`BridgeWrapperSepolia: '${contractAddress.toLowerCase()}' as \`0x\${string}\`,`);
        return;
      }

      if (data.messages?.[0]?.delayReason) {
        console.log("Delay reason:", data.messages[0].delayReason);
      }

      await new Promise(r => setTimeout(r, 10000));
    } catch (e) {
      console.log("Error:", e);
      await new Promise(r => setTimeout(r, 10000));
    }
  }

  console.log("\n⚠️ Attestation not complete after 5 minutes");
  console.log("Contract deployed at:", contractAddress);
}

main().catch(console.error);
