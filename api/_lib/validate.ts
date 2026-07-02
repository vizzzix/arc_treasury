const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ETH_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const TX_HASH_RE = /^0x[a-fA-F0-9]{64}$/;

export function isValidUUID(id: string): boolean {
  return typeof id === 'string' && UUID_RE.test(id);
}

export function isValidAddress(addr: string): boolean {
  return typeof addr === 'string' && ETH_ADDRESS_RE.test(addr);
}

export function isValidTxHash(hash: string): boolean {
  return typeof hash === 'string' && TX_HASH_RE.test(hash);
}

export function isValidDomain(domain: string | number): boolean {
  const n = typeof domain === 'string' ? parseInt(domain, 10) : domain;
  return Number.isFinite(n) && n >= 0 && n <= 100;
}

// Strict decimal format only: downstream conversion uses BigInt on the raw
// string (toMicro), which throws on inputs parseFloat would accept ("5abc", "1e3")
const AMOUNT_RE = /^\d+(\.\d+)?$/;

export function isValidAmount(amount: string): boolean {
  if (typeof amount !== 'string' || !AMOUNT_RE.test(amount)) return false;
  const n = parseFloat(amount);
  return Number.isFinite(n) && n > 0 && n < 1_000_000_000;
}

// Raw positive integer string in base units (e.g. 18-decimal shares / LP passed
// directly as a uint256 argument). isValidAmount is for human decimals and caps
// at 1e9, so it would wrongly reject wei-scale integers like "5000000000000000000".
const UINT_RE = /^\d+$/;
const UINT256_MAX = 2n ** 256n - 1n;

export function isValidUintString(s: string): boolean {
  if (typeof s !== 'string' || !UINT_RE.test(s)) return false;
  try {
    const n = BigInt(s);
    return n > 0n && n <= UINT256_MAX;
  } catch {
    return false;
  }
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
