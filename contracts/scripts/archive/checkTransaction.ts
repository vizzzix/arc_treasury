import hre from "hardhat";
import { createPublicClient, http } from "viem";
import { defineChain } from "viem";

const arcTestnet = defineChain({
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'Ethereum', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.testnet.arc.network'] },
  },
  blockExplorers: {
    default: { name: 'Arc Explorer', url: 'https://testnet.arcscan.app' },
  },
  testnet: true,
});

async function main() {
  // Get tx hash from command line or use default
  const args = process.argv.slice(2);
  const txHash = args[0] || "0x4cb030aa202748d22920d45ca92e1029a6eab9af56ae06d2a51dd92759cd9187";
  
  console.log(`Checking transaction: ${txHash}`);
  console.log(`Explorer: https://testnet.arcscan.app/tx/${txHash}\n`);

  const publicClient = createPublicClient({
    chain: arcTestnet,
    transport: http('https://rpc.testnet.arc.network'),
  });

  try {
    const receipt = await publicClient.getTransactionReceipt({ hash: txHash as `0x${string}` });
    
    console.log("=== Transaction Receipt ===");
    console.log(`Status: ${receipt.status === 'success' ? '✅ Success' : '❌ Failed'}`);
    console.log(`Block Number: ${receipt.blockNumber}`);
    console.log(`From: ${receipt.from}`);
    console.log(`To: ${receipt.to || 'Contract Creation'}`);
    console.log(`Gas Used: ${receipt.gasUsed.toString()}`);
    console.log(`Transaction Index: ${receipt.transactionIndex}`);
    
    if (receipt.logs.length > 0) {
      console.log(`\n=== Events (${receipt.logs.length}) ===`);
      receipt.logs.forEach((log, i) => {
        console.log(`\nEvent ${i + 1}:`);
        console.log(`  Address: ${log.address}`);
        console.log(`  Topics: ${log.topics.length}`);
        log.topics.forEach((topic, j) => {
          console.log(`    [${j}]: ${topic}`);
        });
        if (log.data && log.data !== '0x') {
          console.log(`  Data: ${log.data.slice(0, 66)}...`);
        }
      });
    }

    // Try to decode if it's a TreasuryVault transaction
    const treasuryVaultAddress = "0x98393791dc9f8961dd296441f3d1b083d3e92d20";
    if (receipt.to?.toLowerCase() === treasuryVaultAddress.toLowerCase()) {
      console.log(`\n=== TreasuryVault Transaction Detected ===`);
      console.log("This appears to be a transaction to TreasuryVault contract");
    }

  } catch (error: any) {
    console.error("Error fetching transaction:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
