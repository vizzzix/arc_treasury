async function main() {
  let allItems = [];
  let nextParams = null;

  while (true) {
    let url = 'https://testnet.arcscan.app/api/v2/addresses/0x34D504DDa5bCD436D4D86eF9b3930EA8C0CD8B2f/transactions';
    if (nextParams) {
      url += '?' + new URLSearchParams(nextParams).toString();
    }

    const resp = await fetch(url);
    const json = await resp.json();

    allItems.push(...(json.items || []));
    nextParams = json.next_page_params;

    if (!nextParams) break;
  }

  console.log('Total txs found:', allItems.length);
  console.log('');

  // Group by method
  const methods = {};
  let totalIn = 0n;
  let failedValue = 0n;

  // Track depositors
  const depositors = {};

  for (const tx of allItems) {
    const method = tx.method || 'unknown';
    const val = BigInt(tx.value || '0');
    const status = tx.status;
    const from = tx.from?.hash || 'unknown';

    if (!methods[method]) methods[method] = { count: 0, value: 0n, failed: 0 };
    methods[method].count++;
    methods[method].value += val;
    if (status === 'error') methods[method].failed++;

    if (val > 0n && status !== 'error') {
      totalIn += val;
      // Track by depositor
      if (!depositors[from]) depositors[from] = { deposit: 0n, locked: 0n, count: 0 };
      depositors[from].count++;
      if (method === '0x8b166bb4' || method === 'depositLockedUSDC') {
        depositors[from].locked += val;
      } else {
        depositors[from].deposit += val;
      }
    }
    if (val > 0n && status === 'error') failedValue += val;
  }

  console.log('--- Methods Summary ---');
  for (const [method, data] of Object.entries(methods).sort((a,b) => Number(b[1].value - a[1].value))) {
    const usdc = Number(data.value) / 1e18;
    console.log(method.padEnd(20), '|', data.count, 'txs |', usdc.toFixed(2), 'USDC | failed:', data.failed);
  }

  console.log('');
  console.log('Total successful value:', (Number(totalIn) / 1e18).toFixed(2), 'USDC');
  console.log('Failed tx value:', (Number(failedValue) / 1e18).toFixed(2), 'USDC');

  console.log('');
  console.log('--- TOP DEPOSITORS ---');
  const sorted = Object.entries(depositors)
    .map(([addr, data]) => ({ addr, total: data.deposit + data.locked, ...data }))
    .sort((a, b) => Number(b.total - a.total));

  for (const d of sorted.slice(0, 15)) {
    const total = Number(d.total) / 1e18;
    const locked = Number(d.locked) / 1e18;
    const deposit = Number(d.deposit) / 1e18;
    console.log(d.addr.slice(0, 10) + '...' + d.addr.slice(-6), '|', total.toFixed(2).padStart(10), 'USDC total |', locked.toFixed(2).padStart(8), 'locked |', deposit.toFixed(2).padStart(6), 'deposit |', d.count, 'txs');
  }
}

main();
