import { createPublicClient, http, formatUnits, parseUnits } from "viem";

const arcTestnet = {
  id: 5042002,
  name: 'Arc Testnet', 
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.testnet.arc.network'] } },
} as const;

const TELLER = '0x9fdF14c5B14173D74C08Af27AebFf39240dC105A' as `0x${string}`;
const USYC = '0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C' as `0x${string}`;

async function main() {
  const client = createPublicClient({
    chain: arcTestnet,
    transport: http()
  });

  console.log('🔍 Inspecting Teller Contract\n');

  // Common ERC4626 functions
  const functions = [
    { name: 'asset', inputs: [], outputs: [{ type: 'address' }] },
    { name: 'totalAssets', inputs: [], outputs: [{ type: 'uint256' }] },
    { name: 'totalSupply', inputs: [], outputs: [{ type: 'uint256' }] },
    { name: 'decimals', inputs: [], outputs: [{ type: 'uint8' }] },
    { name: 'convertToAssets', inputs: [{ type: 'uint256' }], outputs: [{ type: 'uint256' }] },
    { name: 'convertToShares', inputs: [{ type: 'uint256' }], outputs: [{ type: 'uint256' }] },
  ];

  for (const func of functions) {
    try {
      const args = func.inputs.length > 0 ? [parseUnits('1', 6)] : [];
      const result = await client.readContract({
        address: TELLER,
        abi: [{ name: func.name, type: 'function', stateMutability: 'view', ...func }],
        functionName: func.name,
        args
      });
      console.log(`✓ ${func.name}():`, result?.toString());
    } catch (e: any) {
      console.log(`✗ ${func.name}(): ERROR`);
    }
  }

  // Check USYC details
  console.log('\n📊 USYC Token Details:');
  try {
    const decimals = await client.readContract({
      address: USYC,
      abi: [{ name: 'decimals', type: 'function', inputs: [], outputs: [{ type: 'uint8' }], stateMutability: 'view' }],
      functionName: 'decimals'
    });
    console.log('✓ USYC decimals:', decimals);
  } catch (e) {
    console.log('✗ USYC decimals: ERROR');
  }

  try {
    const totalSupply = await client.readContract({
      address: USYC,
      abi: [{ name: 'totalSupply', type: 'function', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' }],
      functionName: 'totalSupply'
    });
    console.log('✓ USYC totalSupply:', formatUnits(totalSupply as bigint, 6));
  } catch (e) {
    console.log('✗ USYC totalSupply: ERROR');
  }

  // Test with 6 decimal input (standard USDC)
  console.log('\n📊 Testing with 6 decimals (standard USDC):');
  try {
    const amount6dec = parseUnits('1', 6); // 1 USDC with 6 decimals
    const preview = await client.readContract({
      address: TELLER,
      abi: [{ name: 'previewDeposit', type: 'function', inputs: [{ type: 'uint256' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' }],
      functionName: 'previewDeposit',
      args: [amount6dec]
    });
    console.log('✓ previewDeposit(1e6):', formatUnits(preview as bigint, 6), 'USYC');
  } catch (e: any) {
    console.log('✗ previewDeposit(1e6): ERROR -', e.message?.slice(0, 80));
  }

  // Test convertToShares
  console.log('\n📊 Testing convertToShares:');
  try {
    const amount = parseUnits('1', 6);
    const shares = await client.readContract({
      address: TELLER,
      abi: [{ name: 'convertToShares', type: 'function', inputs: [{ type: 'uint256' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' }],
      functionName: 'convertToShares', 
      args: [amount]
    });
    console.log('✓ convertToShares(1 USDC 6dec):', formatUnits(shares as bigint, 6), 'USYC');
  } catch (e: any) {
    console.log('✗ convertToShares: ERROR');
  }
}

main().catch(console.error);
