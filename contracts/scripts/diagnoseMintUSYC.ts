import { createPublicClient, http, formatUnits } from "viem";

const arcTestnet = {
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.testnet.arc.network'] } },
} as const;

// Current vault V9
const VAULT = '0x17ca5232415430bC57F646A72fD15634807bF729' as `0x${string}`;
const ENTITLEMENTS = '0xcc205224862c7641930c87679e98999d23c26113' as `0x${string}`;
const TELLER = '0x9fdF14c5B14173D74C08Af27AebFf39240dC105A' as `0x${string}`;
const USYC = '0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C' as `0x${string}`;

async function main() {
  const client = createPublicClient({
    chain: arcTestnet,
    transport: http()
  });

  console.log('🔍 Diagnosing mintUSYC for Vault V9\n');
  console.log('Vault:', VAULT);

  // 1. Check if teller is set in vault
  console.log('\n=== 1. Check Teller Address in Vault ===');
  try {
    const tellerInVault = await client.readContract({
      address: VAULT,
      abi: [{ name: 'teller', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] }],
      functionName: 'teller'
    });
    console.log('Teller in vault:', tellerInVault);
    if (tellerInVault === '0x0000000000000000000000000000000000000000') {
      console.log('❌ PROBLEM: Teller is NOT SET! Need to call setTeller()');
    } else {
      console.log('✅ Teller is set');
    }
  } catch (e: any) {
    console.log('❌ Error:', e.message?.slice(0, 100));
  }

  // 2. Check Entitlements whitelist
  console.log('\n=== 2. Check Entitlements Whitelist ===');
  try {
    const isEntitled = await client.readContract({
      address: ENTITLEMENTS,
      abi: [{ name: 'isEntitled', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'bool' }] }],
      functionName: 'isEntitled',
      args: [VAULT]
    });
    console.log('Vault isEntitled:', isEntitled ? '✅ YES' : '❌ NO');
    if (!isEntitled) {
      console.log('❌ PROBLEM: Vault not in Entitlements whitelist!');
    }
  } catch (e: any) {
    console.log('❌ Error:', e.message?.slice(0, 100));
  }

  // 3. Check Teller maxDeposit for vault
  console.log('\n=== 3. Check Teller Max Deposit ===');
  try {
    const maxDeposit = await client.readContract({
      address: TELLER,
      abi: [{ name: 'maxDeposit', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] }],
      functionName: 'maxDeposit',
      args: [VAULT]
    });
    console.log('Vault maxDeposit:', formatUnits(maxDeposit, 6), 'USDC');
    if (maxDeposit === 0n) {
      console.log('❌ PROBLEM: Vault cannot deposit to Teller (not whitelisted)');
    } else {
      console.log('✅ Vault CAN deposit to Teller');
    }
  } catch (e: any) {
    console.log('❌ Error:', e.message?.slice(0, 100));
  }

  // 4. Check current balances
  console.log('\n=== 4. Current Vault State ===');
  try {
    const [totalUSDC, totalUSYC] = await Promise.all([
      client.readContract({
        address: VAULT,
        abi: [{ name: 'totalUSDC', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] }],
        functionName: 'totalUSDC'
      }),
      client.readContract({
        address: VAULT,
        abi: [{ name: 'totalUSYC', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] }],
        functionName: 'totalUSYC'
      })
    ]);
    console.log('totalUSDC:', formatUnits(totalUSDC, 18), 'USDC');
    console.log('totalUSYC:', formatUnits(totalUSYC, 6), 'USYC');

    if (totalUSDC > 0n) {
      console.log('\n�� There is USDC to convert. If all checks pass, run:');
      console.log('   npx hardhat run scripts/operatorMintUSYC.ts --network arc');
    }
  } catch (e: any) {
    console.log('❌ Error:', e.message?.slice(0, 100));
  }

  // 5. Summary
  console.log('\n=== SUMMARY ===');
  console.log('To enable automatic USDC → USYC conversion:');
  console.log('1. Teller address must be set in vault (setTeller)');
  console.log('2. Vault must be in Entitlements whitelist (need to contact Arc/Hashnote)');
  console.log('3. Vault must have maxDeposit > 0 on Teller');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
