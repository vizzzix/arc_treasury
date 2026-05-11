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

const VAULT = '0x17ca5232415430bC57F646A72fD15634807bF729' as `0x${string}`;
const TELLER = '0x9fdF14c5B14173D74C08Af27AebFf39240dC105A' as `0x${string}`;

const vaultAbi = [
  { name: 'totalUSDC', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'totalUSYC', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'mintUSYC', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'usdcAmount', type: 'uint256' }], outputs: [{ type: 'uint256' }] },
] as const;

const tellerAbi = [
  { name: 'maxDeposit', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] },
] as const;

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

  // Get current state
  const [totalUSDC, totalUSYC, maxDeposit] = await Promise.all([
    publicClient.readContract({ address: VAULT, abi: vaultAbi, functionName: 'totalUSDC' }),
    publicClient.readContract({ address: VAULT, abi: vaultAbi, functionName: 'totalUSYC' }),
    publicClient.readContract({ address: TELLER, abi: tellerAbi, functionName: 'maxDeposit', args: [VAULT] }),
  ]);

  console.log('\n📊 Current State:');
  console.log('totalUSDC:', formatUnits(totalUSDC, 18), 'USDC');
  console.log('totalUSYC:', formatUnits(totalUSYC, 6), 'USYC');
  console.log('maxDeposit (Teller limit):', formatUnits(maxDeposit, 6), 'USDC');

  if (totalUSDC === 0n) {
    console.log('\n✅ No USDC to convert');
    return;
  }

  if (maxDeposit === 0n) {
    console.log('\n❌ Vault cannot deposit to Teller (maxDeposit = 0)');
    return;
  }

  // Calculate how much to convert (limited by maxDeposit)
  // maxDeposit is 6 decimals, totalUSDC is 18 decimals
  const maxDepositIn18Dec = maxDeposit * BigInt(1e12);
  const amountToConvert = totalUSDC < maxDepositIn18Dec ? totalUSDC : maxDepositIn18Dec;

  console.log('\n🔄 Converting', formatUnits(amountToConvert, 18), 'USDC to USYC...');

  try {
    const hash = await walletClient.writeContract({
      address: VAULT,
      abi: vaultAbi,
      functionName: 'mintUSYC',
      args: [amountToConvert]
    });

    console.log('Transaction hash:', hash);
    console.log('Waiting for confirmation...');

    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log('✅ Transaction confirmed in block', receipt.blockNumber);

    // Check new state
    const [newTotalUSDC, newTotalUSYC] = await Promise.all([
      publicClient.readContract({ address: VAULT, abi: vaultAbi, functionName: 'totalUSDC' }),
      publicClient.readContract({ address: VAULT, abi: vaultAbi, functionName: 'totalUSYC' }),
    ]);

    console.log('\n📊 New State:');
    console.log('totalUSDC:', formatUnits(newTotalUSDC, 18), 'USDC');
    console.log('totalUSYC:', formatUnits(newTotalUSYC, 6), 'USYC');

    const remaining = newTotalUSDC;
    if (remaining > 0n) {
      console.log('\n⚠️ Still', formatUnits(remaining, 18), 'USDC remaining.');
      console.log('Run this script again to convert more (limited by Teller maxDeposit per tx)');
    } else {
      console.log('\n🎉 All USDC converted to USYC!');
    }

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    if (error.message.includes('Not operator')) {
      console.log('This wallet is not the treasury operator.');
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
