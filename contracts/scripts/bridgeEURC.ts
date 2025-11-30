/**
 * Bridge EURC from Sepolia to Arc Testnet via Circle CCTP V2
 *
 * Usage:
 * PRIVATE_KEY=your_key npx hardhat run scripts/bridgeEURC.ts --network ethereumSepolia
 */

import { ethers } from "hardhat";

// CCTP V2 Contract addresses on Sepolia
const CCTP_SEPOLIA = {
  TokenMessenger: "0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5", // CCTP V2
  EURC: "0x08210F9170F89Ab7658F0B5E3fF39b0E03C594D4",
};

// Arc Testnet domain for CCTP
const ARC_TESTNET_DOMAIN = 26;

// Amount to bridge (in EURC with 6 decimals)
const AMOUNT_TO_BRIDGE = "500"; // 500 EURC

// ERC20 ABI for approve and balanceOf
const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
];

// TokenMessenger ABI for depositForBurn
const TOKEN_MESSENGER_ABI = [
  "function depositForBurn(uint256 amount, uint32 destinationDomain, bytes32 mintRecipient, address burnToken) external returns (uint64 nonce)",
];

async function main() {
  const [signer] = await ethers.getSigners();
  const address = await signer.getAddress();

  console.log("=".repeat(60));
  console.log("Bridge EURC: Sepolia → Arc Testnet");
  console.log("=".repeat(60));
  console.log(`Wallet: ${address}`);

  // Connect to EURC token
  const eurc = new ethers.Contract(CCTP_SEPOLIA.EURC, ERC20_ABI, signer);

  // Check balance
  const balance = await eurc.balanceOf(address);
  const decimals = await eurc.decimals();
  console.log(`EURC Balance: ${ethers.formatUnits(balance, decimals)} EURC`);

  const amountWei = ethers.parseUnits(AMOUNT_TO_BRIDGE, decimals);

  if (balance < amountWei) {
    console.error(`Insufficient balance! Need ${AMOUNT_TO_BRIDGE} EURC`);
    return;
  }

  // Connect to TokenMessenger
  const tokenMessenger = new ethers.Contract(
    CCTP_SEPOLIA.TokenMessenger,
    TOKEN_MESSENGER_ABI,
    signer
  );

  // Check current allowance
  const currentAllowance = await eurc.allowance(address, CCTP_SEPOLIA.TokenMessenger);
  console.log(`Current allowance: ${ethers.formatUnits(currentAllowance, decimals)} EURC`);

  // Approve if needed
  if (currentAllowance < amountWei) {
    console.log(`\nApproving ${AMOUNT_TO_BRIDGE} EURC for TokenMessenger...`);
    const approveTx = await eurc.approve(CCTP_SEPOLIA.TokenMessenger, amountWei);
    console.log(`Approve tx: ${approveTx.hash}`);
    await approveTx.wait();
    console.log("Approved!");
  }

  // Convert address to bytes32 for mintRecipient
  // Pad address to 32 bytes (left-padded with zeros)
  const mintRecipient = ethers.zeroPadValue(address, 32);

  console.log(`\nBridging ${AMOUNT_TO_BRIDGE} EURC to Arc Testnet...`);
  console.log(`Destination domain: ${ARC_TESTNET_DOMAIN}`);
  console.log(`Mint recipient: ${mintRecipient}`);

  // Call depositForBurn
  const bridgeTx = await tokenMessenger.depositForBurn(
    amountWei,
    ARC_TESTNET_DOMAIN,
    mintRecipient,
    CCTP_SEPOLIA.EURC
  );

  console.log(`Bridge tx: ${bridgeTx.hash}`);
  console.log(`Explorer: https://sepolia.etherscan.io/tx/${bridgeTx.hash}`);

  const receipt = await bridgeTx.wait();
  console.log(`\nTransaction confirmed in block ${receipt?.blockNumber}`);

  console.log("\n" + "=".repeat(60));
  console.log("SUCCESS! EURC is being bridged to Arc Testnet");
  console.log("Wait ~2-3 minutes for Circle attestation");
  console.log("=".repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
