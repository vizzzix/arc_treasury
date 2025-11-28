/**
 * Script to transfer ownership of all contracts to a new wallet
 *
 * This script transfers:
 * 1. TreasuryVault ownership + treasuryOperator
 * 2. USYCOracle ownership + priceUpdater
 * 3. PointsMultiplierNFT ownership
 *
 * Usage:
 *   npx tsx scripts/transferOwnership.ts
 *
 * Required env vars:
 *   PRIVATE_KEY_OLD - Current owner's private key
 *   PRIVATE_KEY - New owner's private key (to derive address)
 */

import { createWalletClient, createPublicClient, http, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { defineChain } from 'viem';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// ES module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from project root
dotenv.config({ path: resolve(__dirname, '../../.env') });

// Arc Testnet chain definition
const arcTestnet = defineChain({
  id: 5042002,
  name: 'Arc Testnet',
  network: 'arc-testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'USDC',
    symbol: 'USDC',
  },
  rpcUrls: {
    default: { http: ['https://rpc.testnet.arc.network'] },
    public: { http: ['https://rpc.testnet.arc.network'] },
  },
  blockExplorers: {
    default: { name: 'ArcScan', url: 'https://testnet.arcscan.app' },
  },
  testnet: true,
});

// Contract addresses
const CONTRACTS = {
  TreasuryVault: '0xe050d1353bf7f4d7f66ff4538333e03d7e52ad87' as `0x${string}`,
  USYCOracle: '0x9210289432a5c7d7c6506dae8c1716bb47f8d84c' as `0x${string}`,
  PointsMultiplierNFT: '0x3eeca3180a2c0db29819ad007ff9869764b97419' as `0x${string}`,
};

// ABIs
const ownableAbi = parseAbi([
  'function owner() external view returns (address)',
  'function transferOwnership(address newOwner) external',
]);

const treasuryVaultAbi = parseAbi([
  'function owner() external view returns (address)',
  'function transferOwnership(address newOwner) external',
  'function treasuryOperator() external view returns (address)',
  'function setTreasuryOperator(address newOperator) external',
]);

const usycOracleAbi = parseAbi([
  'function owner() external view returns (address)',
  'function transferOwnership(address newOwner) external',
  'function priceUpdater() external view returns (address)',
  'function setPriceUpdater(address newUpdater) external',
]);

