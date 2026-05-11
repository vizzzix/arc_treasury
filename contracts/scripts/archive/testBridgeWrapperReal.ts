/**
 * Test real bridge through BridgeWrapper with small amount
 */

import { createWalletClient, createPublicClient, http, formatUnits, parseUnits, pad } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { defineChain } from "viem";
import * as dotenv from "dotenv";

dotenv.config({ path: '../.env' });

const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.testnet.arc.network"] },
  },
});

const USDC_ADDRESS = "0x3600000000000000000000000000000000000000" as `0x${string}`;
const BRIDGE_WRAPPER_ADDRESS = "0x5ef1fab94a1cb4203350d18b2bf0f113c3fd2ceb" as `0x${string}`;

const ERC20_ABI = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }]
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }]
  }
] as const;

const BRIDGE_WRAPPER_ABI = [
  {
    name: 'bridgeToSepolia',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'amount', type: 'uint256' },
      { name: 'mintRecipient', type: 'bytes32' }
    ],
    outputs: [{ name: 'nonce', type: 'uint64' }]
  },
  {
    name: 'calculateFee',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [{ name: 'fee', type: 'uint256' }, { name: 'bridgeAmount', type: 'uint256' }]
  }
] as const;

async function main() {
  console.log("=== Real BridgeWrapper Test ===\n");

  const privateKey = process.env.PRIVATE_KEY_OPERATOR || process.env.PRIVATE_KEY;
  if (!privateKey) throw new Error("PRIVATE_KEY not set");

  const account = privateKeyToAccount(`0x${privateKey.replace('0x', '')}` as `0x${string}`);

  const publicClient = createPublicClient({
    chain: arcTestnet,
    transport: http(),
  });

  const walletClient = createWalletClient({
    account,
    chain: arcTestnet,
    transport: http(),
  });

  console.log("Account:", account.address);

  // Check USDC balance
  // IMPORTANT: On Arc, ERC20 USDC uses 6 decimals, native uses 18
  const nativeBalance = await publicClient.getBalance({ address: account.address });
  console.log("Native balance (18 dec):", formatUnits(nativeBalance, 18), "USDC");

  const erc20Balance = await publicClient.readContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [account.address],
  }) as bigint;
  console.log("ERC20 balance (6 dec):", formatUnits(erc20Balance, 6), "USDC");

  // Test amount: 1 USDC in 6 decimals for ERC20 operations
  const testAmount = parseUnits("1", 6);
  console.log("\nTest amount: 1 USDC (", testAmount.toString(), "in 6 decimals)");

  if (erc20Balance < testAmount) {
    console.log("❌ Insufficient ERC20 USDC balance");
    return;
  }

  // Check fee
  const [fee, bridgeAmount] = await publicClient.readContract({
    address: BRIDGE_WRAPPER_ADDRESS,
    abi: BRIDGE_WRAPPER_ABI,
    functionName: 'calculateFee',
    args: [testAmount],
  }) as [bigint, bigint];
  console.log("Fee:", formatUnits(fee, 6), "USDC");
  console.log("Bridge amount:", formatUnits(bridgeAmount, 6), "USDC");

  // Check allowance
  const allowance = await publicClient.readContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [account.address, BRIDGE_WRAPPER_ADDRESS],
  }) as bigint;
  console.log("Current allowance:", formatUnits(allowance, 6));

  // Approve if needed
  if (allowance < testAmount) {
    console.log("\n--- Approving USDC ---");
    const approveHash = await walletClient.writeContract({
      address: USDC_ADDRESS,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [BRIDGE_WRAPPER_ADDRESS, testAmount],
    });
    console.log("Approve TX:", approveHash);
    await publicClient.waitForTransactionReceipt({ hash: approveHash });
    console.log("✅ Approved");
  }

  // Bridge
  console.log("\n--- Initiating Bridge ---");
  const mintRecipient = pad(account.address, { size: 32 });
  console.log("Mint recipient:", mintRecipient);

  try {
    const bridgeHash = await walletClient.writeContract({
      address: BRIDGE_WRAPPER_ADDRESS,
      abi: BRIDGE_WRAPPER_ABI,
      functionName: 'bridgeToSepolia',
      args: [testAmount, mintRecipient],
    });
    console.log("Bridge TX:", bridgeHash);

    const receipt = await publicClient.waitForTransactionReceipt({ hash: bridgeHash });
    console.log("Status:", receipt.status);

    if (receipt.status === 'success') {
      console.log("\n✅ Bridge initiated successfully!");
      console.log("TX Hash:", bridgeHash);
      console.log("\nNext: Wait for attestation and claim on Sepolia");
    } else {
      console.log("❌ Transaction failed");
    }
  } catch (e: any) {
    console.log("❌ Bridge error:", e.message);
    if (e.message.includes('revert')) {
      console.log("\nPossible causes:");
      console.log("1. TokenMessenger.depositForBurn() reverted");
      console.log("2. USDC transfer failed");
      console.log("3. Fee calculation issue");
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
