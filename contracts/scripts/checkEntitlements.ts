import hre from "hardhat";

async function main() {
  console.log("🔍 Checking Entitlements allowlist...\n");

  const ENTITLEMENTS_ADDRESS = "0xcc205224862c7641930c87679e98999d23c26113";
  const ADDRESS_TO_CHECK = "0xB66D4229Bb5A82De94610d63677cF5370e6a81cb";

  const { viem } = await hre.network.connect();
  const publicClient = await viem.getPublicClient();

  console.log("📝 Entitlements contract:", ENTITLEMENTS_ADDRESS);
  console.log("📝 Checking address:", ADDRESS_TO_CHECK);
  console.log();

  // Try to get contract code
  console.log("🔍 Verifying contract exists...");
  const code = await publicClient.getCode({ address: ENTITLEMENTS_ADDRESS as `0x${string}` });

  if (!code || code === "0x") {
    console.log("❌ No contract found at this address!");
    return;
  }

  console.log("✅ Contract exists (code length:", code.length, "bytes)");
  console.log();

  // Try different possible function names
  const functionsToTry = [
    { name: "isEntitled", selector: "0x" + Buffer.from("isEntitled(address)").toString('hex').substring(0, 8) },
    { name: "isAllowlisted", selector: "0x" + Buffer.from("isAllowlisted(address)").toString('hex').substring(0, 8) },
    { name: "hasPermission", selector: "0x" + Buffer.from("hasPermission(address)").toString('hex').substring(0, 8) },
    { name: "checkEntitlement", selector: "0x" + Buffer.from("checkEntitlement(address)").toString('hex').substring(0, 8) },
  ];

  console.log("🔍 Trying different function signatures...\n");

  // Method 1: Try with IEntitlements interface
  try {
    console.log("Method 1: Using IEntitlements.isEntitled()");
    const entitlements = await viem.getContractAt("IEntitlements", ENTITLEMENTS_ADDRESS);
    const result = await entitlements.read.isEntitled([ADDRESS_TO_CHECK]);
    console.log("✅ Result:", result);
    console.log();

    if (result) {
      console.log("✅ Address IS in allowlist!");
    } else {
      console.log("❌ Address is NOT in allowlist");
    }
    return;
  } catch (error: any) {
    console.log("❌ Failed:", error.message.split('\n')[0]);
    console.log();
  }

  // Method 2: Try raw call
  try {
    console.log("Method 2: Raw call with isEntitled selector");

    // Encode function call: isEntitled(address)
    const functionSignature = "isEntitled(address)";
    const selector = "0x" + Buffer.from(
      hre.ethers.keccak256(Buffer.from(functionSignature)).substring(2, 10)
    ).toString('hex');

    const encodedAddress = ADDRESS_TO_CHECK.substring(2).padStart(64, '0');
    const calldata = selector + encodedAddress;

    console.log("   Selector:", selector);
    console.log("   Calldata:", calldata);

    const result = await publicClient.call({
      to: ENTITLEMENTS_ADDRESS as `0x${string}`,
      data: calldata as `0x${string}`,
    });

    console.log("✅ Raw result:", result);
    console.log();
  } catch (error: any) {
    console.log("❌ Failed:", error.message.split('\n')[0]);
    console.log();
  }

  // Method 3: Try to read contract storage
  console.log("Method 3: Check contract storage");
  try {
    // Read first few storage slots
    for (let i = 0; i < 5; i++) {
      const slot = await publicClient.getStorageAt({
        address: ENTITLEMENTS_ADDRESS as `0x${string}`,
        slot: `0x${i.toString(16).padStart(64, '0')}` as `0x${string}`,
      });
      console.log(`   Slot ${i}:`, slot);
    }
  } catch (error: any) {
    console.log("❌ Failed:", error.message.split('\n')[0]);
  }

  console.log();
  console.log("=" .repeat(60));
  console.log("💡 RECOMMENDATION:");
  console.log("=".repeat(60));
  console.log();
  console.log("The Entitlements contract interface may be different.");
  console.log("Please check Arc Testnet documentation for:");
  console.log();
  console.log("1. Actual Entitlements contract address");
  console.log("2. Correct function name for checking allowlist");
  console.log("3. How to get your address allowlisted");
  console.log();
  console.log("Or consider using the operator address directly for testing");
  console.log("without Entitlements checks (modify TreasuryVault if needed).");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Script failed:");
    console.error(error);
    process.exit(1);
  });
