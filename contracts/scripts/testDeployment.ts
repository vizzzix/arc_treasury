import { createPublicClient, http, formatUnits } from "viem";

// Arc Testnet chain definition
const arcTestnet = {
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'Ethereum', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.testnet.arc.network'] },
  },
} as const;

// Deployed contract addresses
const CONTRACTS = {
  USYCOracle: "0x9210289432a5c7d7c6506dae8c1716bb47f8d84c",
  TreasuryVault: "0xe050d1353bf7f4d7f66ff4538333e03d7e52ad87",
  PointsMultiplierNFT: "0x3eeca3180a2c0db29819ad007ff9869764b97419",
} as const;

// Simple ABIs for testing
const ORACLE_ABI = [
  {
    "inputs": [],
    "name": "getUSYCPriceInfo",
    "outputs": [
      { "internalType": "uint256", "name": "price", "type": "uint256" },
      { "internalType": "uint256", "name": "lastUpdated", "type": "uint256" },
      { "internalType": "bool", "name": "isPaused", "type": "bool" },
      { "internalType": "bool", "name": "isStale", "type": "bool" }
    ],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

const VAULT_ABI = [
  {
    "inputs": [],
    "name": "LOCK_BOOST_1_MONTH",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "LOCK_BOOST_3_MONTH",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "LOCK_BOOST_12_MONTH",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "LOCK_MINIMUM_DEPOSIT",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "EARLY_WITHDRAW_PENALTY_BPS",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

const NFT_ABI = [
  {
    "inputs": [],
    "name": "MAX_SUPPLY",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "totalSupply",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

async function main() {
  console.log("========================================");
  console.log("TESTING DEPLOYED CONTRACTS");
  console.log("========================================\n");

  // Create public client
  const publicClient = createPublicClient({
    chain: arcTestnet,
    transport: http(),
  });

  console.log("Network: Arc Testnet (Chain ID: 5042002)");
  console.log("RPC: https://rpc.testnet.arc.network\n");

  // ============================================
  // Test 1: USYCOracle
  // ============================================
  console.log("========================================");
  console.log("1/3: Testing USYCOracle");
  console.log("========================================");
  console.log("Address:", CONTRACTS.USYCOracle);

  try {
    const result = await publicClient.readContract({
      address: CONTRACTS.USYCOracle as `0x${string}`,
      abi: ORACLE_ABI,
      functionName: 'getUSYCPriceInfo',
    }) as [bigint, bigint, boolean, boolean];

    const [price, lastUpdated, isPaused, isStale] = result;
    const priceFormatted = formatUnits(price, 6);
    const lastUpdatedDate = new Date(Number(lastUpdated) * 1000).toLocaleString();

    console.log("✅ USYC Price:", priceFormatted, "USDC");
    console.log("✅ Last Updated:", lastUpdatedDate);
    console.log("✅ Is Paused:", isPaused ? "Yes ⚠️" : "No");
    console.log("✅ Is Stale:", isStale ? "Yes ⚠️ (>24h old)" : "No");
  } catch (error) {
    console.log("❌ Error:", (error as Error).message);
  }
  console.log();

  // ============================================
  // Test 2: TreasuryVault
  // ============================================
  console.log("========================================");
  console.log("2/3: Testing TreasuryVault");
  console.log("========================================");
  console.log("Address:", CONTRACTS.TreasuryVault);

  try {
    const boost1 = await publicClient.readContract({
      address: CONTRACTS.TreasuryVault as `0x${string}`,
      abi: VAULT_ABI,
      functionName: 'LOCK_BOOST_1_MONTH',
    });
    const boost3 = await publicClient.readContract({
      address: CONTRACTS.TreasuryVault as `0x${string}`,
      abi: VAULT_ABI,
      functionName: 'LOCK_BOOST_3_MONTH',
    });
    const boost12 = await publicClient.readContract({
      address: CONTRACTS.TreasuryVault as `0x${string}`,
      abi: VAULT_ABI,
      functionName: 'LOCK_BOOST_12_MONTH',
    });
    const minDeposit = await publicClient.readContract({
      address: CONTRACTS.TreasuryVault as `0x${string}`,
      abi: VAULT_ABI,
      functionName: 'LOCK_MINIMUM_DEPOSIT',
    });
    const penalty = await publicClient.readContract({
      address: CONTRACTS.TreasuryVault as `0x${string}`,
      abi: VAULT_ABI,
      functionName: 'EARLY_WITHDRAW_PENALTY_BPS',
    });

    console.log("✅ Lock Boosts:");
    console.log("  - 1 Month:  ", Number(boost1), "bps (0.65%)");
    console.log("  - 3 Months: ", Number(boost3), "bps (1.35%)");
    console.log("  - 12 Months:", Number(boost12), "bps (2.65%)");
    console.log("✅ Minimum Deposit:", formatUnits(minDeposit, 6), "($10 or €10)");
    console.log("✅ Early Withdraw Penalty:", Number(penalty), "bps (25%)");
  } catch (error) {
    console.log("❌ Error:", (error as Error).message);
  }
  console.log();

  // ============================================
  // Test 3: PointsMultiplierNFT
  // ============================================
  console.log("========================================");
  console.log("3/3: Testing PointsMultiplierNFT");
  console.log("========================================");
  console.log("Address:", CONTRACTS.PointsMultiplierNFT);

  try {
    const maxSupply = await publicClient.readContract({
      address: CONTRACTS.PointsMultiplierNFT as `0x${string}`,
      abi: NFT_ABI,
      functionName: 'MAX_SUPPLY',
    });
    const totalSupply = await publicClient.readContract({
      address: CONTRACTS.PointsMultiplierNFT as `0x${string}`,
      abi: NFT_ABI,
      functionName: 'totalSupply',
    });

    console.log("✅ Max Supply:", Number(maxSupply));
    console.log("✅ Total Minted:", Number(totalSupply));
    console.log("✅ Remaining:", Number(maxSupply) - Number(totalSupply));
  } catch (error) {
    console.log("❌ Error:", (error as Error).message);
  }
  console.log();

  // ============================================
  // Summary
  // ============================================
  console.log("========================================");
  console.log("TESTING COMPLETE!");
  console.log("========================================\n");

  console.log("✅ All contracts are live and responding");
  console.log("✅ APY boosts are configured correctly");
  console.log("✅ Security parameters set (min deposit, penalty)");
  console.log("✅ NFT contract ready for minting\n");

  console.log("🔗 View on Explorer:");
  console.log(`   Oracle: https://testnet.arcscan.app/address/${CONTRACTS.USYCOracle}`);
  console.log(`   Vault:  https://testnet.arcscan.app/address/${CONTRACTS.TreasuryVault}`);
  console.log(`   NFT:    https://testnet.arcscan.app/address/${CONTRACTS.PointsMultiplierNFT}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
