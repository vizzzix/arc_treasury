import { createPublicClient, http, parseAbiItem } from 'viem';

console.log('Connecting to RPC...');

const client = createPublicClient({
  chain: {
    id: 1637450,
    name: 'Arc Testnet',
    nativeCurrency: { decimals: 18, name: 'ETH', symbol: 'ETH' },
    rpcUrls: { default: { http: ['https://rpc.testnet.arc.network'] } },
  } as any,
  transport: http(),
});

async function main() {
  try {
    const blockNumber = await client.getBlockNumber();
    console.log('Current block:', blockNumber.toString());

    console.log('Querying events from blocks 14360630-14360650...');
    const logs = await client.getLogs({
      address: '0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275',
      event: parseAbiItem('event MessageReceived(address indexed caller, uint32 sourceDomain, bytes32 indexed nonce, bytes32 sender, uint32 indexed finalityThresholdExecuted, bytes messageBody)'),
      fromBlock: 14360630n,
      toBlock: 14360650n,
    });
    console.log('Found events:', logs.length);
    logs.forEach(l => console.log('TX:', l.transactionHash, 'Block:', l.blockNumber?.toString()));
  } catch (e: any) {
    console.error('Error:', e.message);
  }
}

main();
