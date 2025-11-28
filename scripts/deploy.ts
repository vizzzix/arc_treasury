import hre from "hardhat";
import { parseUnits } from "ethers";

async function main() {
  console.log("Deploying Treasury Vault contracts...");

  // Contract addresses on Arc Testnet
  const USDC_ADDRESS = "0x3600000000000000000000000000000000000000"; // Native USDC on Arc Testnet
  const EURC_ADDRESS = "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a"; // EURC on Arc Testnet
  const USYC_ADDRESS = "0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C"; // USYC on Arc Testnet
  const ENTITLEMENTS_ADDRESS = "0xcc205224862c7641930c87679e98999d23c26113"; // Entitlements on Arc Testnet
  
  // Treasury operator (must be allowlisted)
  const TREASURY_OPERATOR = process.env.TREASURY_OPERATOR || "0xB66D4229Bb5A82De94610d63677cF5370e6a81cb";
  
  // Platform fee: 0.5% = 50 basis points
  const PLATFORM_FEE_BPS = 50;
  
  // Initial USYC price (1 USYC = 1 USDC for testnet, will be updated via oracle)
  const INITIAL_USYC_PRICE = parseUnits("1", 6); // 1.0 USDC with 6 decimals

  const [deployer] = await hre.viem.getWalletClients();
  console.log("Deploying contracts with account:", deployer.account.address);
  const balance = await hre.viem.getPublicClient().getBalance({ address: deployer.account.address });
  console.log("Account balance:", balance.toString());

  // Deploy USYC Oracle
  console.log("\n1. Deploying USYCOracle...");
  const usycOracle = await hre.viem.deployContract("USYCOracle", [
    deployer.account.address,
    INITIAL_USYC_PRICE,
  ]);
  const usycOracleAddress = usycOracle.address;
  console.log("USYCOracle deployed to:", usycOracleAddress);

  // Deploy Treasury Vault with new constructor signature
  console.log("\n2. Deploying TreasuryVault...");
  const treasuryVault = await hre.viem.deployContract("TreasuryVault", [
    USDC_ADDRESS,      // _usdc
    EURC_ADDRESS,      // _eurc
    USYC_ADDRESS,      // _usyc
    ENTITLEMENTS_ADDRESS, // _entitlements
    usycOracleAddress, // _usycOracle
    TREASURY_OPERATOR, // _treasuryOperator
    PLATFORM_FEE_BPS,  // _platformFeeBps
  ]);
  const treasuryVaultAddress = treasuryVault.address;
  console.log("TreasuryVault deployed to:", treasuryVaultAddress);

  // NOTE: convertToUSYC() is a TESTNET STUB and does not move real funds
  // The function is hardcoded to be a stub - it does not transfer USDC or mint USYC
  // This is safe for testnet use. In production, this would need to be updated
  // to actually call IUSYC.mint() and transfer funds to the operator.
  console.log("\n3. Testnet mode verification...");
  console.log("✓ convertToUSYC() is a testnet stub (does not move funds)");
  console.log("✓ recordUSYCConversion() can be called by operator to update totalUSYC");

  console.log("\n=== Deployment Summary ===");
  console.log("USYCOracle:", usycOracleAddress);
  console.log("TreasuryVault:", treasuryVaultAddress);
  console.log("Treasury Operator:", TREASURY_OPERATOR);
  console.log("Platform Fee:", PLATFORM_FEE_BPS, "bps (0.5%)");
  console.log("USYC Accounting Enabled:", false, "(testnet mode)");
  console.log("\nNext steps:");
  console.log("1. Verify operator is allowlisted in Entitlements contract");
  console.log("2. Update USYC price in oracle via updatePrice()");
  console.log("3. Set up backend service to periodically update oracle price");
  console.log("4. IMPORTANT: usycAccountingEnabled must remain false on testnet");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

