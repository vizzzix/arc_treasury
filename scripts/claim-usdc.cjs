/**
 * Script to claim USDC on Sepolia using CCTP V2 MessageTransmitterV2
 *
 * Run: node scripts/claim-usdc.js
 *
 * This script calls receiveMessage() on the correct V2 contract to mint USDC
 */

const { createPublicClient, createWalletClient, http } = require('viem');
const { sepolia } = require('viem/chains');
const { privateKeyToAccount } = require('viem/accounts');

// CCTP V2 MessageTransmitter on Sepolia
const MESSAGE_TRANSMITTER_V2 = '0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275';

// ABI for receiveMessage
const MESSAGE_TRANSMITTER_ABI = [
  {
    inputs: [
      { name: 'message', type: 'bytes' },
      { name: 'attestation', type: 'bytes' }
    ],
    name: 'receiveMessage',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function'
  }
];

// Transaction 1: 299 USDC
const TX1 = {
  amount: '299 USDC',
  message: '0x000000010000001a0000000006595205014cbea5c56e4629ec80377a0e3d07b030f1b7da69febf29142e85b70000000000000000000000008fe6b999dc680ccfdd5bf7eb0974218be2542daa0000000000000000000000008fe6b999dc680ccfdd5bf7eb0974218be2542daa0000000000000000000000000000000000000000000000000000000000000000000003e8000007d0000000010000000000000000000000003600000000000000000000000000000000000000000000000000000000000000b66d4229bb5a82de94610d63677cf5370e6a81cb0000000000000000000000000000000000000000000000000000000011d260c0000000000000000000000000b66d4229bb5a82de94610d63677cf5370e6a81cb00000000000000000000000000000000000000000000000000000000000001f400000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
  attestation: '0x874b0638870c042928d90e420cd9083adac228e32cc67b61ef281a6b406251b05c503d7e45ad80c5d5aa07e6e10c67feafb30770872cf15465077cb0c8aa7ab91cded928ef0a8190ad97ee35b5c9c3f7fe0c9c271ae8f1fe8b663de5100ba287086ae03bcd0be08c7ae47b236807529ce2bdfc18357406368cf603708d68d1732d1c',
};

// Transaction 2: 500 USDC
const TX2 = {
  amount: '500 USDC',
  message: '0x000000010000001a00000000e176898efd9135d178d77551c9c5440d6451dbaf2fc3a10ced9f2632122f9a090000000000000000000000008fe6b999dc680ccfdd5bf7eb0974218be2542daa0000000000000000000000008fe6b999dc680ccfdd5bf7eb0974218be2542daa0000000000000000000000000000000000000000000000000000000000000000000003e8000007d0000000010000000000000000000000003600000000000000000000000000000000000000000000000000000000000000b66d4229bb5a82de94610d63677cf5370e6a81cb000000000000000000000000000000000000000000000000000000001dcd6500000000000000000000000000b66d4229bb5a82de94610d63677cf5370e6a81cb00000000000000000000000000000000000000000000000000000000000001f400000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
  attestation: '0x26be0c5d0a61e43b35332ac795c3769ef93bc53417423ee378bca502caa086177f5f6a29a1d7cb70c2318056ea0e339dcc5bc7556aadb80ff524edddf16743ad1c390904920b2e284cf97492047eeb1dc2a4d2c6f4df894020aa4dee29f940ac191e2ec61ba81654da54e8a0476f03b6f801f3768a7ad7863446dbbeac72456cad1c',
};

async function main() {
  console.log('=== CCTP V2 USDC Claim Script ===\n');
  console.log('MessageTransmitterV2:', MESSAGE_TRANSMITTER_V2);
  console.log('Network: Ethereum Sepolia\n');

  // Check if private key is provided
  const privateKey = process.env.PRIVATE_KEY;

  if (!privateKey) {
    console.log('No PRIVATE_KEY provided. Outputting transaction data for manual execution:\n');

    console.log('=== Transaction 1: Claim 299 USDC ===');
    console.log('Contract:', MESSAGE_TRANSMITTER_V2);
    console.log('Function: receiveMessage(bytes message, bytes attestation)');
    console.log('Message:', TX1.message);
    console.log('Attestation:', TX1.attestation);
    console.log('\n');

    console.log('=== Transaction 2: Claim 500 USDC ===');
    console.log('Contract:', MESSAGE_TRANSMITTER_V2);
    console.log('Function: receiveMessage(bytes message, bytes attestation)');
    console.log('Message:', TX2.message);
    console.log('Attestation:', TX2.attestation);
    console.log('\n');

    console.log('To execute manually:');
    console.log('1. Go to https://sepolia.etherscan.io/address/0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275#writeContract');
    console.log('2. Connect wallet');
    console.log('3. Call receiveMessage with the message and attestation above');
    return;
  }

  // Create clients
  const account = privateKeyToAccount(privateKey);
  console.log('Wallet:', account.address);

  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http('https://ethereum-sepolia-rpc.publicnode.com'),
  });

  const walletClient = createWalletClient({
    account,
    chain: sepolia,
    transport: http('https://ethereum-sepolia-rpc.publicnode.com'),
  });

  // Claim TX1 (299 USDC)
  console.log('\n=== Claiming 299 USDC ===');
  try {
    const hash1 = await walletClient.writeContract({
      address: MESSAGE_TRANSMITTER_V2,
      abi: MESSAGE_TRANSMITTER_ABI,
      functionName: 'receiveMessage',
      args: [TX1.message, TX1.attestation],
    });
    console.log('TX1 Hash:', hash1);

    const receipt1 = await publicClient.waitForTransactionReceipt({ hash: hash1 });
    console.log('TX1 Status:', receipt1.status);
    console.log('TX1 Logs:', receipt1.logs.length);
  } catch (e) {
    console.log('TX1 Error:', e.message);
  }

  // Claim TX2 (500 USDC)
  console.log('\n=== Claiming 500 USDC ===');
  try {
    const hash2 = await walletClient.writeContract({
      address: MESSAGE_TRANSMITTER_V2,
      abi: MESSAGE_TRANSMITTER_ABI,
      functionName: 'receiveMessage',
      args: [TX2.message, TX2.attestation],
    });
    console.log('TX2 Hash:', hash2);

    const receipt2 = await publicClient.waitForTransactionReceipt({ hash: hash2 });
    console.log('TX2 Status:', receipt2.status);
    console.log('TX2 Logs:', receipt2.logs.length);
  } catch (e) {
    console.log('TX2 Error:', e.message);
  }

  console.log('\n=== Done ===');
}

main().catch(console.error);
