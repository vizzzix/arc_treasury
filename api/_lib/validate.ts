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

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
