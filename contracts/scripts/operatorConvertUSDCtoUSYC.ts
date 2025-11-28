/**
 * Full USDC -> USYC conversion for operator
 *
 * Arc Limitation: Smart contracts cannot call approve on native USDC precompile.
 * So the operator (EOA) must:
 * 1. Approve USDC for Teller
 * 2. Deposit to Teller and receive USYC
 * 3. Transfer USYC to vault
 * 4. Call recordUSYCConversion() to update vault accounting
 */
import { createWalletClient, createPublicClient, http, parseUnits, formatUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import * as dotenv from "dotenv";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const arcTestnet = {
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.testnet.arc.network'] } },
} as const;

const VAULT = '0x17ca5232415430bC57F646A72fD15634807bF729' as `0x${string}`;
const TELLER = '0x9fdF14c5B14173D74C08Af27AebFf39240dC105A' as `0x${string}`;
const USYC = '0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C' as `0x${string}`;
const NATIVE_USDC = '0x3600000000000000000000000000000000000000' as `0x${string}`;

const erc20Abi = [
  { name: 'approve', type: 'function', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }], stateMutability: 'nonpayable' },
  { name: 'allowance', type: 'function', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { name: 'balanceOf', type: 'function', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { name: 'transfer', type: 'function', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }], stateMutability: 'nonpayable' },
] as const;

const tellerAbi = [
  { name: 'deposit', type: 'function', inputs: [{ name: 'assets', type: 'uint256' }, { name: 'receiver', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'nonpayable' },
  { name: 'maxDeposit', type: 'function', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
] as const;

const vaultAbi = [
  { name: 'totalUSDC', type: 'function', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { name: 'totalUSYC', type: 'function', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { name: 'recordUSYCConversion', type: 'function', inputs: [{ name: 'usycAmount', type: 'uint256' }], outputs: [], stateMutability: 'nonpayable' },
] as const;

async function main() {
  let operatorKey = process.env.PRIVATE_KEY_OPERATOR;
  if (!operatorKey) {
    throw new Error("PRIVATE_KEY_OPERATOR not set in .env");
  }
  if (!operatorKey.startsWith('0x')) {
    operatorKey = '0x' + operatorKey;
  }

  const account = privateKeyToAccount(operatorKey as `0x${string}`);
  console.log('Operator:', account.address);

  const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });
  const walletClient = createWalletClient({ account, chain: arcTestnet, transport: http() });

  // Check balances
  console.log('\n=== Current State ===');
  const operatorUSDC = await publicClient.readContract({ address: NATIVE_USDC, abi: erc20Abi, functionName: 'balanceOf', args: [account.address] });
  const operatorUSYC = await publicClient.readContract({ address: USYC, abi: erc20Abi, functionName: 'balanceOf', args: [account.address] });
  const vaultUSYC = await publicClient.readContract({ address: USYC, abi: erc20Abi, functionName: 'balanceOf', args: [VAULT] });
  const totalUSYC = await publicClient.readContract({ address: VAULT, abi: vaultAbi, functionName: 'totalUSYC' });
  const maxDeposit = await publicClient.readContract({ address: TELLER, abi: tellerAbi, functionName: 'maxDeposit', args: [account.address] });

  console.log('Operator USDC balance:', formatUnits(operatorUSDC, 6), 'USDC');
  console.log('Operator USYC balance:', formatUnits(operatorUSYC, 6), 'USYC');
  console.log('Vault USYC balance (actual):', formatUnits(vaultUSYC, 6), 'USYC');
  console.log('Vault totalUSYC (recorded):', formatUnits(totalUSYC, 6), 'USYC');
  console.log('Teller maxDeposit:', formatUnits(maxDeposit, 6), 'USDC');

  // Calculate how much to convert
  const amountToConvert = maxDeposit > operatorUSDC ? operatorUSDC : maxDeposit;

  if (amountToConvert === 0n) {
    console.log('\nNo USDC to convert or maxDeposit is 0');
    return;
  }

  console.log('\n=== Converting', formatUnits(amountToConvert, 6), 'USDC to USYC ===');

  // Step 1: Approve USDC for Teller
  console.log('\n1. Approving USDC for Teller...');
  const allowance = await publicClient.readContract({ address: NATIVE_USDC, abi: erc20Abi, functionName: 'allowance', args: [account.address, TELLER] });
  if (allowance < amountToConvert) {
    const approveHash = await walletClient.writeContract({
      address: NATIVE_USDC,
      abi: erc20Abi,
      functionName: 'approve',
      args: [TELLER, amountToConvert]
    });
    console.log('   Tx:', approveHash);
    await publicClient.waitForTransactionReceipt({ hash: approveHash });
    console.log('   Approved!');
  } else {
    console.log('   Already approved');
  }

  // Step 2: Deposit to Teller
  console.log('\n2. Depositing to Teller...');
  const usycBefore = await publicClient.readContract({ address: USYC, abi: erc20Abi, functionName: 'balanceOf', args: [account.address] });

  const depositHash = await walletClient.writeContract({
    address: TELLER,
    abi: tellerAbi,
    functionName: 'deposit',
    args: [amountToConvert, account.address]
  });
  console.log('   Tx:', depositHash);
  await publicClient.waitForTransactionReceipt({ hash: depositHash });

  const usycAfter = await publicClient.readContract({ address: USYC, abi: erc20Abi, functionName: 'balanceOf', args: [account.address] });
  const usycReceived = usycAfter - usycBefore;
  console.log('   Received:', formatUnits(usycReceived, 6), 'USYC');

  // Step 3: Transfer USYC to vault
  console.log('\n3. Transferring USYC to vault...');
  const transferHash = await walletClient.writeContract({
    address: USYC,
    abi: erc20Abi,
    functionName: 'transfer',
    args: [VAULT, usycReceived]
  });
  console.log('   Tx:', transferHash);
  await publicClient.waitForTransactionReceipt({ hash: transferHash });
  console.log('   Transferred!');

  // Step 4: Record in vault
  console.log('\n4. Recording conversion in vault...');
  const recordHash = await walletClient.writeContract({
    address: VAULT,
    abi: vaultAbi,
    functionName: 'recordUSYCConversion',
    args: [usycReceived]
  });
  console.log('   Tx:', recordHash);
  await publicClient.waitForTransactionReceipt({ hash: recordHash });
  console.log('   Recorded!');

  // Final state
  console.log('\n=== Conversion Complete ===');
  const newTotalUSYC = await publicClient.readContract({ address: VAULT, abi: vaultAbi, functionName: 'totalUSYC' });
  console.log('New vault totalUSYC:', formatUnits(newTotalUSYC, 6), 'USYC');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
