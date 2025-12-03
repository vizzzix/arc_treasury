import { createPublicClient, http, keccak256, decodeEventLog } from "viem";
import { sepolia } from "viem/chains";

const SEPOLIA_RPC = "https://ethereum-sepolia-rpc.publicnode.com";
const TX_HASH = "0x0617d2b5c48f750422a9f81d75f22a01680db2da94f518f05da20ab0e196debe";

const MESSAGE_SENT_EVENT = {
  type: "event" as const,
  name: "MessageSent",
  inputs: [{ indexed: false, name: "message", type: "bytes" }],
};

async function main() {
  const client = createPublicClient({
    chain: sepolia,
    transport: http(SEPOLIA_RPC),
  });

  const receipt = await client.getTransactionReceipt({ hash: TX_HASH as `0x${string}` });
  console.log("TX Status:", receipt.status);
  console.log("Logs count:", receipt.logs.length);

  for (let i = 0; i < receipt.logs.length; i++) {
    const log = receipt.logs[i];
    console.log(`\nLog ${i}:`);
    console.log("  Address:", log.address);
    console.log("  Topics:", log.topics.length);

    // Check if this is MessageSent
    const MESSAGE_SENT_SIG = keccak256(Buffer.from("MessageSent(bytes)"));
    if (log.topics[0] === MESSAGE_SENT_SIG) {
      console.log("  >>> MessageSent event! <<<");
      try {
        const decoded = decodeEventLog({
          abi: [MESSAGE_SENT_EVENT],
          data: log.data,
          topics: log.topics,
        });
        const message = (decoded.args as any).message;
        const messageHash = keccak256(message);
        console.log("  Message (first 100 chars):", message.substring(0, 100));
        console.log("  Message Hash:", messageHash);

        // Check attestation
        console.log("\n  Checking attestation API...");
        const url = `https://iris-api-sandbox.circle.com/attestations/${messageHash}`;
        const response = await fetch(url);
        const data = await response.json();
        console.log("  API Response:", JSON.stringify(data, null, 2));
      } catch (e) {
        console.log("  Error decoding:", e);
      }
    }
  }
}

main().catch(console.error);
