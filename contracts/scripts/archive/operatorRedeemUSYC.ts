import { createWalletClient, createPublicClient, http, parseUnits, formatUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { readFileSync } from "fs";
import { join } from "path";
import * as dotenv from "dotenv";

dotenv.config();

const arcTestnet = {
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.testnet.arc.network'] } },
} as const;

const VAULT_ADDRESS = '0x34d504dda5bcd436d4d86ef9b3930ea8c0cd8b2f' as `0x${string}`;

async function main() {
  // Get operator private key
  const operatorKey = process.env.PRIVATE_KEY_operator;
  if (!operatorKey) {
    throw new Error("PRIVATE_KEY_operator not set in .env");
  }

  const account = privateKeyToAccount(`0x${operatorKey}` as `0x${string}`);
  console.log('Operator address:', account.address);

  const publicClient = createPublicClient({
    chain: arcTestnet,
    transport: http()
  });

  const walletClient = createWalletClient({
    account,
    chain: arcTestnet,
    transport: http()
  });

  const vaultAbi = JSON.parse(
    readFileSync(join(process.cwd(), "artifacts/contracts/TreasuryVault.sol/TreasuryVault.json"), "utf-8")
  ).abi;

  // Check current state
  console.log('\n📊 Current Vault State:');

  const totalUSDC = await publicClient.readContract({
    address: VAULT_ADDRESS,
    abi: vaultAbi,
    functionName: 'totalUSDC'
  }) as bigint;
  console.log('totalUSDC:', formatUnits(totalUSDC, 18), 'USDC (18 dec)');

  const totalUSYC = await publicClient.readContract({
    address: VAULT_ADDRESS,
    abi: vaultAbi,
    functionName: 'totalUSYC'
  }) as bigint;
  console.log('totalUSYC:', formatUnits(totalUSYC, 6), 'USYC (6 dec)');

  // Check if we have USYC to redeem
  if (totalUSYC === 0n) {
    console.log('\n❌ No USYC in vault to redeem');
    return;
  }

  // Amount to redeem (all USYC)
  const amountToRedeem = totalUSYC;
  console.log('\n🔄 Redeeming', formatUnits(amountToRedeem, 6), 'USYC to USDC...');

  try {
    const hash = await walletClient.writeContract({
      address: VAULT_ADDRESS,
      abi: vaultAbi,
      functionName: 'redeemUSYC',
      args: [amountToRedeem]
    });

    console.log('Transaction hash:', hash);
    console.log('Waiting for confirmation...');

    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log('✅ Transaction confirmed in block', receipt.blockNumber);

    // Check new state
    const newTotalUSDC = await publicClient.readContract({
      address: VAULT_ADDRESS,
      abi: vaultAbi,
      functionName: 'totalUSDC'
    }) as bigint;

    const newTotalUSYC = await publicClient.readContract({
      address: VAULT_ADDRESS,
      abi: vaultAbi,
      functionName: 'totalUSYC'
    }) as bigint;

    console.log('\n📊 New Vault State:');
    console.log('totalUSDC:', formatUnits(newTotalUSDC, 18), 'USDC');
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
