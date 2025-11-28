import { createPublicClient, http } from "viem";

const arcTestnet = {
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.testnet.arc.network'] } },
} as const;

const TELLER = '0x9fdF14c5B14173D74C08Af27AebFf39240dC105A' as `0x${string}`;
const OLD_VAULT_V3 = '0x5d4f0b80db539c8f8f798505358214d16d7ad55e' as `0x${string}`;
const NEW_VAULT_V4 = '0x34d504dda5bcd436d4d86ef9b3930ea8c0cd8b2f' as `0x${string}`;

const tellerAbi = [
  { name: 'maxDeposit', type: 'function', stateMutability: 'view', inputs: [{ name: '', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'maxRedeem', type: 'function', stateMutability: 'view', inputs: [{ name: '', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
] as const;

async function main() {
  const client = createPublicClient({ chain: arcTestnet, transport: http() });

  console.log('🔍 Teller Whitelist Verification:\n');

  const vaults = [
    { name: 'V3 (old)', addr: OLD_VAULT_V3 },
    { name: 'V4 (new)', addr: NEW_VAULT_V4 },
  ];

  for (const { name, addr } of vaults) {
    const maxDep = await client.readContract({
      address: TELLER,
      abi: tellerAbi,
      functionName: 'maxDeposit',
      args: [addr]
    });
    const maxRed = await client.readContract({
      address: TELLER,
      abi: tellerAbi,
      functionName: 'maxRedeem',
      args: [addr]
    });

    console.log(name + ': ' + addr);
    console.log('  maxDeposit: ' + maxDep.toString() + (maxDep > 0n ? ' ✅ CAN DEPOSIT' : ' ❌ CANNOT DEPOSIT'));
    console.log('  maxRedeem:  ' + maxRed.toString() + (maxRed > 0n ? ' ✅ CAN REDEEM' : ' ❌ CANNOT REDEEM'));
    console.log('');
  }
}

main().catch(console.error);
