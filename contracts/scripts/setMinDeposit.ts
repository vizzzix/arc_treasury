import { createWalletClient, createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { defineChain } from "viem";
import * as dotenv from "dotenv";

dotenv.config();

const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.arc.network"] } },
});

const BADGE_ADDRESS = "0xb26a5b1d783646a7236ca956f2e954e002bf8d13" as `0x${string}`;

const badgeAbi = [
  { name: 'setMinDepositRequired', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: '_minDeposit', type: 'uint256' }], outputs: [] },
  { name: 'minDepositRequired', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
] as const;

async function main() {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) throw new Error("PRIVATE_KEY not set");

  const account = privateKeyToAccount(privateKey as `0x${string}`);
  
  const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });
  const walletClient = createWalletClient({ account, chain: arcTestnet, transport: http() });

  // $1 = 1_000_000 (6 decimals for vault shares)
  const MIN_DEPOSIT = 1_000_000n;

  console.log("Current minDepositRequired:", await publicClient.readContract({
    address: BADGE_ADDRESS,
    abi: badgeAbi,
    functionName: 'minDepositRequired',
  }));

  console.log("\nSetting minDepositRequired to $1 (1_000_000)...");
  
  const hash = await walletClient.writeContract({
    address: BADGE_ADDRESS,
    abi: badgeAbi,
    functionName: 'setMinDepositRequired',
    args: [MIN_DEPOSIT],
  });

  console.log("Tx:", hash);
  await publicClient.waitForTransactionReceipt({ hash });

  console.log("\nNew minDepositRequired:", await publicClient.readContract({
    address: BADGE_ADDRESS,
    abi: badgeAbi,
    functionName: 'minDepositRequired',
  }));
}

main().catch(console.error);
