import { createWalletClient, createPublicClient, http, parseAbi, formatUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import * as dotenv from "dotenv";
import * as path from "path";
import { fileURLToPath } from "url";

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

const vaultAbi = parseAbi([
  'function accrueYield() external returns (uint256)',
  'function getPendingYield() external view returns (uint256)',
  'function getYieldReserve() external view returns (uint256)',
  'function getTotalPoolValue() external view returns (uint256)',
  'function lastYieldAccrual() external view returns (uint256)',
  'function yieldAPYBps() external view returns (uint256)',
]);

async function main() {
  let ownerKey = process.env.PRIVATE_KEY;
  if (!ownerKey) {
    throw new Error("PRIVATE_KEY not set in .env");
  }
  if (!ownerKey.startsWith('0x')) {
    ownerKey = '0x' + ownerKey;
  }

  const account = privateKeyToAccount(ownerKey as `0x${string}`);
  const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });
  const walletClient = createWalletClient({ account, chain: arcTestnet, transport: http() });

  console.log('=== Yield Accrual Status ===\n');

  // Get current state
  const [pendingYield, reserve, poolValue, lastAccrual, apyBps] = await Promise.all([
    publicClient.readContract({ address: VAULT_PROXY, abi: vaultAbi, functionName: 'getPendingYield' }),
    publicClient.readContract({ address: VAULT_PROXY, abi: vaultAbi, functionName: 'getYieldReserve' }),
    publicClient.readContract({ address: VAULT_PROXY, abi: vaultAbi, functionName: 'getTotalPoolValue' }),
    publicClient.readContract({ address: VAULT_PROXY, abi: vaultAbi, functionName: 'lastYieldAccrual' }),
    publicClient.readContract({ address: VAULT_PROXY, abi: vaultAbi, functionName: 'yieldAPYBps' }),
  ]);

  const lastAccrualDate = new Date(Number(lastAccrual) * 1000);
  const hoursSinceAccrual = (Date.now() - lastAccrualDate.getTime()) / (1000 * 60 * 60);

  console.log(`APY: ${Number(apyBps) / 100}%`);
  console.log(`Pool Value: ${formatUnits(poolValue, 6)} USDC`);
  console.log(`Reserve: ${formatUnits(reserve, 18)} USDC`);
  console.log(`Last Accrual: ${lastAccrualDate.toISOString()} (${hoursSinceAccrual.toFixed(1)}h ago)`);
  console.log(`Pending Yield: ${formatUnits(pendingYield, 6)} USDC`);

  if (pendingYield === 0n) {
    console.log('\n⏳ No yield to accrue yet');
    return;
  }

  // Check if we have enough reserve
  const pendingNative = pendingYield * BigInt(1e12); // Convert to 18 decimals
  if (reserve < pendingNative) {
    console.log('\n⚠️ Insufficient reserve for yield payment!');
    console.log(`Need: ${formatUnits(pendingNative, 18)} USDC`);
    console.log(`Have: ${formatUnits(reserve, 18)} USDC`);
    return;
  }

  // Accrue yield
  console.log('\n📈 Accruing yield...');

  const hash = await walletClient.writeContract({
    address: VAULT_PROXY,
    abi: vaultAbi,
    functionName: 'accrueYield',
  });

  console.log('Tx:', hash);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  // Get new pool value
  const newPoolValue = await publicClient.readContract({
    address: VAULT_PROXY,
    abi: vaultAbi,
    functionName: 'getTotalPoolValue',
  });

  console.log(`\n✅ Yield accrued!`);
  console.log(`Old Pool Value: ${formatUnits(poolValue, 6)} USDC`);
  console.log(`New Pool Value: ${formatUnits(newPoolValue, 6)} USDC`);
  console.log(`Yield Added: ${formatUnits(pendingYield, 6)} USDC`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
