import { createPublicClient, http, formatUnits } from "viem";

const arcTestnet = {
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.testnet.arc.network'] } },
} as const;

const USYC = '0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C' as `0x${string}`;
const OPERATOR = '0xB66D4229Bb5A82De94610d63677cF5370e6a81cb' as `0x${string}`;
const NEW_VAULT = '0x34d504dda5bcd436d4d86ef9b3930ea8c0cd8b2f' as `0x${string}`;
const OLD_VAULT = '0x5d4f0b80db539c8f8f798505358214d16d7ad55e' as `0x${string}`;

const usycAbi = [
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
] as const;

async function main() {
  const client = createPublicClient({ chain: arcTestnet, transport: http() });

  console.log('USYC Balances:\n');

  const addresses = [
    { name: 'Operator', addr: OPERATOR },
    { name: 'New Vault V4', addr: NEW_VAULT },
    { name: 'Old Vault V3', addr: OLD_VAULT },
  ];

  for (const { name, addr } of addresses) {
    const balance = await client.readContract({
      address: USYC,
      abi: usycAbi,
      functionName: 'balanceOf',
      args: [addr]
    });
    console.log(`${name}: ${formatUnits(balance, 6)} USYC`);
  }
}

main().catch(console.error);
