import { readFileSync } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BLOCKSCOUT_API = "https://explorer.testnet.arc.network/api";

// Contracts to verify
const CONTRACTS = [
  {
    name: "TreasuryVaultV7",
    address: "0xf3383ddbff25874ac0d660022468a79d8bc1cab3",
    sourcePath: "contracts/TreasuryVaultV7.sol",
    contractName: "TreasuryVaultV7",
  },
  {
    name: "USYCOracle",
    address: "0x5e6A0e0501a914DF06FB02A2C8f76fECd8f7300B",
    sourcePath: "contracts/USYCOracle.sol",
    contractName: "USYCOracle",
    constructorArgs: [
      "0xeD0037E27139a7792c7982640D045A9D9f2aAe8b", // priceUpdater
      "1100000", // initialPrice
    ],
  },
  {
    name: "ArcWUSDC",
    address: "0xa591674CC755Ac92e713964e1Db1AEA0316Ba1bf",
    sourcePath: "contracts/ArcWUSDC.sol",
    contractName: "ArcWUSDC",
  },
];

async function verifyWithStandardJson(contract: typeof CONTRACTS[0]) {
  console.log(`\n=== Verifying ${contract.name} ===`);
  console.log(`Address: ${contract.address}`);

  // Read the artifact to get the compiler input
  const artifactPath = resolve(
    __dirname,
    `../artifacts/${contract.sourcePath}/${contract.contractName}.json`
  );
  const artifact = JSON.parse(readFileSync(artifactPath, "utf-8"));

  // For Blockscout, we need to use flattened source
  const flatPath = resolve(__dirname, `../${contract.contractName}_flat.sol`);
  let sourceCode: string;

  try {
    sourceCode = readFileSync(flatPath, "utf-8");
  } catch {
    console.log(`Flattened file not found: ${flatPath}`);
    console.log(`Run: npx hardhat flatten ${contract.sourcePath} > ${contract.contractName}_flat.sol`);
    return;
  }

  // Remove duplicate SPDX license identifiers (keep only first one)
  const lines = sourceCode.split("\n");
  let firstSpdx = true;
  const cleanedLines = lines.filter((line) => {
    if (line.includes("SPDX-License-Identifier")) {
      if (firstSpdx) {
        firstSpdx = false;
        return true;
      }
      return false;
    }
    return true;
  });
  sourceCode = cleanedLines.join("\n");

  // Encode constructor arguments if any
  let constructorArgsEncoded = "";
  if (contract.constructorArgs) {
    // For simple types, encode manually
    // address + uint256
    const addr = contract.constructorArgs[0].slice(2).padStart(64, "0");
    const num = BigInt(contract.constructorArgs[1]).toString(16).padStart(64, "0");
    constructorArgsEncoded = addr + num;
  }

  const formData = new URLSearchParams();
  formData.append("module", "contract");
  formData.append("action", "verifysourcecode");
  formData.append("addressHash", contract.address);
  formData.append("name", contract.contractName);
  formData.append("compilerVersion", "v0.8.24+commit.e11b9ed9");
  formData.append("optimization", "true");
  formData.append("optimizationRuns", "200");
  formData.append("sourceCode", sourceCode);
  formData.append("evmVersion", "cancun");
  if (constructorArgsEncoded) {
    formData.append("constructorArguments", constructorArgsEncoded);
  }

  console.log("Submitting to Blockscout API...");
  console.log("Source code size:", sourceCode.length, "bytes");

  try {
    const response = await fetch(BLOCKSCOUT_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    const result = await response.json();
    console.log("Response:", JSON.stringify(result, null, 2));

    if (result.status === "1" || result.result) {
      console.log(`✅ ${contract.name} verification submitted!`);
      console.log(`GUID: ${result.result}`);
    } else {
      console.log(`❌ Verification failed: ${result.message || result.result}`);
    }
  } catch (error: any) {
    console.error("Error:", error.message);
  }
}

async function main() {
  console.log("=== Blockscout Contract Verification ===");
  console.log(`API: ${BLOCKSCOUT_API}\n`);

  // First, flatten all contracts
  console.log("Note: Make sure to flatten contracts first:");
  console.log("npx hardhat flatten contracts/TreasuryVaultV7.sol > TreasuryVaultV7_flat.sol");
  console.log("npx hardhat flatten contracts/USYCOracle.sol > USYCOracle_flat.sol");
  console.log("npx hardhat flatten contracts/ArcWUSDC.sol > ArcWUSDC_flat.sol");

  const contractName = process.argv[2];

  if (contractName) {
    const contract = CONTRACTS.find(
      (c) => c.name.toLowerCase() === contractName.toLowerCase()
    );
    if (contract) {
      await verifyWithStandardJson(contract);
    } else {
      console.log(`Contract "${contractName}" not found. Available: ${CONTRACTS.map((c) => c.name).join(", ")}`);
    }
  } else {
    console.log("\nUsage: npx tsx scripts/verifyContract.ts <contractName>");
    console.log("Available contracts:", CONTRACTS.map((c) => c.name).join(", "));
  }
}

main().catch(console.error);
