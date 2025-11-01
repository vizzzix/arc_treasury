const hre = require("hardhat");
const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Starting deployment to Arc Network...\n");

  // Get deployer account
  let deployer;
  try {
    const signers = await ethers.getSigners();
    if (!signers || signers.length === 0) {
      console.error("❌ No accounts found! Make sure you have:");
      console.error("   1. Private key in .env file");
      console.error("   2. Or running on localhost with funded accounts");
      process.exit(1);
    }
    deployer = signers[0];
    console.log("Deploying contracts with account:", deployer.address);
    
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("Account balance:", ethers.formatEther(balance), "ETH\n");
    
    // Check if balance is zero
    if (balance === 0n) {
      console.error("⚠️  WARNING: Account balance is 0!");
      console.error("   For Arc Testnet: Get USDC from https://faucet.circle.com");
      console.error("   Your address:", deployer.address);
      console.error("\n");
    }
  } catch (error) {
    console.error("❌ Error getting deployer account:", error.message);
    console.error("\nMake sure:");
    console.error("  1. .env file exists with PRIVATE_KEY");
    console.error("  2. Or you're running on localhost network");
    process.exit(1);
  }

  // Deploy Mock Tokens
  console.log("📦 Deploying Mock Tokens...");
  
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  
  const usdc = await MockERC20.deploy("USD Coin", "USDC", 6);
  await usdc.waitForDeployment();
  console.log("✅ USDC deployed to:", await usdc.getAddress());

  const eurc = await MockERC20.deploy("Euro Coin", "EURC", 6);
  await eurc.waitForDeployment();
  console.log("✅ EURC deployed to:", await eurc.getAddress());

  const xsgd = await MockERC20.deploy("Singapore Dollar", "XSGD", 6);
  await xsgd.waitForDeployment();
  console.log("✅ XSGD deployed to:", await xsgd.getAddress());

  console.log();

  // Deploy SwapRouter
  console.log("🔄 Deploying SwapRouter...");
  const SwapRouter = await ethers.getContractFactory("SwapRouter");
  const swapRouter = await SwapRouter.deploy();
  await swapRouter.waitForDeployment();
  console.log("✅ SwapRouter deployed to:", await swapRouter.getAddress());
  console.log();

  // Deploy YieldAggregator
  console.log("💰 Deploying YieldAggregator...");
  const YieldAggregator = await ethers.getContractFactory("YieldAggregator");
  const yieldAggregator = await YieldAggregator.deploy();
  await yieldAggregator.waitForDeployment();
  console.log("✅ YieldAggregator deployed to:", await yieldAggregator.getAddress());
  console.log();

  // Deploy AITreasury
  console.log("🏦 Deploying AITreasury...");
  const AITreasury = await ethers.getContractFactory("AITreasury");
  const aiTreasury = await AITreasury.deploy(
    await swapRouter.getAddress(),
    await yieldAggregator.getAddress()
  );
  await aiTreasury.waitForDeployment();
  console.log("✅ AITreasury deployed to:", await aiTreasury.getAddress());
  console.log();

  // Deploy StrategyManager
  console.log("📊 Deploying StrategyManager...");
  const StrategyManager = await ethers.getContractFactory("StrategyManager");
  const strategyManager = await StrategyManager.deploy();
  await strategyManager.waitForDeployment();
  console.log("✅ StrategyManager deployed to:", await strategyManager.getAddress());
  console.log();

  // Setup: Add supported tokens
  console.log("⚙️  Configuring AITreasury...");
  await aiTreasury.addSupportedToken(await usdc.getAddress());
  await aiTreasury.addSupportedToken(await eurc.getAddress());
  await aiTreasury.addSupportedToken(await xsgd.getAddress());
  console.log("✅ Tokens added to supported list");
  console.log();

  // Setup: Set exchange rates (near 1:1 for stablecoins)
  console.log("💱 Setting exchange rates...");
  const RATE_PRECISION = ethers.parseEther("1");
  
  // USDC rates
  await swapRouter.setExchangeRate(await usdc.getAddress(), await eurc.getAddress(), RATE_PRECISION);
  await swapRouter.setExchangeRate(await usdc.getAddress(), await xsgd.getAddress(), RATE_PRECISION);
  
  // EURC rates
  await swapRouter.setExchangeRate(await eurc.getAddress(), await usdc.getAddress(), RATE_PRECISION);
  await swapRouter.setExchangeRate(await eurc.getAddress(), await xsgd.getAddress(), RATE_PRECISION);
  
  // XSGD rates
  await swapRouter.setExchangeRate(await xsgd.getAddress(), await usdc.getAddress(), RATE_PRECISION);
  await swapRouter.setExchangeRate(await xsgd.getAddress(), await eurc.getAddress(), RATE_PRECISION);
  console.log("✅ Exchange rates set");
  console.log();

  // Setup: Set APYs
  console.log("📈 Setting yield APYs...");
  const APY_4_PERCENT = ethers.parseEther("0.04"); // 4%
  const APY_5_PERCENT = ethers.parseEther("0.05"); // 5%
  const APY_3_PERCENT = ethers.parseEther("0.03"); // 3%
  
  await yieldAggregator.setAPY(await usdc.getAddress(), APY_4_PERCENT);
  await yieldAggregator.setAPY(await eurc.getAddress(), APY_5_PERCENT);
  await yieldAggregator.setAPY(await xsgd.getAddress(), APY_3_PERCENT);
  console.log("✅ APYs configured");
  console.log();

  // Create strategy templates
  console.log("📋 Creating strategy templates...");
  
  const tokens = [await usdc.getAddress(), await eurc.getAddress(), await xsgd.getAddress()];
  
  await strategyManager.createStrategy(
    "Conservative",
    "Low risk, stable returns with 70% USDC allocation",
    tokens,
    [7000, 2000, 1000], // 70% USDC, 20% EURC, 10% XSGD
    500, // 5% threshold
    true
  );
  
  await strategyManager.createStrategy(
    "Balanced",
    "Moderate risk and returns with balanced allocation",
    tokens,
    [5000, 3000, 2000], // 50% USDC, 30% EURC, 20% XSGD
    300, // 3% threshold
    true
  );
  
  await strategyManager.createStrategy(
    "Aggressive",
    "Higher risk, higher rewards with diversified allocation",
    tokens,
    [3000, 4000, 3000], // 30% USDC, 40% EURC, 30% XSGD
    200, // 2% threshold
    true
  );
  console.log("✅ Strategies created");
  console.log();

  // Mint test tokens to deployer
  console.log("🪙 Minting test tokens to deployer...");
  const MINT_AMOUNT = ethers.parseUnits("1000000", 6); // 1M tokens with 6 decimals
  
  await usdc.mint(deployer.address, MINT_AMOUNT);
  await eurc.mint(deployer.address, MINT_AMOUNT);
  await xsgd.mint(deployer.address, MINT_AMOUNT);
  console.log("✅ Test tokens minted");
  console.log();

  // Provide liquidity to SwapRouter
  console.log("💧 Providing liquidity to SwapRouter...");
  const LIQUIDITY_AMOUNT = ethers.parseUnits("500000", 6); // 500K per token
  
  await usdc.approve(await swapRouter.getAddress(), LIQUIDITY_AMOUNT);
  await eurc.approve(await swapRouter.getAddress(), LIQUIDITY_AMOUNT);
  await xsgd.approve(await swapRouter.getAddress(), LIQUIDITY_AMOUNT);
  
  await swapRouter.provideLiquidity(await usdc.getAddress(), LIQUIDITY_AMOUNT);
  await swapRouter.provideLiquidity(await eurc.getAddress(), LIQUIDITY_AMOUNT);
  await swapRouter.provideLiquidity(await xsgd.getAddress(), LIQUIDITY_AMOUNT);
  console.log("✅ Liquidity provided");
  console.log();

  // Summary
  console.log("=" .repeat(60));
  console.log("🎉 DEPLOYMENT COMPLETE!");
  console.log("=" .repeat(60));
  console.log("\n📋 Contract Addresses:\n");
  console.log("USDC:              ", await usdc.getAddress());
  console.log("EURC:              ", await eurc.getAddress());
  console.log("XSGD:              ", await xsgd.getAddress());
  console.log("SwapRouter:        ", await swapRouter.getAddress());
  console.log("YieldAggregator:   ", await yieldAggregator.getAddress());
  console.log("AITreasury:        ", await aiTreasury.getAddress());
  console.log("StrategyManager:   ", await strategyManager.getAddress());
  console.log("\n" + "=".repeat(60));
  
  // Save addresses to file for frontend
  const fs = require("fs");
  const addresses = {
    usdc: await usdc.getAddress(),
    eurc: await eurc.getAddress(),
    xsgd: await xsgd.getAddress(),
    swapRouter: await swapRouter.getAddress(),
    yieldAggregator: await yieldAggregator.getAddress(),
    aiTreasury: await aiTreasury.getAddress(),
    strategyManager: await strategyManager.getAddress(),
    deployer: deployer.address,
    network: hre.network.name,
    chainId: (await ethers.provider.getNetwork()).chainId.toString(),
  };

  // Ensure directory exists
  const path = require("path");
  const dir = path.dirname("src/contracts/addresses.json");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(
    "src/contracts/addresses.json",
    JSON.stringify(addresses, null, 2)
  );
  console.log("\n✅ Contract addresses saved to src/contracts/addresses.json");
  
  // Also create TypeScript file
  const tsContent = `// Auto-generated contract addresses - DO NOT EDIT MANUALLY
// Generated on: ${new Date().toISOString()}

export const CONTRACT_ADDRESSES = ${JSON.stringify(addresses, null, 2)
    .replace(/"([^"]+)":/g, '$1:')
    .replace(/"/g, '"')};

export const SUPPORTED_NETWORKS = {
  localhost: 31337,
  arcTestnet: ${addresses.chainId},
};
`;

  fs.writeFileSync(
    "src/contracts/contractAddresses.ts",
    tsContent
  );
  console.log("✅ TypeScript addresses updated in src/contracts/contractAddresses.ts");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

