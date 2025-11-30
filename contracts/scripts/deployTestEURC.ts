/**
 * Deploy TestEURC token on Arc Testnet
 *
 * Usage:
 * cd contracts
 * PRIVATE_KEY=your_key npx hardhat run scripts/deployTestEURC.ts --network arcTestnet
 */

import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("=".repeat(60));
  console.log("Deploying TestEURC to Arc Testnet");
  console.log("=".repeat(60));
  console.log(`Deployer: ${deployer.address}`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Balance: ${ethers.formatEther(balance)} USDC`);

  // Deploy TestEURC
  console.log("\nDeploying TestEURC...");
  const TestEURC = await ethers.getContractFactory("TestEURC");
  const testEURC = await TestEURC.deploy();
  await testEURC.waitForDeployment();

  const address = await testEURC.getAddress();
  console.log(`TestEURC deployed to: ${address}`);

  // Check initial supply
  const totalSupply = await testEURC.totalSupply();
  const decimals = await testEURC.decimals();
  console.log(`Total supply: ${ethers.formatUnits(totalSupply, decimals)} tEURC`);

  console.log("\n" + "=".repeat(60));
  console.log("SUCCESS!");
  console.log("=".repeat(60));
  console.log(`\nAdd this to constants.ts:`);
  console.log(`TestEURC: '${address}' as \`0x\${string}\`,`);
  console.log(`\nExplorer: https://testnet.arcscan.app/address/${address}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