async function main() {
  // Validate env vars
  const PRIVATE_KEY_OLD = process.env.PRIVATE_KEY_OLD;
  const PRIVATE_KEY_NEW = process.env.PRIVATE_KEY;

  if (!PRIVATE_KEY_OLD) {
    console.error('❌ Error: PRIVATE_KEY_OLD environment variable is required');
    process.exit(1);
  }
  if (!PRIVATE_KEY_NEW) {
    console.error('❌ Error: PRIVATE_KEY environment variable is required');
    process.exit(1);
  }

  // Create accounts
  const oldAccount = privateKeyToAccount(PRIVATE_KEY_OLD as `0x${string}`);
  const newAccount = privateKeyToAccount(PRIVATE_KEY_NEW as `0x${string}`);

  console.log('🔐 Ownership Transfer Script\n');
  console.log(`   Old owner (signing): ${oldAccount.address}`);
  console.log(`   New owner (target):  ${newAccount.address}\n`);

  // Create clients
  const publicClient = createPublicClient({
    chain: arcTestnet,
    transport: http(),
  });

  const walletClient = createWalletClient({
    account: oldAccount,
    chain: arcTestnet,
    transport: http(),
  });

  // Helper function to send transaction and wait for receipt
  async function sendTx(
    address: `0x${string}`,
    abi: any,
    functionName: string,
    args: any[],
    description: string
  ) {
    console.log(`\n📤 ${description}...`);
    try {
      const hash = await walletClient.writeContract({
        address,
        abi,
        functionName,
        args,
      });
      console.log(`   TX: https://testnet.arcscan.app/tx/${hash}`);

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status === 'success') {
        console.log(`   ✅ Success!`);
        return true;
      } else {
        console.log(`   ❌ Failed!`);
        return false;
      }
    } catch (error: any) {
      console.error(`   ❌ Error: ${error.message}`);
      return false;
    }
  }

  // ============================================
  // 1. TreasuryVault
  // ============================================
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📦 TreasuryVault');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const vaultOwner = await publicClient.readContract({
    address: CONTRACTS.TreasuryVault,
    abi: treasuryVaultAbi,
    functionName: 'owner',
  });
  const vaultOperator = await publicClient.readContract({
    address: CONTRACTS.TreasuryVault,
    abi: treasuryVaultAbi,
    functionName: 'treasuryOperator',
  });

  console.log(`   Current owner: ${vaultOwner}`);
  console.log(`   Current operator: ${vaultOperator}`);

  if (vaultOwner.toLowerCase() === oldAccount.address.toLowerCase()) {
    // Set new operator first (before transferring ownership)
    if (vaultOperator.toLowerCase() !== newAccount.address.toLowerCase()) {
      await sendTx(
        CONTRACTS.TreasuryVault,
        treasuryVaultAbi,
        'setTreasuryOperator',
        [newAccount.address],
        'Setting new treasuryOperator'
      );
    }

    // Transfer ownership
    await sendTx(
      CONTRACTS.TreasuryVault,
      treasuryVaultAbi,
      'transferOwnership',
      [newAccount.address],
      'Transferring TreasuryVault ownership'
    );
  } else {
    console.log(`   ⚠️ Skipping - old account is not owner`);
  }

  // ============================================
  // 2. USYCOracle
  // ============================================
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📦 USYCOracle');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const oracleOwner = await publicClient.readContract({
    address: CONTRACTS.USYCOracle,
    abi: usycOracleAbi,
    functionName: 'owner',
  });
  const priceUpdater = await publicClient.readContract({
    address: CONTRACTS.USYCOracle,
    abi: usycOracleAbi,
    functionName: 'priceUpdater',
  });

  console.log(`   Current owner: ${oracleOwner}`);
  console.log(`   Current priceUpdater: ${priceUpdater}`);

  if (oracleOwner.toLowerCase() === oldAccount.address.toLowerCase()) {
    // Set new price updater first
    if (priceUpdater.toLowerCase() !== newAccount.address.toLowerCase()) {
      await sendTx(
        CONTRACTS.USYCOracle,
        usycOracleAbi,
        'setPriceUpdater',
        [newAccount.address],
        'Setting new priceUpdater'
      );
    }

    // Transfer ownership
    await sendTx(
      CONTRACTS.USYCOracle,
      usycOracleAbi,
      'transferOwnership',
      [newAccount.address],
      'Transferring USYCOracle ownership'
    );
  } else {
    console.log(`   ⚠️ Skipping - old account is not owner`);
  }

  // ============================================
  // 3. PointsMultiplierNFT
  // ============================================
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📦 PointsMultiplierNFT');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const nftOwner = await publicClient.readContract({
    address: CONTRACTS.PointsMultiplierNFT,
    abi: ownableAbi,
    functionName: 'owner',
  });

  console.log(`   Current owner: ${nftOwner}`);

  if (nftOwner.toLowerCase() === oldAccount.address.toLowerCase()) {
    await sendTx(
      CONTRACTS.PointsMultiplierNFT,
      ownableAbi,
      'transferOwnership',
      [newAccount.address],
      'Transferring PointsMultiplierNFT ownership'
    );
  } else {
    console.log(`   ⚠️ Skipping - old account is not owner`);
  }

  // ============================================
  // Summary
  // ============================================
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 Final State');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Re-read all values
  const finalVaultOwner = await publicClient.readContract({
    address: CONTRACTS.TreasuryVault,
    abi: treasuryVaultAbi,
    functionName: 'owner',
  });
  const finalVaultOperator = await publicClient.readContract({
    address: CONTRACTS.TreasuryVault,
    abi: treasuryVaultAbi,
    functionName: 'treasuryOperator',
  });
  const finalOracleOwner = await publicClient.readContract({
    address: CONTRACTS.USYCOracle,
    abi: usycOracleAbi,
    functionName: 'owner',
  });
  const finalPriceUpdater = await publicClient.readContract({
    address: CONTRACTS.USYCOracle,
    abi: usycOracleAbi,
    functionName: 'priceUpdater',
  });
  const finalNftOwner = await publicClient.readContract({
    address: CONTRACTS.PointsMultiplierNFT,
    abi: ownableAbi,
    functionName: 'owner',
  });

  console.log('TreasuryVault:');
  console.log(`   Owner: ${finalVaultOwner}`);
  console.log(`   Operator: ${finalVaultOperator}`);
  console.log('');
  console.log('USYCOracle:');
  console.log(`   Owner: ${finalOracleOwner}`);
  console.log(`   PriceUpdater: ${finalPriceUpdater}`);
  console.log('');
  console.log('PointsMultiplierNFT:');
  console.log(`   Owner: ${finalNftOwner}`);

  const allTransferred =
    finalVaultOwner.toLowerCase() === newAccount.address.toLowerCase() &&
    finalOracleOwner.toLowerCase() === newAccount.address.toLowerCase() &&
    finalNftOwner.toLowerCase() === newAccount.address.toLowerCase();

  if (allTransferred) {
    console.log('\n✅ All ownership transferred successfully!');
    console.log(`\n⚠️ Old wallet ${oldAccount.address} no longer has any contract permissions.`);
    console.log('   You can now abandon this wallet.');
  } else {
    console.log('\n⚠️ Some transfers may have failed. Check the output above.');
  }
}

main().catch((error) => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});
