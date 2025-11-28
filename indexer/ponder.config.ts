import { createConfig } from "@ponder/core";
import { http } from "viem";

// V5 Vault ABI (only events we need)
const TreasuryVaultV5Abi = [
  {
    type: "event",
    name: "Deposit",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "shares", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Withdraw",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "shares", type: "uint256", indexed: false },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "DepositLocked",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "lockId", type: "uint256", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "token", type: "address", indexed: false },
      { name: "lockPeriodMonths", type: "uint8", indexed: false },
      { name: "unlockTime", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "LockedPositionWithdrawn",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "lockId", type: "uint256", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "yield", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "USYCMinted",
    inputs: [
      { name: "usdcAmount", type: "uint256", indexed: false },
      { name: "usycAmount", type: "uint256", indexed: false },
    ],
  },
] as const;

// EarlySupporterBadge ABI
const EarlySupporterBadgeAbi = [
  {
    type: "event",
    name: "Mint",
    inputs: [
      { name: "to", type: "address", indexed: true },
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "wasWhitelisted", type: "bool", indexed: false },
    ],
  },
] as const;

export default createConfig({
  networks: {
    arcTestnet: {
      chainId: 5042002,
      transport: http("https://rpc.blockdaemon.testnet.arc.network"),
    },
  },
  contracts: {
    TreasuryVaultV5: {
      network: "arcTestnet",
      abi: TreasuryVaultV5Abi,
      address: "0x17ca5232415430bC57F646A72fD15634807bF729",
      startBlock: 0, // Will be updated to actual deploy block
    },
    EarlySupporterBadge: {
      network: "arcTestnet",
      abi: EarlySupporterBadgeAbi,
      address: "0xb26a5b1d783646a7236ca956f2e954e002bf8d13",
      startBlock: 0,
    },
  },
});
