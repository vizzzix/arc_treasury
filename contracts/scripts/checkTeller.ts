import { createPublicClient, http, formatUnits } from "viem";

const arcTestnet = {
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.testnet.arc.network'] } },
} as const;

const TELLER = '0x9fdF14c5B14173D74C08Af27AebFf39240dC105A' as `0x${string}`;
const USYC = '0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C' as `0x${string}`;
const VAULT = '0x5d4f0b80db539c8f8f798505358214d16d7ad55e' as `0x${string}`;
const ENTITLEMENTS = '0xcc205224862c7641930c87679e98999d23c26113' as `0x${string}`;

async function main() {
  const client = createPublicClient({
    chain: arcTestnet,
    transport: http()
  });

  console.log('🔍 Checking Teller & USYC on Arc Testnet\n');

  // Check USYC balance of vault
  try {
    const vaultUSYC = await client.readContract({
      address: USYC,
      abi: [{ name: 'balanceOf', type: 'function', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }] }],
      functionName: 'balanceOf',
      args: [VAULT]
    });
    console.log('✓ Vault USYC balance:', formatUnits(vaultUSYC as bigint, 6), 'USYC');
  } catch (e: any) {
    console.log('✗ Vault USYC balance: ERROR -', e.message?.slice(0, 80));
  }

  // Check if vault is whitelisted in entitlements
  try {
    const isWhitelisted = await client.readContract({
      address: ENTITLEMENTS,
      abi: [{ name: 'isWhitelisted', type: 'function', inputs: [{ type: 'address' }], outputs: [{ type: 'bool' }] }],
      functionName: 'isWhitelisted',
      args: [VAULT]
    });
    console.log('✓ Vault whitelisted in USYC:', isWhitelisted);
  } catch (e: any) {
    console.log('✗ Vault whitelist check: ERROR -', e.message?.slice(0, 80));
  }

  // Check Teller contract exists
  try {
    const tellerCode = await client.getCode({ address: TELLER });
    console.log('✓ Teller contract exists:', tellerCode && tellerCode.length > 2 ? 'YES' : 'NO');
  } catch (e: any) {
    console.log('✗ Teller check: ERROR -', e.message?.slice(0, 80));
  }

  // Try to read Teller asset (USDC address it accepts)
  try {
    const asset = await client.readContract({
      address: TELLER,
      abi: [{ name: 'asset', type: 'function', inputs: [], outputs: [{ type: 'address' }] }],
      functionName: 'asset'
    });
    console.log('✓ Teller asset (USDC):', asset);
  } catch (e: any) {
    console.log('✗ Teller asset: ERROR -', e.message?.slice(0, 80));
  }

  // Try to read Teller vault (USYC it mints)
  try {
    const vault = await client.readContract({
      address: TELLER,
      abi: [{ name: 'vault', type: 'function', inputs: [], outputs: [{ type: 'address' }] }],
      functionName: 'vault'
    });
    console.log('✓ Teller vault (USYC):', vault);
  } catch (e: any) {
    console.log('✗ Teller vault: ERROR -', e.message?.slice(0, 80));
  }

  // Check Teller's USDC balance (liquidity for redeem)
  try {
    // Native USDC balance
    const tellerBalance = await client.getBalance({ address: TELLER });
    console.log('✓ Teller native USDC balance:', formatUnits(tellerBalance, 18), 'USDC');
  } catch (e: any) {
    console.log('✗ Teller balance: ERROR -', e.message?.slice(0, 80));
  }

  // Check current vault state
  console.log('\n📊 Current Vault State:');
  try {
    const totalUSYC = await client.readContract({
      address: VAULT,
      abi: [{ name: 'totalUSYC', type: 'function', inputs: [], outputs: [{ type: 'uint256' }] }],
      functionName: 'totalUSYC'
    });
    console.log('✓ Vault totalUSYC:', formatUnits(totalUSYC as bigint, 6));
  } catch (e: any) {
    console.log('✗ totalUSYC: ERROR -', e.message?.slice(0, 80));
  }

  try {
    const tellerAddr = await client.readContract({
      address: VAULT,
      abi: [{ name: 'teller', type: 'function', inputs: [], outputs: [{ type: 'address' }] }],
      functionName: 'teller'
    });
    console.log('✓ Vault teller address:', tellerAddr);
  } catch (e: any) {
    console.log('✗ Vault teller: ERROR -', e.message?.slice(0, 80));
  }
}

main().catch(console.error);
