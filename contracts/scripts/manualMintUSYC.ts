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
const TREASURY_VAULT = "0x5d4f0b80db539c8f8f798505358214d16d7ad55e" as `0x${string}`;
const USYC_TELLER = "0x9fdF14c5B14173D74C08Af27AebFf39240dC105A" as `0x${string}`;
const USYC_ADDRESS = "0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C" as `0x${string}`;

// Native USDC on Arc is also ERC20!
const NATIVE_USDC = "0x3600000000000000000000000000000000000000" as `0x${string}`;

// ERC20 ABI for approve
const erc20ApproveABI = [
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

// Teller ABI - deposit is NOT payable, uses ERC20 approve
const tellerABI = [
  {
    name: "deposit",
    type: "function",
    inputs: [
      { name: "assets", type: "uint256" },
      { name: "receiver", type: "address" }
    ],
    outputs: [{ type: "uint256" }],
    stateMutability: "nonpayable", // Uses ERC20 approve, not payable
  },
  {
    name: "previewDeposit",
    type: "function",
    inputs: [{ name: "assets", type: "uint256" }],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
] as const;

// Vault ABI
const vaultABI = [
  {
    name: "recordUSYCConversion",
    type: "function",
    inputs: [{ name: "usycAmount", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    name: "totalUSDC",
    type: "function",
    inputs: [],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    name: "totalUSYC",
    type: "function",
    inputs: [],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
] as const;

// ERC20 ABI
const erc20ABI = [
  {
    name: "balanceOf",
    type: "function",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
] as const;

async function main() {
  console.log("=== Manual USYC Conversion via Teller ===\n");

  // Use operator key (whitelisted for USYC)
  let privateKey = process.env.PRIVATE_KEY_operator || process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("PRIVATE_KEY_operator not set");
  }
  // Add 0x prefix if missing
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

  // Check vault state
  const totalUSDC = await publicClient.readContract({
    address: TREASURY_VAULT,
    abi: vaultABI,
    functionName: "totalUSDC",
  });
  console.log("Vault totalUSDC:", formatUnits(totalUSDC, 18), "USDC");

  // Check vault native balance
  const vaultBalance = await publicClient.getBalance({ address: TREASURY_VAULT });
  console.log("Vault native balance:", formatUnits(vaultBalance, 18), "USDC");

  // Check operator balance
  const operatorBalance = await publicClient.getBalance({ address: account.address });
  console.log("Operator native balance:", formatUnits(operatorBalance, 18), "USDC");

  // Amount to convert - Teller uses 6 decimals for USDC
  const amountToConvert = parseUnits("1", 6); // 1 USDC in 6 decimals
  console.log("\nAmount to convert:", formatUnits(amountToConvert, 6), "USDC");

  // Preview deposit
  try {
    const previewShares = await publicClient.readContract({
      address: USYC_TELLER,
      abi: tellerABI,
      functionName: "previewDeposit",
      args: [amountToConvert],
    });
    console.log("Expected USYC shares:", formatUnits(previewShares, 6));
  } catch (e: any) {
    console.log("Preview failed:", e.message);
  }

  // Step 1: Deposit to Teller (operator deposits their own USDC to get USYC)
  // Step 1: Approve USDC to Teller
  console.log("\n--- Step 1: Approve USDC to Teller ---");

  try {
    // Check current allowance
    const currentAllowance = await publicClient.readContract({
      address: NATIVE_USDC,
      abi: erc20ApproveABI,
      functionName: "allowance",
      args: [account.address, USYC_TELLER],
    });
    console.log("Current allowance:", formatUnits(currentAllowance, 6), "USDC");

    if (currentAllowance < amountToConvert) {
      console.log("Approving USDC...");
      const approveHash = await walletClient.writeContract({
        address: NATIVE_USDC,
        abi: erc20ApproveABI,
        functionName: "approve",
        args: [USYC_TELLER, amountToConvert],
      });
      console.log("Approve tx:", approveHash);
      await publicClient.waitForTransactionReceipt({ hash: approveHash });
      console.log("Approved!");
    } else {
      console.log("Already approved");
    }

    // Step 2: Deposit to Teller
    console.log("\n--- Step 2: Deposit to Teller ---");
    console.log("Calling teller.deposit()...");

    const depositHash = await walletClient.writeContract({
      address: USYC_TELLER,
      abi: tellerABI,
      functionName: "deposit",
      args: [amountToConvert, account.address],
      // NO value - uses ERC20 approve
    });

    console.log("Deposit tx:", depositHash);
    const receipt = await publicClient.waitForTransactionReceipt({ hash: depositHash });
    console.log("Status:", receipt.status === "success" ? "Success" : "Failed");

    // Check USYC balance
    const usycBalance = await publicClient.readContract({
      address: USYC_ADDRESS,
      abi: erc20ABI,
      functionName: "balanceOf",
      args: [account.address],
    });
    console.log("Operator USYC balance:", formatUnits(usycBalance, 6), "USYC");

  } catch (e: any) {
    console.error("Failed:", e.message);
    if (e.message.includes("not allowlisted") || e.message.includes("entitled")) {
      console.log("\n⚠️  Operator wallet is not whitelisted for USYC!");
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
