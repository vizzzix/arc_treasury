import { createWalletClient, createPublicClient, http, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { readFileSync } from "fs";
import { join } from "path";

// Arc Testnet chain definition
const arcTestnet = {
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'Ethereum', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.testnet.arc.network'] },
  },
} as const;

async function main() {
  console.log("========================================");
  console.log("DEPLOYING ALL TREASURY CONTRACTS");
  console.log("========================================\n");

  // Token addresses on Arc Testnet
  const USDC_ADDRESS = "0x3600000000000000000000000000000000000000"; // Native USDC
  const EURC_ADDRESS = "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a"; // EURC
  const USYC_ADDRESS = "0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C"; // USYC
  const ENTITLEMENTS_ADDRESS = "0xcc205224862c7641930c87679e98999d23c26113"; // Entitlements

  // Treasury operator (allowlisted address)
  const TREASURY_OPERATOR = "0xB66D4229Bb5A82De94610d63677cF5370e6a81cb";

  // Platform fee: 0.5% = 50 basis points
  const PLATFORM_FEE_BPS = 50n;

  // Initial USYC price (1 USYC = 1 USDC)
  const INITIAL_USYC_PRICE = parseUnits("1", 6);

  // NFT Base URI
  const NFT_BASE_URI = "https://arctreasury-in6naui1r-claimpilots-projects.vercel.app/nft/";

  // Setup account from private key
  const privateKey = process.env.PRIVATE_KEY as `0x${string}`;
  if (!privateKey) {
    throw new Error("PRIVATE_KEY not set");
  }
  const account = privateKeyToAccount(privateKey);

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

  console.log("Deploying from:", account.address);
  const balance = await publicClient.getBalance({ address: account.address });
  console.log("Balance:", (Number(balance) / 1e18).toFixed(4), "ETH\n");

  // Read compiled contracts
  console.log("Reading compiled contract artifacts...");
  const oracleArtifact = JSON.parse(
    readFileSync(join(process.cwd(), "artifacts/contracts/USYCOracle.sol/USYCOracle.json"), "utf-8")
  );
  const vaultArtifact = JSON.parse(
    readFileSync(join(process.cwd(), "artifacts/contracts/TreasuryVault.sol/TreasuryVault.json"), "utf-8")
  );
  const nftArtifact = JSON.parse(
    readFileSync(join(process.cwd(), "artifacts/contracts/PointsMultiplierNFT.sol/PointsMultiplierNFT.json"), "utf-8")
  );
  console.log("✓ Artifacts loaded\n");

  // ============================================
  // 1. Deploy USYCOracle
  // ============================================
  console.log("========================================");
  console.log("1/3: Deploying USYCOracle");
  console.log("========================================");
  console.log("  Owner:", account.address);
  console.log("  Initial Price:", INITIAL_USYC_PRICE.toString(), "(1 USDC)");

  const oracleHash = await walletClient.deployContract({
    abi: oracleArtifact.abi,
    bytecode: oracleArtifact.bytecode as `0x${string}`,
    args: [account.address, INITIAL_USYC_PRICE],
  });
  console.log("  Tx:", oracleHash);

  const oracleReceipt = await publicClient.waitForTransactionReceipt({ hash: oracleHash });
  const oracleAddress = oracleReceipt.contractAddress!;
  console.log("✓ USYCOracle deployed:", oracleAddress);
  console.log("  Explorer:", `https://testnet.arcscan.app/address/${oracleAddress}\n`);

  // ============================================
  // 2. Deploy PointsMultiplierNFT
  // ============================================
  console.log("========================================");
  console.log("2/3: Deploying PointsMultiplierNFT");
  console.log("========================================");
  console.log("  Owner:", account.address);
  console.log("  Base URI:", NFT_BASE_URI);
  console.log("  Max Supply: 2000 (rare)");

  const nftHash = await walletClient.deployContract({
    abi: nftArtifact.abi,
    bytecode: nftArtifact.bytecode as `0x${string}`,
    args: [account.address, NFT_BASE_URI],
  });
  console.log("  Tx:", nftHash);

  const nftReceipt = await publicClient.waitForTransactionReceipt({ hash: nftHash });
  const nftAddress = nftReceipt.contractAddress!;
  console.log("✓ PointsMultiplierNFT deployed:", nftAddress);
  console.log("  Explorer:", `https://testnet.arcscan.app/address/${nftAddress}\n`);

  // ============================================
  // 3. Deploy TreasuryVault
  // ============================================
  console.log("========================================");
  console.log("3/3: Deploying TreasuryVault");
  console.log("========================================");
  console.log("  USDC:", USDC_ADDRESS);
  console.log("  EURC:", EURC_ADDRESS);
  console.log("  USYC:", USYC_ADDRESS);
  console.log("  Entitlements:", ENTITLEMENTS_ADDRESS);
  console.log("  Oracle:", oracleAddress);
  console.log("  Operator:", TREASURY_OPERATOR);
  console.log("  Platform Fee:", PLATFORM_FEE_BPS.toString(), "bps (0.5%)");

  const vaultHash = await walletClient.deployContract({
    abi: vaultArtifact.abi,
    bytecode: vaultArtifact.bytecode as `0x${string}`,
    args: [
      USDC_ADDRESS,
      EURC_ADDRESS,
      USYC_ADDRESS,
      ENTITLEMENTS_ADDRESS,
      oracleAddress,
      TREASURY_OPERATOR,
      PLATFORM_FEE_BPS,
    ],
  });
  console.log("  Tx:", vaultHash);

  const vaultReceipt = await publicClient.waitForTransactionReceipt({ hash: vaultHash });
  const vaultAddress = vaultReceipt.contractAddress!;
  console.log("✓ TreasuryVault deployed:", vaultAddress);
  console.log("  Explorer:", `https://testnet.arcscan.app/address/${vaultAddress}\n`);

  // ============================================
  // DEPLOYMENT SUMMARY
  // ============================================
  console.log("========================================");
  console.log("DEPLOYMENT COMPLETE!");
  console.log("========================================\n");

  console.log("📋 Contract Addresses:\n");
  console.log("USYCOracle:          ", oracleAddress);
  console.log("TreasuryVault:       ", vaultAddress);
  console.log("PointsMultiplierNFT: ", nftAddress);

  console.log("\n🔗 Explorers:\n");
  console.log("USYCOracle:          ", `https://testnet.arcscan.app/address/${oracleAddress}`);
  console.log("TreasuryVault:       ", `https://testnet.arcscan.app/address/${vaultAddress}`);
  console.log("PointsMultiplierNFT: ", `https://testnet.arcscan.app/address/${nftAddress}`);

  console.log("\n⚙️  Configuration:\n");
  console.log("Treasury Operator:   ", TREASURY_OPERATOR);
  console.log("Platform Fee:        ", PLATFORM_FEE_BPS.toString(), "bps (0.5%)");
  console.log("NFT Base URI:        ", NFT_BASE_URI);

  console.log("\n📝 Update constants.ts with these addresses:");
  console.log("========================================");
  console.log(`export const TREASURY_CONTRACTS = {
  USYCOracle: '${oracleAddress}' as \`0x\${string}\`,
  TreasuryVault: '${vaultAddress}' as \`0x\${string}\`,
  PointsMultiplierNFT: '${nftAddress}' as \`0x\${string}\`,
} as const;`);
  console.log("========================================\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
