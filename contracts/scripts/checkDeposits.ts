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

const TREASURY_VAULT_ADDRESS = "0x786570404eabef33fdede4996bbaa3512bdf4cbd" as `0x${string}`;

// Deposit event signature: Deposit(address indexed user, uint256 amount, uint256 shares)
const DEPOSIT_EVENT_TOPIC = "0xa05f39e6d8d4e060324edb900f0f5909de621fd93f19ccf65ba74e5965c98c36";

async function main() {
  console.log(`Checking deposits for TreasuryVault: ${TREASURY_VAULT_ADDRESS}\n`);

  const publicClient = createPublicClient({
    chain: arcTestnet,
    transport: http('https://rpc.testnet.arc.network'),
  });

  try {
    // Get current block
    const currentBlock = await publicClient.getBlockNumber();
    console.log(`Current block: ${currentBlock}`);
    
    // Get logs for Deposit events (check last 10000 blocks)
    const fromBlock = currentBlock - 10000n;
    
    const logs = await publicClient.getLogs({
      address: TREASURY_VAULT_ADDRESS,
      event: {
        type: 'event',
        name: 'Deposit',
        inputs: [
          { indexed: true, name: 'user', type: 'address' },
          { indexed: false, name: 'amount', type: 'uint256' },
          { indexed: false, name: 'shares', type: 'uint256' },
        ],
      },
      fromBlock,
      toBlock: currentBlock,
    });

    console.log(`\n=== Deposit Events (${logs.length}) ===\n`);
    
    if (logs.length === 0) {
      console.log("No deposit events found in the last 10000 blocks.");
    } else {
      for (let i = 0; i < logs.length; i++) {
        const log = logs[i];
        const user = `0x${log.topics[1]?.slice(-40)}` as `0x${string}`;
        
        // Decode amount and shares from data
        const data = log.data;
        const amount = BigInt(data.slice(2, 66));
        const shares = BigInt(`0x${data.slice(66, 130)}`);
        
        const amountUSDC = Number(amount) / 1e18; // Convert from 18 decimals
        const sharesFormatted = Number(shares) / 1e18;
        
        console.log(`Deposit ${i + 1}:`);
        console.log(`  User: ${user}`);
        console.log(`  Amount: ${amountUSDC.toFixed(6)} USDC`);
        console.log(`  Shares: ${sharesFormatted.toFixed(6)}`);
        console.log(`  Block: ${log.blockNumber}`);
        console.log(`  Transaction: https://testnet.arcscan.app/tx/${log.transactionHash}`);
        console.log('');
      }
    }

    // Also check totalUSDC directly
    const totalUSDC = await publicClient.readContract({
      address: TREASURY_VAULT_ADDRESS,
      abi: [{
        inputs: [],
        name: 'totalUSDC',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
      }],
      functionName: 'totalUSDC',
    });

    const totalUSDCFormatted = Number(totalUSDC) / 1e18;
    console.log(`\n=== Current Total USDC in Pool ===`);
    console.log(`Total USDC: ${totalUSDCFormatted.toFixed(6)} USDC`);
    console.log(`Raw value: ${totalUSDC.toString()}`);

  } catch (error: any) {
    console.error("Error:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });


