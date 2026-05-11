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
  { name: "balanceOf", type: "function", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }], stateMutability: "view" },
] as const;

const BRIDGE_ABI = [
  { name: "bridgeToArc", type: "function", inputs: [{ name: "amount", type: "uint256" }, { name: "mintRecipient", type: "bytes32" }], outputs: [] },
  { name: "feeBasisPoints", type: "function", inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" },
  { name: "CCTP_FEE_BPS", type: "function", inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" },
] as const;

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

  // Check USDC balance
  const balance = await publicClient.readContract({
    address: USDC_SEPOLIA,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [account.address],
  });
  console.log("USDC balance:", Number(balance) / 1e6);

  // Deploy BridgeWrapperSepolia V10 (dynamic maxFee)
  console.log("\n=== Deploying BridgeWrapperSepolia V10 (dynamic maxFee) ===");
  const artifact = await hre.artifacts.readArtifact("BridgeWrapperSepolia");

  const deployHash = await walletClient.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode as `0x${string}`,
    args: [USDC_SEPOLIA, TOKEN_MESSENGER, TOKEN_MINTER, 5n], // 0.05% wrapper fee
  });

  const deployReceipt = await publicClient.waitForTransactionReceipt({ hash: deployHash });
  const contractAddress = deployReceipt.contractAddress!;
  console.log("✅ Deployed V10 to:", contractAddress);

  // Check constants
  const wrapperFee = await publicClient.readContract({
    address: contractAddress,
    abi: BRIDGE_ABI,
    functionName: "feeBasisPoints",
  });
  console.log("Wrapper fee basis points:", wrapperFee, `(${Number(wrapperFee) / 100}%)`);

  const cctpFeeBps = await publicClient.readContract({
    address: contractAddress,
    abi: BRIDGE_ABI,
    functionName: "CCTP_FEE_BPS",
  });
  console.log("CCTP fee basis points:", cctpFeeBps, `(${Number(cctpFeeBps) / 100}%)`);

  // Test with multiple amounts
  const testAmounts = ["0.5", "5", "22"];

  for (const amountStr of testAmounts) {
    if (Number(balance) / 1e6 < parseFloat(amountStr)) {
      console.log(`\n⚠️ Skipping ${amountStr} USDC test - insufficient balance`);
      continue;
    }

    const testAmount = parseUnits(amountStr, 6);
    console.log(`\n=== Testing bridge with ${amountStr} USDC ===`);

    // Calculate expected maxFee (matching contract logic)
    const wrapperFeeAmt = (testAmount * wrapperFee) / 10000n;
    const bridgeAmount = testAmount - wrapperFeeAmt;
    const baseFee = (bridgeAmount * cctpFeeBps + 9999n) / 10000n;
    let expectedMaxFee = baseFee + baseFee / 10n;
    if (expectedMaxFee < 100n) expectedMaxFee = 100n;
    console.log("Bridge amount:", Number(bridgeAmount) / 1e6, "USDC");
    console.log("Expected maxFee:", Number(expectedMaxFee), `(${Number(expectedMaxFee) / 1e6} USDC)`);

    // Approve USDC
    console.log("Approving USDC...");
    const approveHash = await walletClient.writeContract({
      address: USDC_SEPOLIA,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [contractAddress, testAmount],
    });
    await publicClient.waitForTransactionReceipt({ hash: approveHash });

    // Bridge
    console.log("Bridging...");
    const mintRecipient = pad(account.address, { size: 32 });
    const bridgeHash = await walletClient.writeContract({
      address: contractAddress,
      abi: BRIDGE_ABI,
      functionName: "bridgeToArc",
      args: [testAmount, mintRecipient],
      gas: 400000n,
    });
    console.log("Bridge TX:", bridgeHash);
    console.log("Explorer: https://sepolia.etherscan.io/tx/" + bridgeHash);

    const receipt = await publicClient.waitForTransactionReceipt({ hash: bridgeHash });
    console.log("TX Status:", receipt.status);

    if (receipt.status !== "success") {
      console.log("❌ Bridge FAILED!");
      continue;
    }

    // Poll attestation
    console.log("\n=== Polling Attestation ===");
    for (let i = 0; i < 20; i++) {
      console.log(`Attempt ${i + 1}/20...`);

      try {
        const url = `https://iris-api-sandbox.circle.com/v2/messages/0?transactionHash=${bridgeHash}`;
        const response = await fetch(url);
        const data = await response.json();

        console.log("Status:", data.messages?.[0]?.status || "pending");

        if (data.messages?.[0]?.status === "complete") {
          console.log(`\n🎉 ${amountStr} USDC - ATTESTATION COMPLETE!`);
          console.log("Attestation:", data.messages[0].attestation?.substring(0, 50) + "...");
          break;
        }

        if (data.messages?.[0]?.delayReason) {
          console.log("⚠️ Delay reason:", data.messages[0].delayReason);
          if (data.messages[0].delayReason === "insufficient_fee") {
            console.log("\n❌ INSUFFICIENT FEE - dynamic maxFee calculation failed!");
            break;
          }
        }

        await new Promise(r => setTimeout(r, 10000));
      } catch (e) {
        console.log("Error polling:", e);
        await new Promise(r => setTimeout(r, 10000));
      }
    }

    // Only test first amount to save gas
    console.log("\n📋 UPDATE constants.ts with:");
    console.log(`BridgeWrapperSepolia: '${contractAddress.toLowerCase()}' as \`0x\${string}\`,`);
    break;
  }
}

main().catch(console.error);
