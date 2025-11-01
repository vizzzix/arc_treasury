require("@nomicfoundation/hardhat-ethers");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    hardhat: {
      chainId: 31337
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337
    },
    arcTestnet: {
      url: process.env.ARC_RPC_URL || "https://rpc.testnet.arc.network",
      chainId: 5042002, // Arc Testnet Official Chain ID
      accounts: process.env.PRIVATE_KEY ? [
        process.env.PRIVATE_KEY.startsWith('0x') 
          ? process.env.PRIVATE_KEY 
          : `0x${process.env.PRIVATE_KEY}`
      ] : [],
      timeout: 120000
    }
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  }
};

