import { createWalletClient, createPublicClient, http, formatUnits, parseUnits } from "viem";
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

const VAULT_ADDRESS = '0x17ca5232415430bC57F646A72fD15634807bF729' as `0x${string}`;
const USYC = '0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C' as `0x${string}`;

async function main() {
  let operatorKey = process.env.PRIVATE_KEY_OPERATOR;
  if (!operatorKey) {
    throw new Error("PRIVATE_KEY_OPERATOR not set in .env");
  }
  if (!operatorKey.startsWith('0x')) {
    operatorKey = '0x' + operatorKey;
  }

  const account = privateKeyToAccount(operatorKey as `0x${string}`);
  console.log('Operator address:', account.address);

  const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });
  const walletClient = createWalletClient({ account, chain: arcTestnet, transport: http() });

  const vaultAbi = [
    { name: 'totalUSYC', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
    { name: 'totalUSDC', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
    { name: 'recordUSYCConversion', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'usycAmount', type: 'uint256' }], outputs: [] },
  ] as const;

  const usycAbi = [
    { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  ] as const;

  // Check current state
  console.log('\n📊 Current State:');

  const usycBalance = await publicClient.readContract({
    address: USYC, abi: usycAbi, functionName: 'balanceOf', args: [VAULT_ADDRESS]
  });
  console.log('Vault USYC balance (actual):', formatUnits(usycBalance, 6), 'USYC');

  const totalUSYC = await publicClient.readContract({
    address: VAULT_ADDRESS, abi: vaultAbi, functionName: 'totalUSYC'
  }) as bigint;
  console.log('Vault totalUSYC (recorded):', formatUnits(totalUSYC, 6), 'USYC');

  // Calculate how much USYC to record
  const usycToRecord = usycBalance - totalUSYC;

  if (usycToRecord <= 0n) {
    console.log('\n✅ No USYC to record - accounting is up to date');
    return;
  }

  console.log('\n🔄 Recording', formatUnits(usycToRecord, 6), 'USYC in vault accounting...');

  try {
    const hash = await walletClient.writeContract({
      address: VAULT_ADDRESS,
      abi: vaultAbi,
      functionName: 'recordUSYCConversion',
      args: [usycToRecord]
    });

    console.log('Transaction hash:', hash);
    console.log('Waiting for confirmation...');

    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log('✅ Transaction confirmed in block', receipt.blockNumber);

    // Check new state
    const newTotalUSYC = await publicClient.readContract({
      address: VAULT_ADDRESS, abi: vaultAbi, functionName: 'totalUSYC'
    }) as bigint;

    console.log('\n📊 New State:');
    console.log('totalUSYC:', formatUnits(newTotalUSYC, 6), 'USYC');

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
