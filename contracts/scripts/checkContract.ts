import { createPublicClient, http } from "viem";
import { readFileSync } from "fs";
import { join } from "path";

const arcTestnet = {
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.testnet.arc.network'] } },
} as const;

async function main() {
  const client = createPublicClient({
    chain: arcTestnet,
    transport: http()
  });

  const abi = JSON.parse(
    readFileSync(join(process.cwd(), "artifacts/contracts/TreasuryVault.sol/TreasuryVault.json"), "utf-8")
  ).abi;

  const vault = '0x34d504dda5bcd436d4d86ef9b3930ea8c0cd8b2f' as `0x${string}`;
  const user = '0x291659bEE3A818a8ceEEa91d8580a7C9c3570C1C' as `0x${string}`;

  console.log('🔍 Checking NEW TreasuryVault contract...\n');
  console.log('Contract:', vault);
  console.log('User:', user);
  console.log('\n📊 Reading contract state:\n');

  try {
    const totalUSDC = await client.readContract({
      address: vault,
      abi,
      functionName: 'totalUSDC'
    });
    console.log('✓ totalUSDC():', totalUSDC.toString());
  } catch (e: any) {
    console.log('✗ totalUSDC(): ERROR -', e.message?.slice(0, 100));
  }

  try {
    const totalShares = await client.readContract({
      address: vault,
      abi,
      functionName: 'totalShares'
    });
    console.log('✓ totalShares():', totalShares.toString());
  } catch (e: any) {
    console.log('✗ totalShares(): ERROR -', e.message?.slice(0, 100));
  }

  try {
    const userShares = await client.readContract({
      address: vault,
      abi,
      functionName: 'userShares',
      args: [user]
    });
    console.log('✓ userShares(user):', userShares.toString());
  } catch (e: any) {
    console.log('✗ userShares(user): ERROR -', e.message?.slice(0, 100));
  }

  try {
    const shareValue = await client.readContract({
      address: vault,
      abi,
      functionName: 'getUserShareValue',
      args: [user]
    });
    console.log('✓ getUserShareValue(user):', shareValue.toString());
  } catch (e: any) {
    console.log('✗ getUserShareValue(user): ERROR -', e.message?.slice(0, 100));
  }

  try {
    const pricePerShare = await client.readContract({
      address: vault,
      abi,
      functionName: 'getPricePerShare'
    });
    console.log('✓ getPricePerShare():', pricePerShare.toString());
  } catch (e: any) {
    console.log('✗ getPricePerShare(): ERROR -', e.message?.slice(0, 100));
  }

  try {
    const poolValue = await client.readContract({
      address: vault,
      abi,
      functionName: 'getTotalPoolValue'
    });
    console.log('✓ getTotalPoolValue():', poolValue.toString());
  } catch (e: any) {
    console.log('✗ getTotalPoolValue(): ERROR -', e.message?.slice(0, 100));
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
