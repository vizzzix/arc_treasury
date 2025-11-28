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
  console.log('\n📦 Deploying TreasuryVaultV11 implementation...');

  const V11Artifact = JSON.parse(
    readFileSync(path.join(__dirname, '../artifacts/contracts/TreasuryVaultV11.sol/TreasuryVaultV11.json'), 'utf-8')
  );

  const deployHash = await walletClient.deployContract({
    abi: V11Artifact.abi,
    bytecode: V11Artifact.bytecode as `0x${string}`,
  });

  console.log('Deploy tx:', deployHash);
  const deployReceipt = await publicClient.waitForTransactionReceipt({ hash: deployHash });
  const newImplementation = deployReceipt.contractAddress!;
  console.log('✅ V11 implementation deployed at:', newImplementation);

  // Upgrade proxy
  console.log('\n🔄 Upgrading proxy to V11...');

  const upgradeHash = await walletClient.writeContract({
    address: VAULT_PROXY,
    abi: parseAbi(['function upgradeToAndCall(address newImplementation, bytes memory data) external']),
    functionName: 'upgradeToAndCall',
    args: [newImplementation, '0x']
  });

  console.log('Upgrade tx:', upgradeHash);
  const upgradeReceipt = await publicClient.waitForTransactionReceipt({ hash: upgradeHash });
  console.log('✅ Upgraded in block', upgradeReceipt.blockNumber);

  console.log('\n🎉 Upgrade to V11 complete!');
  console.log('New implementation:', newImplementation);
  console.log('\nNow run: npx tsx scripts/autoMintUSYC.ts');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });


