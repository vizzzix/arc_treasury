import { createWalletClient, createPublicClient, http, parseAbi, formatUnits } from "viem";
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

async function main() {
  console.log('=== Upgrade TreasuryVault to fix withdraw bug ===\n');

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

  // Check current state
  console.log('\n--- Current State ---');

  const totalUSDC = await publicClient.readContract({
    address: VAULT_PROXY,
    abi: parseAbi(['function totalUSDC() view returns (uint256)']),
    functionName: 'totalUSDC',
  });
  console.log('totalUSDC:', formatUnits(totalUSDC, 18), 'USDC');

  const totalUSYC = await publicClient.readContract({
    address: VAULT_PROXY,
    abi: parseAbi(['function totalUSYC() view returns (uint256)']),
    functionName: 'totalUSYC',
  });
  console.log('totalUSYC:', formatUnits(totalUSYC, 6), 'USYC');

  const totalShares = await publicClient.readContract({
    address: VAULT_PROXY,
    abi: parseAbi(['function totalShares() view returns (uint256)']),
    functionName: 'totalShares',
  });
  console.log('totalShares:', formatUnits(totalShares, 18), 'shares');

  const pricePerShare = await publicClient.readContract({
    address: VAULT_PROXY,
    abi: parseAbi(['function getPricePerShare() view returns (uint256)']),
    functionName: 'getPricePerShare',
  });
  console.log('pricePerShare:', formatUnits(pricePerShare, 18));

  // Get current implementation
  const implSlot = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';
  const currentImpl = await publicClient.getStorageAt({ address: VAULT_PROXY, slot: implSlot as `0x${string}` });
  console.log('\nCurrent implementation:', '0x' + currentImpl!.slice(26));

  // Deploy new implementation
  console.log('\n📦 Deploying new TreasuryVault implementation...');

  // Use V11 which is upgrade-safe (no constructor args, uses initializer)
  const artifact = JSON.parse(
    readFileSync(path.join(__dirname, '../artifacts/contracts/TreasuryVaultV11.sol/TreasuryVaultV11.json'), 'utf-8')
  );

  const deployHash = await walletClient.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode as `0x${string}`,
  });

  console.log('Deploy tx:', deployHash);
  const deployReceipt = await publicClient.waitForTransactionReceipt({ hash: deployHash });

  if (deployReceipt.status !== 'success') {
    throw new Error('Deploy failed!');
  }

  const newImplementation = deployReceipt.contractAddress!;
  console.log('✅ New implementation deployed at:', newImplementation);

  // Upgrade proxy
  console.log('\n🔄 Upgrading proxy...');

  const upgradeHash = await walletClient.writeContract({
    address: VAULT_PROXY,
    abi: parseAbi(['function upgradeToAndCall(address newImplementation, bytes memory data) external']),
    functionName: 'upgradeToAndCall',
    args: [newImplementation, '0x']
  });

  console.log('Upgrade tx:', upgradeHash);
  const upgradeReceipt = await publicClient.waitForTransactionReceipt({ hash: upgradeHash });

  if (upgradeReceipt.status !== 'success') {
    throw new Error('Upgrade failed!');
  }

  console.log('✅ Upgraded in block', upgradeReceipt.blockNumber);

  // Verify new implementation
  const newImpl = await publicClient.getStorageAt({ address: VAULT_PROXY, slot: implSlot as `0x${string}` });
  console.log('\nNew implementation:', '0x' + newImpl!.slice(26));

  // Check state is preserved
  console.log('\n--- State After Upgrade ---');

  const newTotalUSDC = await publicClient.readContract({
    address: VAULT_PROXY,
    abi: parseAbi(['function totalUSDC() view returns (uint256)']),
    functionName: 'totalUSDC',
  });
  console.log('totalUSDC:', formatUnits(newTotalUSDC, 18), 'USDC');

  const newTotalUSYC = await publicClient.readContract({
    address: VAULT_PROXY,
    abi: parseAbi(['function totalUSYC() view returns (uint256)']),
    functionName: 'totalUSYC',
  });
  console.log('totalUSYC:', formatUnits(newTotalUSYC, 6), 'USYC');

  const newTotalShares = await publicClient.readContract({
    address: VAULT_PROXY,
    abi: parseAbi(['function totalShares() view returns (uint256)']),
    functionName: 'totalShares',
  });
  console.log('totalShares:', formatUnits(newTotalShares, 18), 'shares');

  const newPricePerShare = await publicClient.readContract({
    address: VAULT_PROXY,
    abi: parseAbi(['function getPricePerShare() view returns (uint256)']),
    functionName: 'getPricePerShare',
  });
  console.log('pricePerShare:', formatUnits(newPricePerShare, 18));

  // Verify state preserved
  if (totalUSDC !== newTotalUSDC || totalUSYC !== newTotalUSYC || totalShares !== newTotalShares) {
    console.error('\n⚠️ WARNING: State mismatch after upgrade!');
  } else {
    console.log('\n✅ State preserved correctly!');
  }

  console.log('\n🎉 Upgrade complete!');
  console.log('New implementation:', newImplementation);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
