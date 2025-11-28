import { createWalletClient, createPublicClient, http, parseUnits, formatUnits } from "viem";
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

const USYC = '0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C' as `0x${string}`;
const NEW_VAULT = '0x17ca5232415430bC57F646A72fD15634807bF729' as `0x${string}`;

const usycAbi = [
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'transfer', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
] as const;

async function main() {
  let operatorKey = process.env.PRIVATE_KEY_OPERATOR;
  if (!operatorKey) {
    throw new Error("PRIVATE_KEY_OPERATOR not set in .env");
  }

  // Ensure 0x prefix
  if (!operatorKey.startsWith('0x')) {
    operatorKey = '0x' + operatorKey;
  }

  const account = privateKeyToAccount(operatorKey as `0x${string}`);
  console.log('Operator address:', account.address);

  const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });
  const walletClient = createWalletClient({ account, chain: arcTestnet, transport: http() });

  // Check current balances
  const opBalance = await publicClient.readContract({
    address: USYC, abi: usycAbi, functionName: 'balanceOf', args: [account.address]
  });
  const vaultBalance = await publicClient.readContract({
    address: USYC, abi: usycAbi, functionName: 'balanceOf', args: [NEW_VAULT]
  });

  console.log('\nCurrent Balances:');
  console.log('Operator USYC:', formatUnits(opBalance, 6));
  console.log('Vault V4 USYC:', formatUnits(vaultBalance, 6));

  if (opBalance === 0n) {
    console.log('\n❌ Operator has no USYC to transfer');
    return;
  }

  // Transfer 1 USYC to test whitelist
  const amountToTransfer = parseUnits('1', 6); // 1 USYC
  console.log('\n🔄 Transferring 1 USYC to Vault (test whitelist)...');

  try {
    const hash = await walletClient.writeContract({
      address: USYC,
      abi: usycAbi,
      functionName: 'transfer',
      args: [NEW_VAULT, amountToTransfer]
    });

    console.log('Transaction hash:', hash);
    console.log('Waiting for confirmation...');

    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log('✅ Transaction confirmed in block', receipt.blockNumber);

    // Check new balances
    const newOpBalance = await publicClient.readContract({
      address: USYC, abi: usycAbi, functionName: 'balanceOf', args: [account.address]
    });
    const newVaultBalance = await publicClient.readContract({
      address: USYC, abi: usycAbi, functionName: 'balanceOf', args: [NEW_VAULT]
    });

    console.log('\nNew Balances:');
    console.log('Operator USYC:', formatUnits(newOpBalance, 6));
    console.log('Vault V4 USYC:', formatUnits(newVaultBalance, 6));

    console.log('\n✅ SUCCESS! Vault can receive USYC via transfer!');
    console.log('Next step: Call recordUSYCConversion() on vault to update accounting.');

  } catch (error: any) {
    console.error('\n❌ Transfer failed:', error.message);
    if (error.message.includes('not entitled') || error.message.includes('Entitlements')) {
      console.log('Vault is NOT in Entitlements whitelist - cannot receive USYC');
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
