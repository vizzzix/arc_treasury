/**
 * Deploy EURC + StablecoinSwap + Add initial liquidity
 *
 * Usage:
 * cd contracts
 * PRIVATE_KEY=your_key npx tsx scripts/deploySwapPool.ts
 */

import { createWalletClient, createPublicClient, http, parseEther, parseUnits, formatEther, formatUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Arc Testnet chain definition
const arcTestnet = {
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.testnet.arc.network'] },
  },
} as const;

// Initial liquidity amounts
const INITIAL_USDC = "50000"; // 50K USDC
const INITIAL_EURC = "46300"; // ~46.3K EURC (at 1.08 rate = ~50K USD value)

async function main() {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.error("Missing PRIVATE_KEY environment variable");
    process.exit(1);
  }

  const account = privateKeyToAccount(privateKey as `0x${string}`);

  const walletClient = createWalletClient({
    account,
    chain: arcTestnet,
    transport: http(),
  });

  const publicClient = createPublicClient({
    chain: arcTestnet,
    transport: http(),
  });

  console.log("=".repeat(60));
  console.log("Deploy Swap Pool: EURC + StablecoinSwap + Liquidity");
  console.log("=".repeat(60));
  console.log(`Deployer: ${account.address}`);

  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`USDC Balance: ${formatEther(balance)} USDC`);

  const usdcAmount = parseEther(INITIAL_USDC);
  if (balance < usdcAmount) {
    console.error(`\nInsufficient USDC! Need ${INITIAL_USDC}, have ${formatEther(balance)}`);
    return;
  }

  // Load contract artifacts
  const eurcArtifact = JSON.parse(
    readFileSync(join(__dirname, "../artifacts/contracts/TestEURC.sol/TestEURC.json"), "utf-8")
  );
  const swapArtifact = JSON.parse(
    readFileSync(join(__dirname, "../artifacts/contracts/StablecoinSwap.sol/StablecoinSwap.json"), "utf-8")
  );

  // Step 1: Deploy EURC token
  console.log("\n[1/4] Deploying EURC token...");
  const eurcDeployHash = await walletClient.deployContract({
    abi: eurcArtifact.abi,
    bytecode: eurcArtifact.bytecode as `0x${string}`,
  });
  console.log(`Deploy tx: ${eurcDeployHash}`);
  console.log(`Explorer: https://testnet.arcscan.app/tx/${eurcDeployHash}`);

  console.log("Waiting for confirmation...");
  const eurcReceipt = await publicClient.waitForTransactionReceipt({
    hash: eurcDeployHash,
    confirmations: 1,
  });

  if (!eurcReceipt.contractAddress) {
    console.error("Failed to get contract address from receipt");
    console.log("Receipt:", JSON.stringify(eurcReceipt, null, 2));
    return;
  }
  const eurcAddress = eurcReceipt.contractAddress;
  console.log(`EURC deployed to: ${eurcAddress}`);

  // Check minted balance
  const eurcBalance = await publicClient.readContract({
    address: eurcAddress,
    abi: eurcArtifact.abi,
    functionName: "balanceOf",
    args: [account.address],
  }) as bigint;
  console.log(`EURC minted: ${formatUnits(eurcBalance, 6)} EURC`);

  // Step 2: Deploy StablecoinSwap
  console.log("\n[2/4] Deploying StablecoinSwap...");
  const swapDeployHash = await walletClient.deployContract({
    abi: swapArtifact.abi,
    bytecode: swapArtifact.bytecode as `0x${string}`,
    args: [eurcAddress],
  });
  console.log(`Deploy tx: ${swapDeployHash}`);

  const swapReceipt = await publicClient.waitForTransactionReceipt({ hash: swapDeployHash });
  const swapAddress = swapReceipt.contractAddress!;
  console.log(`StablecoinSwap deployed to: ${swapAddress}`);

  // Step 3: Approve EURC
  console.log("\n[3/4] Approving EURC...");
  const eurcAmount = parseUnits(INITIAL_EURC, 6);
  const approveHash = await walletClient.writeContract({
    address: eurcAddress,
    abi: eurcArtifact.abi,
    functionName: "approve",
    args: [swapAddress, eurcAmount],
  });
  await publicClient.waitForTransactionReceipt({ hash: approveHash });
  console.log(`EURC approved: ${INITIAL_EURC} EURC`);

  // Step 4: Add liquidity
  console.log("\n[4/4] Adding initial liquidity...");
  console.log(`  USDC: ${INITIAL_USDC} (native)`);
  console.log(`  EURC: ${INITIAL_EURC}`);

  const addLiqHash = await walletClient.writeContract({
    address: swapAddress,
    abi: swapArtifact.abi,
    functionName: "addLiquidity",
    args: [eurcAmount, 0n],
    value: usdcAmount,
  });
  await publicClient.waitForTransactionReceipt({ hash: addLiqHash });

  // Check results
  const reserves = await publicClient.readContract({
    address: swapAddress,
    abi: swapArtifact.abi,
    functionName: "getReserves",
  }) as [bigint, bigint];

  const lpBalance = await publicClient.readContract({
    address: swapAddress,
    abi: swapArtifact.abi,
    functionName: "balanceOf",
    args: [account.address],
  }) as bigint;

  const rate = await publicClient.readContract({
    address: swapAddress,
    abi: swapArtifact.abi,
    functionName: "exchangeRate",
  }) as bigint;

  console.log("\n" + "=".repeat(60));
  console.log("SUCCESS! Swap Pool is ready");
  console.log("=".repeat(60));
  console.log(`\nContracts:`);
  console.log(`  EURC: ${eurcAddress}`);
  console.log(`  StablecoinSwap: ${swapAddress}`);
  console.log(`\nPool State:`);
  console.log(`  USDC Reserve: ${formatEther(reserves[0])} USDC`);
  console.log(`  EURC Reserve: ${formatUnits(reserves[1], 6)} EURC`);
  console.log(`  Your LP Tokens: ${formatEther(lpBalance)}`);
  console.log(`  Exchange Rate: ${Number(rate) / 1e6} USD/EUR`);
  console.log(`  Swap Fee: 0.2%`);
  console.log(`\nAdd to constants.ts:`);
  console.log(`  SwapEURC: '${eurcAddress}' as \`0x\${string}\`,`);
  console.log(`  StablecoinSwap: '${swapAddress}' as \`0x\${string}\`,`);
  console.log(`\nExplorer:`);
  console.log(`  EURC: https://testnet.arcscan.app/address/${eurcAddress}`);
  console.log(`  Swap: https://testnet.arcscan.app/address/${swapAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
