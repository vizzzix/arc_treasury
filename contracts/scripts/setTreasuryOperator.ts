import { createPublicClient, createWalletClient, http, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import 'dotenv/config';

const arcTestnet = {
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.testnet.arc.network'] },
  },
};

const PROXY_ADDRESS = '0x17ca5232415430bC57F646A72fD15634807bF729' as `0x${string}`;

// New treasury operator address (your wallet that should receive penalties)
const NEW_TREASURY_OPERATOR = '0xB66D4229Bb5A82De94610d63677cF5370e6a81cb' as `0x${string}`;

const abi = parseAbi([
  'function treasuryOperator() view returns (address)',
  'function owner() view returns (address)',
  'function setTreasuryOperator(address newOperator) external',
]);

async function main() {
  const publicClient = createPublicClient({
    chain: arcTestnet,
    transport: http(),
  });

  // Read current treasuryOperator
  console.log('Reading current treasuryOperator...');
  const currentOperator = await publicClient.readContract({
    address: PROXY_ADDRESS,
    abi,
    functionName: 'treasuryOperator',
  });
  console.log('Current treasuryOperator:', currentOperator);

  const owner = await publicClient.readContract({
    address: PROXY_ADDRESS,
    abi,
    functionName: 'owner',
  });
  console.log('Contract owner:', owner);

  if (currentOperator === NEW_TREASURY_OPERATOR) {
    console.log('✅ treasuryOperator already set correctly!');
    return;
  }

  console.log('\n🔄 Setting new treasuryOperator to:', NEW_TREASURY_OPERATOR);

  // Create wallet client
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.log('\n⚠️ To set treasuryOperator, add PRIVATE_KEY to .env and run again');
    return;
  }

  const account = privateKeyToAccount(privateKey as `0x${string}`);
  const walletClient = createWalletClient({
    account,
    chain: arcTestnet,
    transport: http(),
  });

  const hash = await walletClient.writeContract({
    address: PROXY_ADDRESS,
    abi,
    functionName: 'setTreasuryOperator',
    args: [NEW_TREASURY_OPERATOR],
  });

  console.log('Transaction hash:', hash);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log('✅ Done! Status:', receipt.status);
}

main().catch(console.error);
