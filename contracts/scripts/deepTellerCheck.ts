import { createPublicClient, http, parseAbi } from "viem";

const arcTestnet = {
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.testnet.arc.network'] } },
} as const;

const TELLER = '0x9fdF14c5B14173D74C08Af27AebFf39240dC105A' as `0x${string}`;
const USYC = '0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C' as `0x${string}`;
const USDC = '0x3600000000000000000000000000000000000000' as `0x${string}`;
const OLD_VAULT_V3 = '0x5d4f0b80db539c8f8f798505358214d16d7ad55e' as `0x${string}`;
const NEW_VAULT_V4 = '0x34d504dda5bcd436d4d86ef9b3930ea8c0cd8b2f' as `0x${string}`;
const OPERATOR = '0xB66D4229Bb5A82De94610d63677cF5370e6a81cb' as `0x${string}`;

// Extended Teller ABI to check more functions
const tellerAbi = parseAbi([
  'function maxDeposit(address) view returns (uint256)',
  'function maxRedeem(address) view returns (uint256)',
  'function maxMint(address) view returns (uint256)',
  'function maxWithdraw(address) view returns (uint256)',
  'function previewDeposit(uint256) view returns (uint256)',
  'function previewRedeem(uint256) view returns (uint256)',
  'function asset() view returns (address)',
  'function name() view returns (string)',
  'function symbol() view returns (string)',
]);

async function main() {
  const client = createPublicClient({ chain: arcTestnet, transport: http() });

  console.log('🔍 Deep Teller Contract Analysis\n');
  console.log('Teller:', TELLER);

  // Check Teller basic info
  try {
    const asset = await client.readContract({ address: TELLER, abi: tellerAbi, functionName: 'asset' });
    console.log('Teller asset:', asset);
  } catch (e: any) {
    console.log('asset() failed:', e.message?.slice(0, 100));
  }

  console.log('\n' + '='.repeat(60));

  const addresses = [
    { name: 'V3 (old vault)', addr: OLD_VAULT_V3 },
    { name: 'V4 (new vault)', addr: NEW_VAULT_V4 },
    { name: 'Operator', addr: OPERATOR },
  ];

  for (const { name, addr } of addresses) {
    console.log('\n📋 ' + name + ': ' + addr);
    console.log('-'.repeat(60));

    // maxDeposit - how much USDC can be deposited
    try {
      const val = await client.readContract({ address: TELLER, abi: tellerAbi, functionName: 'maxDeposit', args: [addr] });
      console.log('  maxDeposit:  ' + val.toString().padStart(15) + (val > 0n ? ' ✅' : ' ❌'));
    } catch (e: any) {
      console.log('  maxDeposit:  ERROR - ' + e.message?.slice(0, 50));
    }

    // maxMint - how much USYC can be minted
    try {
      const val = await client.readContract({ address: TELLER, abi: tellerAbi, functionName: 'maxMint', args: [addr] });
      console.log('  maxMint:     ' + val.toString().padStart(15) + (val > 0n ? ' ✅' : ' ❌'));
    } catch (e: any) {
      console.log('  maxMint:     ERROR - ' + e.message?.slice(0, 50));
    }

    // maxRedeem - how much USYC can be redeemed
    try {
      const val = await client.readContract({ address: TELLER, abi: tellerAbi, functionName: 'maxRedeem', args: [addr] });
      console.log('  maxRedeem:   ' + val.toString().padStart(15) + (val > 0n ? ' ✅' : ' ❌'));
    } catch (e: any) {
      console.log('  maxRedeem:   ERROR - ' + e.message?.slice(0, 50));
    }

    // maxWithdraw - how much USDC can be withdrawn
    try {
      const val = await client.readContract({ address: TELLER, abi: tellerAbi, functionName: 'maxWithdraw', args: [addr] });
      console.log('  maxWithdraw: ' + val.toString().padStart(15) + (val > 0n ? ' ✅' : ' ❌'));
    } catch (e: any) {
      console.log('  maxWithdraw: ERROR - ' + e.message?.slice(0, 50));
    }
  }

  // Check preview functions (doesn't depend on address)
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 Preview Functions (rate check):');

  try {
    const preview = await client.readContract({
      address: TELLER,
      abi: tellerAbi,
      functionName: 'previewDeposit',
      args: [1000000000000000000n] // 1 USDC (18 dec)
    });
    console.log('  1 USDC deposit -> ' + preview.toString() + ' USYC units');
  } catch (e: any) {
    console.log('  previewDeposit failed:', e.message?.slice(0, 100));
  }

  try {
    const preview = await client.readContract({
      address: TELLER,
      abi: tellerAbi,
      functionName: 'previewRedeem',
      args: [1000000n] // 1 USYC (6 dec)
    });
    console.log('  1 USYC redeem -> ' + preview.toString() + ' USDC units');
  } catch (e: any) {
    console.log('  previewRedeem failed:', e.message?.slice(0, 100));
  }
}

main().catch(console.error);
