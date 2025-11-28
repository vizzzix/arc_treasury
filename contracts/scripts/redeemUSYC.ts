import { createWalletClient, createPublicClient, http, parseUnits, formatUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { defineChain } from "viem";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, "../../.env") });

// Arc Testnet
const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.testnet.arc.network"] },
  },
});

// Contract addresses
const USYC_TELLER = "0x9fdF14c5B14173D74C08Af27AebFf39240dC105A" as `0x${string}`;
const USYC_ADDRESS = "0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C" as `0x${string}`;
const NATIVE_USDC = "0x3600000000000000000000000000000000000000" as `0x${string}`;

// ERC20 ABI
const erc20ABI = [
  {
    name: "balanceOf",
    type: "function",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    name: "approve",
    type: "function",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" }
    ],
    outputs: [{ type: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    name: "allowance",
    type: "function",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" }
    ],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
] as const;

// Teller ABI - redeem function
const tellerABI = [
  {
    name: "redeem",
    type: "function",
    inputs: [
      { name: "shares", type: "uint256" },
      { name: "receiver", type: "address" },
      { name: "owner", type: "address" }
    ],
    outputs: [{ type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    name: "previewRedeem",
    type: "function",
    inputs: [{ name: "shares", type: "uint256" }],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    name: "convertToAssets",
    type: "function",
    inputs: [{ name: "shares", type: "uint256" }],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
] as const;

async function main() {
  console.log("=== Redeem USYC to USDC via Teller ===\n");

  // Use operator key (whitelisted for USYC)
  let privateKey = process.env.PRIVATE_KEY_operator || process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("PRIVATE_KEY_operator not set");
  }
  if (!privateKey.startsWith("0x")) {
    privateKey = "0x" + privateKey;
  }

  const account = privateKeyToAccount(privateKey as `0x${string}`);
  console.log("Operator wallet:", account.address);

  const publicClient = createPublicClient({
    chain: arcTestnet,
    transport: http(),
  });

  const walletClient = createWalletClient({
    account,
    chain: arcTestnet,
    transport: http(),
  });

  // Check balances before
  const usycBalance = await publicClient.readContract({
    address: USYC_ADDRESS,
    abi: erc20ABI,
    functionName: "balanceOf",
    args: [account.address],
  });
  console.log("USYC balance:", formatUnits(usycBalance, 6), "USYC");

  const usdcBalance = await publicClient.getBalance({ address: account.address });
  console.log("USDC balance:", formatUnits(usdcBalance, 18), "USDC");

  if (usycBalance === 0n) {
    console.log("\nNo USYC to redeem!");
    return;
  }

  // Amount to redeem - redeem all USYC or specify amount
  const amountToRedeem = usycBalance; // Redeem all
  // const amountToRedeem = parseUnits("10", 6); // Or redeem specific amount
  console.log("\nAmount to redeem:", formatUnits(amountToRedeem, 6), "USYC");

  // Preview redemption
  try {
    const previewAssets = await publicClient.readContract({
      address: USYC_TELLER,
      abi: tellerABI,
      functionName: "previewRedeem",
      args: [amountToRedeem],
    });
    console.log("Expected USDC:", formatUnits(previewAssets, 6), "USDC");

    const yieldEarned = previewAssets - amountToRedeem;
    if (yieldEarned > 0n) {
      console.log("Yield earned:", formatUnits(yieldEarned, 6), "USDC");
      const yieldPercent = (Number(yieldEarned) / Number(amountToRedeem)) * 100;
      console.log("Yield %:", yieldPercent.toFixed(2) + "%");
    }
  } catch (e: any) {
    console.log("Preview failed:", e.message);
  }

  // Check allowance for USYC to Teller
  console.log("\n--- Step 1: Check/Approve USYC to Teller ---");
  const currentAllowance = await publicClient.readContract({
    address: USYC_ADDRESS,
    abi: erc20ABI,
    functionName: "allowance",
    args: [account.address, USYC_TELLER],
  });
  console.log("Current allowance:", formatUnits(currentAllowance, 6), "USYC");

  if (currentAllowance < amountToRedeem) {
    console.log("Approving USYC to Teller...");
    const approveHash = await walletClient.writeContract({
      address: USYC_ADDRESS,
      abi: erc20ABI,
      functionName: "approve",
      args: [USYC_TELLER, amountToRedeem],
    });
    console.log("Approve tx:", approveHash);
    await publicClient.waitForTransactionReceipt({ hash: approveHash });
    console.log("Approved!");
  } else {
    console.log("Already approved");
  }

  // Redeem USYC
  console.log("\n--- Step 2: Redeem USYC ---");
  console.log("Calling teller.redeem()...");

  try {
    const redeemHash = await walletClient.writeContract({
      address: USYC_TELLER,
      abi: tellerABI,
      functionName: "redeem",
      args: [amountToRedeem, account.address, account.address],
    });

    console.log("Redeem tx:", redeemHash);
    const receipt = await publicClient.waitForTransactionReceipt({ hash: redeemHash });
    console.log("Status:", receipt.status === "success" ? "Success" : "Failed");

    // Check balances after
    console.log("\n--- Final Balances ---");
    const newUsycBalance = await publicClient.readContract({
      address: USYC_ADDRESS,
      abi: erc20ABI,
      functionName: "balanceOf",
      args: [account.address],
    });
    console.log("USYC balance:", formatUnits(newUsycBalance, 6), "USYC");

    const newUsdcBalance = await publicClient.getBalance({ address: account.address });
    console.log("USDC balance:", formatUnits(newUsdcBalance, 18), "USDC");

    const usdcReceived = newUsdcBalance - usdcBalance;
    console.log("\nUSDC received:", formatUnits(usdcReceived, 18), "USDC");

  } catch (e: any) {
    console.error("Redeem failed:", e.message);
    if (e.message.includes("not allowlisted") || e.message.includes("entitled")) {
      console.log("\nOperator wallet may not be whitelisted for USYC operations");
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
