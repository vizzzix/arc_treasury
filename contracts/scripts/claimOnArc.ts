import { createWalletClient, createPublicClient, http, defineChain } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const ARC_RPC = "https://rpc-testnet.arcplatform.io";
const MESSAGE_TRANSMITTER = "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275" as `0x${string}`;

// TX hash from V8 bridge test
const BURN_TX_HASH = "0x331c66deb997e0c9c6c2574ac3c488e1145b23ab19769ca70e2d285fdea32dbf";

const arcTestnet = defineChain({
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: [ARC_RPC] },
  },
});

const MESSAGE_TRANSMITTER_ABI = [
  {
    name: 'receiveMessage',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'message', type: 'bytes' },
      { name: 'attestation', type: 'bytes' }
    ],
    outputs: [{ name: 'success', type: 'bool' }]
  }
] as const;

async function main() {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) throw new Error("PRIVATE_KEY required");

  const account = privateKeyToAccount(privateKey as `0x${string}`);
  console.log("Account:", account.address);

  // Fetch attestation data from Circle API
  console.log("\n=== Fetching attestation for TX:", BURN_TX_HASH, "===");

  const url = `https://iris-api-sandbox.circle.com/v2/messages/0?transactionHash=${BURN_TX_HASH}`;
  const response = await fetch(url);
  const data = await response.json();

  console.log("Status:", data.messages?.[0]?.status);

  if (data.messages?.[0]?.status !== "complete") {
    console.log("❌ Attestation not complete yet!");
    console.log("Full response:", JSON.stringify(data, null, 2));
    return;
  }

  const message = data.messages[0].message;
  const attestation = data.messages[0].attestation;

  console.log("✅ Got message:", message.substring(0, 50) + "...");
  console.log("✅ Got attestation:", attestation.substring(0, 50) + "...");

  // Create clients for Arc
  const publicClient = createPublicClient({
    chain: arcTestnet,
    transport: http(ARC_RPC),
  });

  const walletClient = createWalletClient({
    account,
    chain: arcTestnet,
    transport: http(ARC_RPC),
  });

  // Check USDC balance before
  const USDC_ARC = "0x3600000000000000000000000000000000000000" as `0x${string}`;
  const balanceBefore = await publicClient.getBalance({ address: account.address });
  console.log("\nUSDC balance before (native):", Number(balanceBefore) / 1e18);

  // Call receiveMessage
  console.log("\n=== Calling receiveMessage on Arc ===");

  try {
    const hash = await walletClient.writeContract({
      address: MESSAGE_TRANSMITTER,
      abi: MESSAGE_TRANSMITTER_ABI,
      functionName: 'receiveMessage',
      args: [message as `0x${string}`, attestation as `0x${string}`],
      gas: 500000n,
    });

    console.log("TX Hash:", hash);
    console.log("Explorer: https://testnet.arcscan.app/tx/" + hash);

    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log("Status:", receipt.status);

    if (receipt.status === "success") {
      console.log("\n🎉 CLAIM SUCCESS!");

      // Check balance after
      const balanceAfter = await publicClient.getBalance({ address: account.address });
      console.log("USDC balance after (native):", Number(balanceAfter) / 1e18);
      console.log("Received:", (Number(balanceAfter) - Number(balanceBefore)) / 1e18, "USDC");
    } else {
      console.log("❌ Claim failed!");
    }
  } catch (e: any) {
    if (e.message?.includes("Nonce already used") || e.message?.includes("already received")) {
      console.log("✅ Already claimed! (nonce used)");
    } else {
      console.log("Error:", e.message);
    }
  }
}

main().catch(console.error);
