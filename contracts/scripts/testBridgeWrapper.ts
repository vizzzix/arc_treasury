import { createWalletClient, createPublicClient, http, parseUnits, pad, keccak256, encodeAbiParameters, parseAbiParameters, decodeEventLog } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

const SEPOLIA_RPC = "https://ethereum-sepolia-rpc.publicnode.com";
const USDC_SEPOLIA = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238" as `0x${string}`;
const BRIDGE_WRAPPER = "0x5e5ccae4751015c0bc7895046ccba81b09734eef" as `0x${string}`;

const ERC20_ABI = [
  { name: "approve", type: "function", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] },
  { name: "allowance", type: "function", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ type: "uint256" }], stateMutability: "view" },
  { name: "balanceOf", type: "function", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }], stateMutability: "view" },
] as const;

const BRIDGE_WRAPPER_ABI = [
  { name: "bridgeToArc", type: "function", inputs: [{ name: "amount", type: "uint256" }, { name: "mintRecipient", type: "bytes32" }], outputs: [] },
  { name: "calculateFee", type: "function", inputs: [{ name: "amount", type: "uint256" }], outputs: [{ name: "fee", type: "uint256" }, { name: "bridgeAmount", type: "uint256" }], stateMutability: "view" },
  { name: "feeBasisPoints", type: "function", inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" },
] as const;

// MessageSent event from CCTP
const MESSAGE_SENT_EVENT = {
  type: "event",
  name: "MessageSent",
  inputs: [{ indexed: false, name: "message", type: "bytes" }],
} as const;

async function main() {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) throw new Error("PRIVATE_KEY required");

  const account = privateKeyToAccount(privateKey as `0x${string}`);
  console.log("Testing with account:", account.address);

  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(SEPOLIA_RPC),
  });

  const walletClient = createWalletClient({
    account,
    chain: sepolia,
    transport: http(SEPOLIA_RPC),
  });

  // Check fee settings
  const feeBP = await publicClient.readContract({
    address: BRIDGE_WRAPPER,
    abi: BRIDGE_WRAPPER_ABI,
    functionName: "feeBasisPoints",
  });
  console.log("Fee basis points:", feeBP, `(${Number(feeBP) / 100}%)`);

  // Check USDC balance
  const balance = await publicClient.readContract({
    address: USDC_SEPOLIA,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [account.address],
  });
  console.log("USDC balance:", Number(balance) / 1e6, "USDC");

  if (balance < 500000n) {
    console.log("Need at least 0.5 USDC to test. Get from https://faucet.circle.com/");
    return;
  }

  // Test amount: 0.5 USDC
  const testAmount = parseUnits("0.5", 6);

  // Calculate fee
  const [fee, bridgeAmount] = await publicClient.readContract({
    address: BRIDGE_WRAPPER,
    abi: BRIDGE_WRAPPER_ABI,
    functionName: "calculateFee",
    args: [testAmount],
  });
  console.log(`\nBridge ${Number(testAmount) / 1e6} USDC:`);
  console.log(`  Fee: ${Number(fee) / 1e6} USDC`);
  console.log(`  Bridge amount: ${Number(bridgeAmount) / 1e6} USDC`);

  // Check allowance
  const allowance = await publicClient.readContract({
    address: USDC_SEPOLIA,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [account.address, BRIDGE_WRAPPER],
  });
  console.log("\nCurrent allowance:", Number(allowance) / 1e6, "USDC");

  // Approve if needed
  if (allowance < testAmount) {
    console.log("Approving USDC...");
    const approveHash = await walletClient.writeContract({
      address: USDC_SEPOLIA,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [BRIDGE_WRAPPER, testAmount * 100n], // Approve extra for future tests
    });
    await publicClient.waitForTransactionReceipt({ hash: approveHash });
    console.log("Approved! TX:", approveHash);
  }

  // Bridge
  console.log("\n=== Initiating Bridge ===");
  const mintRecipient = pad(account.address, { size: 32 });
  console.log("Recipient (bytes32):", mintRecipient);

  const bridgeHash = await walletClient.writeContract({
    address: BRIDGE_WRAPPER,
    abi: BRIDGE_WRAPPER_ABI,
    functionName: "bridgeToArc",
    args: [testAmount, mintRecipient],
    gas: 350000n,
  });
  console.log("Bridge TX:", bridgeHash);
  console.log("Explorer: https://sepolia.etherscan.io/tx/" + bridgeHash);

  const receipt = await publicClient.waitForTransactionReceipt({ hash: bridgeHash });
  console.log("\nStatus:", receipt.status);
  console.log("Gas used:", receipt.gasUsed.toString());

  if (receipt.status !== "success") {
    console.log("❌ Bridge transaction FAILED!");
    return;
  }

  console.log("\n✅ Bridge transaction SUCCESS!");
  console.log("Logs count:", receipt.logs.length);

  // Find MessageSent event to get messageHash
  const MESSAGE_TRANSMITTER = "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275";
  let messageBytes: string | null = null;
  let messageHash: string | null = null;

  for (const log of receipt.logs) {
    if (log.address.toLowerCase() === MESSAGE_TRANSMITTER.toLowerCase()) {
      try {
        const decoded = decodeEventLog({
          abi: [MESSAGE_SENT_EVENT],
          data: log.data,
          topics: log.topics,
        });
        messageBytes = (decoded.args as any).message;
        messageHash = keccak256(messageBytes as `0x${string}`);
        console.log("\n📨 MessageSent found!");
        console.log("Message hash:", messageHash);
        break;
      } catch {}
    }
  }

  if (!messageHash) {
    console.log("⚠️ Could not find MessageSent event");
    return;
  }

  // Poll attestation
  console.log("\n=== Polling for Attestation ===");
  const ATTESTATION_API = "https://iris-api-sandbox.circle.com/v2/messages";

  for (let i = 0; i < 30; i++) {
    console.log(`Attempt ${i + 1}/30...`);

    try {
      const url = `${ATTESTATION_API}/0/${messageHash}`;
      const response = await fetch(url);
      const data = await response.json();

      console.log("Status:", data.status);

      if (data.status === "complete") {
        console.log("\n🎉 ATTESTATION COMPLETE!");
        console.log("Attestation:", data.attestation?.substring(0, 50) + "...");
        console.log("\nNow you can claim on Arc Testnet!");
        return;
      }

      if (data.delayReason) {
        console.log("Delay reason:", data.delayReason);
      }

      // Wait 10 seconds
      await new Promise(r => setTimeout(r, 10000));
    } catch (e) {
      console.log("Error fetching attestation:", e);
      await new Promise(r => setTimeout(r, 10000));
    }
  }

  console.log("\n⚠️ Attestation not received after 5 minutes");
  console.log("This may be due to 'insufficient_fee' - try deploying with maxFee > 0");
}

main().catch(console.error);
