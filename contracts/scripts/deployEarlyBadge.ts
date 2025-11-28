import { createWalletClient, createPublicClient, http, encodeDeployData } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { defineChain } from "viem";
import { readFileSync } from "fs";
import { join } from "path";
import * as dotenv from "dotenv";

dotenv.config();

const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.testnet.arc.network"] },
  },
});

async function main() {
  console.log("Deploying EarlySupporterBadge...\n");

  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("PRIVATE_KEY environment variable is not set");
  }

  const account = privateKeyToAccount(privateKey as `0x${string}`);
  console.log("Deployer address:", account.address);

  const publicClient = createPublicClient({
    chain: arcTestnet,
    transport: http(),
  });

  const walletClient = createWalletClient({
    account,
    chain: arcTestnet,
    transport: http(),
  });

  // Load contract artifact
  const artifact = JSON.parse(
    readFileSync(
      join(process.cwd(), "artifacts/contracts/EarlySupporterBadge.sol/EarlySupporterBadge.json"),
      "utf-8"
    )
  );

  // Configuration
  const VAULT_ADDRESS = "0x34d504dda5bcd436d4d86ef9b3930ea8c0cd8b2f" as `0x${string}`;
  const BASE_URI = "https://arctreasury.biz/api/badge/";
  // Deadline: 90 days from now
  const MINT_DEADLINE = BigInt(Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60));

  console.log("\nConfiguration:");
  console.log("- Owner:", account.address);
  console.log("- Vault:", VAULT_ADDRESS);
  console.log("- Base URI:", BASE_URI);
  console.log("- Mint Deadline:", new Date(Number(MINT_DEADLINE) * 1000).toISOString());

  // Check balance
  const balance = await publicClient.getBalance({ address: account.address });
  console.log("\nDeployer balance:", (Number(balance) / 1e18).toFixed(4), "USDC");

  if (balance < 1000000000000000n) {
    throw new Error("Insufficient balance for deployment");
  }

  // Deploy contract
  console.log("\nDeploying contract...");

  const hash = await walletClient.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode as `0x${string}`,
    args: [
      account.address,  // owner
      VAULT_ADDRESS,    // vault
      BASE_URI,         // baseURI
      MINT_DEADLINE     // deadline
    ],
  });

  console.log("Transaction hash:", hash);
  console.log("Waiting for confirmation...");

  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  if (!receipt.contractAddress) {
    throw new Error("Contract deployment failed - no address returned");
  }

  console.log("\n✅ EarlySupporterBadge deployed to:", receipt.contractAddress);
  console.log("Block:", receipt.blockNumber);
  console.log("Gas used:", receipt.gasUsed.toString());

  console.log("\n📋 Explorer:");
  console.log(`https://testnet.arcscan.app/address/${receipt.contractAddress}`);

  // Read contract info
  const badgeAbi = [
    { name: 'name', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'string' }] },
    { name: 'symbol', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'string' }] },
    { name: 'MAX_SUPPLY', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
    { name: 'mintingEnabled', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'bool' }] },
  ] as const;

  const name = await publicClient.readContract({
    address: receipt.contractAddress,
    abi: badgeAbi,
    functionName: 'name',
  });

  const symbol = await publicClient.readContract({
    address: receipt.contractAddress,
    abi: badgeAbi,
    functionName: 'symbol',
  });

  const maxSupply = await publicClient.readContract({
    address: receipt.contractAddress,
    abi: badgeAbi,
    functionName: 'MAX_SUPPLY',
  });

  const mintingEnabled = await publicClient.readContract({
    address: receipt.contractAddress,
    abi: badgeAbi,
    functionName: 'mintingEnabled',
  });

  console.log("\n📋 Contract Info:");
  console.log("- Name:", name);
  console.log("- Symbol:", symbol);
  console.log("- Max Supply:", maxSupply.toString());
  console.log("- Minting Enabled:", mintingEnabled);

  console.log("\n🔧 Next Steps:");
  console.log("1. Update constants.ts with badge address:", receipt.contractAddress);
  console.log("2. Add whitelist addresses via addToWhitelist()");
  console.log("3. Deploy frontend and test minting");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
