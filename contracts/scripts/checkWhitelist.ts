import { createPublicClient, http } from "viem";

const arcTestnet = {
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.testnet.arc.network'] } },
} as const;

const ENTITLEMENTS_ADDRESS = '0xcc205224862c7641930c87679e98999d23c26113' as `0x${string}`;
const TELLER_ADDRESS = '0x9fdF14c5B14173D74C08Af27AebFf39240dC105A' as `0x${string}`;

const OLD_VAULT = '0x5d4f0b80db539c8f8f798505358214d16d7ad55e' as `0x${string}`;
const NEW_VAULT = '0x34d504dda5bcd436d4d86ef9b3930ea8c0cd8b2f' as `0x${string}`;
const OPERATOR = '0xB66D4229Bb5A82De94610d63677cF5370e6a81cb' as `0x${string}`;

// Entitlements ABI (simplified)
const entitlementsAbi = [
  {
    name: 'isEntitled',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }]
  }
] as const;

// Teller ABI for maxDeposit check
const tellerAbi = [
  {
    name: 'maxDeposit',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: 'maxAssets', type: 'uint256' }]
  },
  {
    name: 'maxRedeem',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: 'maxShares', type: 'uint256' }]
  }
] as const;

async function main() {
  const client = createPublicClient({
    chain: arcTestnet,
    transport: http()
  });

  console.log('🔍 Checking USYC Whitelist Status\n');

  // Check Entitlements
  console.log('📋 Entitlements Contract:', ENTITLEMENTS_ADDRESS);

  const addresses = [
    { name: 'Old Vault V3', address: OLD_VAULT },
    { name: 'New Vault V4', address: NEW_VAULT },
    { name: 'Operator', address: OPERATOR },
  ];

  for (const { name, address } of addresses) {
    try {
      const isEntitled = await client.readContract({
        address: ENTITLEMENTS_ADDRESS,
        abi: entitlementsAbi,
        functionName: 'isEntitled',
        args: [address]
      });
      console.log(`${isEntitled ? '✅' : '❌'} ${name}: ${address} - ${isEntitled ? 'WHITELISTED' : 'NOT WHITELISTED'}`);
    } catch (e: any) {
      console.log(`❓ ${name}: ${address} - Error: ${e.message?.slice(0, 50)}`);
    }
  }

  // Check Teller max deposit/redeem
  console.log('\n📋 Teller Contract:', TELLER_ADDRESS);

  for (const { name, address } of addresses) {
    try {
      const maxDeposit = await client.readContract({
        address: TELLER_ADDRESS,
        abi: tellerAbi,
        functionName: 'maxDeposit',
        args: [address]
      });
      const canDeposit = maxDeposit > 0n;
      console.log(`${canDeposit ? '✅' : '❌'} ${name}: maxDeposit = ${maxDeposit.toString()} ${canDeposit ? '(CAN DEPOSIT)' : '(CANNOT DEPOSIT)'}`);
    } catch (e: any) {
      console.log(`❓ ${name}: maxDeposit Error: ${e.message?.slice(0, 50)}`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
