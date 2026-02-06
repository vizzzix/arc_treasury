import { createWalletClient, createPublicClient, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import * as dotenv from "dotenv";
import * as path from "path";
import { fileURLToPath } from "url";
import { readFileSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const arcTestnet = {
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.testnet.arc.network'] } },
} as const;

const VAULT_PROXY = '0x17ca5232415430bC57F646A72fD15634807bF729' as `0x${string}`;

// Users with bloated activeDeposits arrays that need cleanup
const USERS_TO_CLEANUP: `0x${string}`[] = [
  '0x36f96C51FF953C81c7b9A1e7b3C895671bb66f32',
];

async function main() {
  let ownerKey = process.env.PRIVATE_KEY;
  if (!ownerKey) {
    throw new Error("PRIVATE_KEY not set in .env");
  }
  if (!ownerKey.startsWith('0x')) {
    ownerKey = '0x' + ownerKey;
  }

  const account = privateKeyToAccount(ownerKey as `0x${string}`);
  console.log('Owner address:', account.address);

  const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });
  const walletClient = createWalletClient({ account, chain: arcTestnet, transport: http() });

  // Deploy new implementation
  console.log('\n Deploying TreasuryVaultV14 implementation...');

  const V14Artifact = JSON.parse(
    readFileSync(path.join(__dirname, '../artifacts/contracts/TreasuryVaultV14.sol/TreasuryVaultV14.json'), 'utf-8')
  );

  const deployHash = await walletClient.deployContract({
    abi: V14Artifact.abi,
    bytecode: V14Artifact.bytecode as `0x${string}`,
  });

  console.log('Deploy tx:', deployHash);
  const deployReceipt = await publicClient.waitForTransactionReceipt({ hash: deployHash });
  const newImplementation = deployReceipt.contractAddress!;
  console.log('V14 implementation deployed at:', newImplementation);

  // Upgrade proxy
  console.log('\n Upgrading proxy to V14...');

  const upgradeHash = await walletClient.writeContract({
    address: VAULT_PROXY,
    abi: parseAbi(['function upgradeToAndCall(address newImplementation, bytes memory data) external']),
    functionName: 'upgradeToAndCall',
    args: [newImplementation, '0x']
  });

  console.log('Upgrade tx:', upgradeHash);
  const upgradeReceipt = await publicClient.waitForTransactionReceipt({ hash: upgradeHash });
  console.log('Upgraded in block', upgradeReceipt.blockNumber);

  // Cleanup bloated activeDeposits arrays
  console.log('\n Cleaning up bloated activeDeposits for', USERS_TO_CLEANUP.length, 'users...');

  const cleanupHash = await walletClient.writeContract({
    address: VAULT_PROXY,
    abi: parseAbi(['function cleanupActiveDepositsBatch(address[] calldata users) external']),
    functionName: 'cleanupActiveDepositsBatch',
    args: [USERS_TO_CLEANUP],
  });

  console.log('Cleanup tx:', cleanupHash);
  const cleanupReceipt = await publicClient.waitForTransactionReceipt({ hash: cleanupHash });
  console.log('Cleanup done in block', cleanupReceipt.blockNumber);

  console.log('\n Upgrade to V14 complete!');
  console.log('New implementation:', newImplementation);
  console.log('Gas optimization: activeDeposits arrays cleaned up');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
