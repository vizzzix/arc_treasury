/**
 * Script to set the treasury operator address on TreasuryVault
 *
 * Usage:
 *   npx tsx scripts/setTreasuryOperator.ts <newOperatorAddress>
 *
 * Example:
 *   npx tsx scripts/setTreasuryOperator.ts 0xE85FFCDE1E15D9BF7ADbA1a04eA644B0204DF7cB
 */

import { createWalletClient, createPublicClient, http, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { defineChain } from 'viem';

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
    default: {
      http: ['https://rpc.testnet.arc.network'],
    },
    public: {
      http: ['https://rpc.testnet.arc.network'],
    },
  },
  blockExplorers: {
    default: { name: 'ArcScan', url: 'https://testnet.arcscan.app' },
  },
  testnet: true,
});

// Contract addresses
const TREASURY_VAULT_ADDRESS = '0xe050d1353bf7f4d7f66ff4538333e03d7e52ad87' as `0x${string}`;

// Private key from environment (required)
const PRIVATE_KEY = process.env.PRIVATE_KEY;
if (!PRIVATE_KEY) {
  console.error('❌ Error: PRIVATE_KEY environment variable is required');
  process.exit(1);
}

// TreasuryVault ABI (only the functions we need)
const treasuryVaultAbi = parseAbi([
  'function setTreasuryOperator(address newOperator) external',
  'function treasuryOperator() external view returns (address)',
  'function owner() external view returns (address)',
]);

async function main() {
  const newOperator = process.argv[2];

  if (!newOperator) {
    console.error('❌ Error: Missing new operator address');
    console.log('Usage: npx tsx scripts/setTreasuryOperator.ts <newOperatorAddress>');
    process.exit(1);
  }

  // Validate address format
  if (!/^0x[a-fA-F0-9]{40}$/.test(newOperator)) {
    console.error('❌ Error: Invalid Ethereum address format');
    process.exit(1);
  }

  console.log('🔧 Setting Treasury Operator...\n');

  // Create account from private key
  const account = privateKeyToAccount(PRIVATE_KEY as `0x${string}`);
  console.log(`📝 Deployer address: ${account.address}`);
  console.log(`📝 New operator address: ${newOperator}`);

  // Create clients
  const publicClient = createPublicClient({
    chain: arcTestnet,
    transport: http(),
  });

  const walletClient = createWalletClient({
    account,
    chain: arcTestnet,
    transport: http(),
  });

  // Check current operator
  console.log('\n📖 Reading current state...');
  const currentOperator = await publicClient.readContract({
    address: TREASURY_VAULT_ADDRESS,
    abi: treasuryVaultAbi,
    functionName: 'treasuryOperator',
  });
  console.log(`   Current operator: ${currentOperator}`);

  const owner = await publicClient.readContract({
    address: TREASURY_VAULT_ADDRESS,
    abi: treasuryVaultAbi,
    functionName: 'owner',
  });
  console.log(`   Contract owner: ${owner}`);

  // Check if caller is owner
  if (account.address.toLowerCase() !== owner.toLowerCase()) {
    console.error(`\n❌ Error: Account ${account.address} is not the contract owner (${owner})`);
    process.exit(1);
  }

  // Check if already set to the desired operator
  if (currentOperator.toLowerCase() === newOperator.toLowerCase()) {
    console.log(`\n✅ Treasury operator is already set to ${newOperator}`);
    process.exit(0);
  }

  // Send transaction
  console.log('\n📤 Sending transaction...');
  try {
    const hash = await walletClient.writeContract({
      address: TREASURY_VAULT_ADDRESS,
      abi: treasuryVaultAbi,
      functionName: 'setTreasuryOperator',
      args: [newOperator as `0x${string}`],
    });

    console.log(`   Transaction hash: ${hash}`);
    console.log(`   Explorer: https://testnet.arcscan.app/tx/${hash}`);

    // Wait for transaction receipt
    console.log('\n⏳ Waiting for confirmation...');
    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    if (receipt.status === 'success') {
      console.log('✅ Transaction confirmed!');

      // Verify new operator
      const newOperatorRead = await publicClient.readContract({
        address: TREASURY_VAULT_ADDRESS,
        abi: treasuryVaultAbi,
        functionName: 'treasuryOperator',
      });

      console.log(`\n✅ Treasury operator updated successfully!`);
      console.log(`   Old operator: ${currentOperator}`);
      console.log(`   New operator: ${newOperatorRead}`);
    } else {
      console.error('❌ Transaction failed');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Error sending transaction:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});
