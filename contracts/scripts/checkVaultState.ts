import { createPublicClient, http, formatUnits } from "viem";
import { defineChain } from "viem";

const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.arc.network"] } },
});

const PROXY_ADDRESS = "0x17ca5232415430bC57F646A72fD15634807bF729" as `0x${string}`;

const VAULT_ABI = [
  { inputs: [], name: "wusdc", outputs: [{ type: "address" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "usdc", outputs: [{ type: "address" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "usyc", outputs: [{ type: "address" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "teller", outputs: [{ type: "address" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "usycOracle", outputs: [{ type: "address" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "isNativeUSDC", outputs: [{ type: "bool" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "totalUSDC", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "totalUSYC", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "totalShares", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
] as const;

async function main() {
  console.log("=== Vault State Check ===\n");

  const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });

  // Read all state
  const [wusdc, usdc, usyc, teller, oracle, isNative, totalUSDC, totalUSYC, totalShares] = await Promise.all([
    publicClient.readContract({ address: PROXY_ADDRESS, abi: VAULT_ABI, functionName: "wusdc" }),
    publicClient.readContract({ address: PROXY_ADDRESS, abi: VAULT_ABI, functionName: "usdc" }),
    publicClient.readContract({ address: PROXY_ADDRESS, abi: VAULT_ABI, functionName: "usyc" }),
    publicClient.readContract({ address: PROXY_ADDRESS, abi: VAULT_ABI, functionName: "teller" }),
    publicClient.readContract({ address: PROXY_ADDRESS, abi: VAULT_ABI, functionName: "usycOracle" }),
    publicClient.readContract({ address: PROXY_ADDRESS, abi: VAULT_ABI, functionName: "isNativeUSDC" }),
    publicClient.readContract({ address: PROXY_ADDRESS, abi: VAULT_ABI, functionName: "totalUSDC" }),
    publicClient.readContract({ address: PROXY_ADDRESS, abi: VAULT_ABI, functionName: "totalUSYC" }),
    publicClient.readContract({ address: PROXY_ADDRESS, abi: VAULT_ABI, functionName: "totalShares" }),
  ]);

  console.log("Addresses:");
  console.log("  WUSDC:", wusdc);
  console.log("  USDC:", usdc);
  console.log("  USYC:", usyc);
  console.log("  Teller:", teller);
  console.log("  Oracle:", oracle);
  console.log("  isNativeUSDC:", isNative);

  console.log("\nPool State:");
  console.log("  totalUSDC:", formatUnits(totalUSDC, 18), "USDC");
  console.log("  totalUSYC:", formatUnits(totalUSYC, 6), "USYC");
  console.log("  totalShares:", formatUnits(totalShares, 18), "shares");

  // Check vault balance
  const vaultBalance = await publicClient.getBalance({ address: PROXY_ADDRESS });
  console.log("  Vault native balance:", formatUnits(vaultBalance, 18), "USDC");

  console.log("\n=== Done ===");
}

main().catch(console.error);
