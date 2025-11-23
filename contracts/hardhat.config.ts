import { defineConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-ethers";
import hardhatViem from "@nomicfoundation/hardhat-viem";
import hardhatViemAssertions from "@nomicfoundation/hardhat-viem-assertions";
import hardhatNodeTestRunner from "@nomicfoundation/hardhat-node-test-runner";
import hardhatNetworkHelpers from "@nomicfoundation/hardhat-network-helpers";

export default defineConfig({
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    arcTestnet: {
      url: "https://rpc.testnet.arc.network",
      chainId: 5042002,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      type: "http" as const,
    },
    hardhat: {
      chainId: 1337,
      url: "http://127.0.0.1:8545",
      type: "http" as const,
    },
  },
  paths: {
    sources: "./contracts",
    tests: {
      nodejs: "./test",
    },
    cache: "./cache",
    artifacts: "./artifacts",
  },
  plugins: [
    hardhatViem,
    hardhatViemAssertions,
    hardhatNodeTestRunner,
    hardhatNetworkHelpers,
  ],
  test: {
    nodejs: {
      timeout: 40000,
    },
  },
});

