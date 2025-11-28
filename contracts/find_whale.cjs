async function main() {
  let all = [];
  let nextParams = null;
  while (true) {
    let url = 'https://testnet.arcscan.app/api/v2/addresses/0x34D504DDa5bCD436D4D86eF9b3930EA8C0CD8B2f/transactions';
    if (nextParams) url += '?' + new URLSearchParams(nextParams).toString();
    const resp = await fetch(url);
    const json = await resp.json();
    all.push(...(json.items || []));
    nextParams = json.next_page_params;
    if (!nextParams) break;
  }

  // Find whale
  const whale = all.filter(tx => tx.from && tx.from.hash && tx.from.hash.toLowerCase().startsWith('0x7c53d458'));
  console.log('Whale transactions:');
  for (const tx of whale) {
    console.log('Address:', tx.from.hash);
    console.log('Hash:', tx.hash);
    console.log('Method:', tx.method);
    console.log('Value:', Number(BigInt(tx.value || 0)) / 1e18, 'USDC');
    console.log('Time:', tx.timestamp);
    console.log('---');
  }
}
main();
