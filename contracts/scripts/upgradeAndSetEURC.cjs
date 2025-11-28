const { ethers, upgrades } = require("hardhat");

async function main() {
  const PROXY_ADDRESS = "0x17ca5232415430bC57F646A72fD15634807bF729";
  const CORRECT_EURC = "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a";

  console.log("Starting upgrade process...");
  console.log("Proxy address:", PROXY_ADDRESS);
  console.log("Correct EURC address:", CORRECT_EURC);

  // Get the new implementation
  const TreasuryVaultV8 = await ethers.getContractFactory("TreasuryVaultV8");

  // Upgrade the proxy
  console.log("\nUpgrading proxy to new implementation...");
  const upgraded = await upgrades.upgradeProxy(PROXY_ADDRESS, TreasuryVaultV8, {
    unsafeAllowRenames: true,
    unsafeSkipStorageCheck: true,
  });
  await upgraded.waitForDeployment();

  const implAddress = await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS);
  console.log("New implementation deployed at:", implAddress);

  // Call setEURC to fix the address
  console.log("\nCalling setEURC to fix EURC address...");
  const tx = await upgraded.setEURC(CORRECT_EURC);
  await tx.wait();
  console.log("setEURC transaction:", tx.hash);

  // Verify the change
  const newEurcAddress = await upgraded.eurc();
  console.log("\nNew EURC address in contract:", newEurcAddress);
  console.log("Expected:", CORRECT_EURC);
  console.log("Match:", newEurcAddress.toLowerCase() === CORRECT_EURC.toLowerCase() ? "✓ SUCCESS" : "✗ FAILED");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
