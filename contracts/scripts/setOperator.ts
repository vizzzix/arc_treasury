import { createWalletClient, createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { defineChain } from "viem";
import * as dotenv from "dotenv";

dotenv.config();

const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.blockdaemon.testnet.arc.network"] } },
});

const VAULT_ADDRESS = "0x34D504DDa5bCD436D4D86eF9b3930EA8C0CD8B2f" as `0x${string}`;

const vaultAbi = [
  { name: 'setTreasuryOperator', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'newOperator', type: 'address' }], outputs: [] },
  { name: 'treasuryOperator', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'address' }] },
  { name: 'owner', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'address' }] },
] as const;

async function main() {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) throw new Error("PRIVATE_KEY not set");

  const account = privateKeyToAccount(privateKey as `0x${string}`);
  console.log("Caller:", account.address);

  const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });
  const walletClient = createWalletClient({ account, chain: arcTestnet, transport: http() });

  console.log("Current operator:", await publicClient.readContract({
    address: VAULT_ADDRESS,
    abi: vaultAbi,
    functionName: 'treasuryOperator',
  }));

  console.log("\nSetting operator to:", account.address);

  const hash = await walletClient.writeContract({
    address: VAULT_ADDRESS,
    abi: vaultAbi,
    functionName: 'setTreasuryOperator',
    args: [account.address],
  });

  console.log("Tx:", hash);
  console.log("Waiting...");
  await publicClient.waitForTransactionReceipt({ hash });

  console.log("\nNew operator:", await publicClient.readContract({
    address: VAULT_ADDRESS,
    abi: vaultAbi,
    functionName: 'treasuryOperator',
  }));
}

main().catch(console.error);
