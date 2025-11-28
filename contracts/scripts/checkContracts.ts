import hre from "hardhat";
import { createPublicClient, http, formatUnits } from "viem";
import { defineChain } from "viem";

// Arc Testnet chain definition
const arcTestnet = defineChain({
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'Ethereum', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.testnet.arc.network'] },
  },
  blockExplorers: {
    default: { name: 'Arc Explorer', url: 'https://testnet.arcscan.app' },
  },
  testnet: true,
});

// Contract addresses
const USYCOracle_ADDRESS = "0xc0201ecbfaca55d43ba029c104030036a595e698"; // Redeployed with refreshUserPoints and oracle protection
const TreasuryVault_ADDRESS = "0x786570404eabef33fdede4996bbaa3512bdf4cbd"; // Redeployed with refreshUserPoints, oracle protection, and fixed points logic
const ENTITLEMENTS_ADDRESS = "0xcc205224862c7641930c87679e98999d23c26113";

// ABIs (simplified for read functions)
const USYCOracle_ABI = [
  {
    inputs: [],
    name: "getUSYCPrice",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "lastUpdateTime",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "priceUpdater",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

const TreasuryVault_ABI = [
  {
    inputs: [],
    name: "getTotalPoolValue",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getPricePerShare",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "totalShares",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "totalUSDC",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "totalUSYC",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "treasuryOperator",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "platformFeeBps",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "isNativeUSDC",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

const Entitlements_ABI = [
  {
    inputs: [{ name: "account", type: "address" }],
    name: "isEntitled",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

async function main() {
  console.log("Checking deployed contracts on Arc Testnet...\n");

  const publicClient = createPublicClient({
    chain: arcTestnet,
    transport: http('https://rpc.testnet.arc.network'),
  });

  // Check USYCOracle
  console.log("=== USYCOracle Contract ===");
  console.log(`Address: ${USYCOracle_ADDRESS}`);
  try {
    const usycPrice = await publicClient.readContract({
      address: USYCOracle_ADDRESS as `0x${string}`,
      abi: USYCOracle_ABI,
      functionName: "getUSYCPrice",
    });
    console.log(`✓ USYC Price: ${formatUnits(usycPrice, 6)} USDC`);

    const lastUpdate = await publicClient.readContract({
      address: USYCOracle_ADDRESS as `0x${string}`,
      abi: USYCOracle_ABI,
      functionName: "lastUpdateTime",
    });
    const updateDate = new Date(Number(lastUpdate) * 1000);
    console.log(`✓ Last Update: ${updateDate.toLocaleString()}`);

    const priceUpdater = await publicClient.readContract({
      address: USYCOracle_ADDRESS as `0x${string}`,
      abi: USYCOracle_ABI,
      functionName: "priceUpdater",
    });
    console.log(`✓ Price Updater: ${priceUpdater}`);
  } catch (error: any) {
    console.error(`✗ Error reading USYCOracle: ${error.message}`);
  }

  // Check TreasuryVault
  console.log("\n=== TreasuryVault Contract ===");
  console.log(`Address: ${TreasuryVault_ADDRESS}`);
  try {
    const totalPoolValue = await publicClient.readContract({
      address: TreasuryVault_ADDRESS as `0x${string}`,
      abi: TreasuryVault_ABI,
      functionName: "getTotalPoolValue",
    });
    console.log(`✓ Total Pool Value: ${formatUnits(totalPoolValue, 6)} USDC`);

    const pricePerShare = await publicClient.readContract({
      address: TreasuryVault_ADDRESS as `0x${string}`,
      abi: TreasuryVault_ABI,
      functionName: "getPricePerShare",
    });
    console.log(`✓ Price Per Share: ${formatUnits(pricePerShare, 6)} USDC`);

    const totalShares = await publicClient.readContract({
      address: TreasuryVault_ADDRESS as `0x${string}`,
      abi: TreasuryVault_ABI,
      functionName: "totalShares",
    });
    console.log(`✓ Total Shares: ${totalShares.toString()}`);

    const totalUSDC = await publicClient.readContract({
      address: TreasuryVault_ADDRESS as `0x${string}`,
      abi: TreasuryVault_ABI,
      functionName: "totalUSDC",
    });
    console.log(`✓ Total USDC in Pool: ${formatUnits(totalUSDC, 6)} USDC`);

    const totalUSYC = await publicClient.readContract({
      address: TreasuryVault_ADDRESS as `0x${string}`,
      abi: TreasuryVault_ABI,
      functionName: "totalUSYC",
    });
    console.log(`✓ Total USYC: ${formatUnits(totalUSYC, 6)} USYC`);

    const treasuryOperator = await publicClient.readContract({
      address: TreasuryVault_ADDRESS as `0x${string}`,
      abi: TreasuryVault_ABI,
      functionName: "treasuryOperator",
    });
    console.log(`✓ Treasury Operator: ${treasuryOperator}`);

    const platformFee = await publicClient.readContract({
      address: TreasuryVault_ADDRESS as `0x${string}`,
      abi: TreasuryVault_ABI,
      functionName: "platformFeeBps",
    });
    console.log(`✓ Platform Fee: ${platformFee.toString()} bps (${Number(platformFee) / 100}%)`);

    const isNativeUSDC = await publicClient.readContract({
      address: TreasuryVault_ADDRESS as `0x${string}`,
      abi: TreasuryVault_ABI,
      functionName: "isNativeUSDC",
    });
    console.log(`✓ Native USDC Support: ${isNativeUSDC ? 'Yes' : 'No'}`);
  } catch (error: any) {
    console.error(`✗ Error reading TreasuryVault: ${error.message}`);
  }

  // Check Entitlements
  console.log("\n=== Entitlements Contract ===");
  console.log(`Address: ${ENTITLEMENTS_ADDRESS}`);
  const testAddress = "0xB66D4229Bb5A82De94610d63677cF5370e6a81cb";
  try {
    const isEntitled = await publicClient.readContract({
      address: ENTITLEMENTS_ADDRESS as `0x${string}`,
      abi: Entitlements_ABI,
      functionName: "isEntitled",
      args: [testAddress as `0x${string}`],
    });
    console.log(`✓ Address ${testAddress} is entitled: ${isEntitled}`);
  } catch (error: any) {
    console.error(`✗ Error reading Entitlements: ${error.message}`);
  }

  console.log("\n=== Contract Links ===");
  console.log(`USYCOracle: https://testnet.arcscan.app/address/${USYCOracle_ADDRESS}`);
  console.log(`TreasuryVault: https://testnet.arcscan.app/address/${TreasuryVault_ADDRESS}`);
  console.log(`Entitlements: https://testnet.arcscan.app/address/${ENTITLEMENTS_ADDRESS}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

