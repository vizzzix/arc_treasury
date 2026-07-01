import { describe, it, expect } from 'vitest';
import {
  isValidUUID,
  isValidAddress,
  isValidTxHash,
  isValidDomain,
  isValidAmount,
  escapeHtml,
} from '../../../api/_lib/validate';

describe('isValidUUID', () => {
  it('accepts valid UUID', () => {
    expect(isValidUUID('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
  });

  it('rejects short string', () => {
    expect(isValidUUID('w1')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isValidUUID('')).toBe(false);
  });

  it('rejects UUID without hyphens', () => {
    expect(isValidUUID('123e4567e89b12d3a456426614174000')).toBe(false);
  });
});

describe('isValidAddress', () => {
  it('accepts valid 0x address', () => {
    expect(isValidAddress('0xed0037e27139a7792c7982640d045a9d9f2aae8b')).toBe(true);
  });

  it('accepts mixed case', () => {
    expect(isValidAddress('0xEd0037E27139a7792c7982640D045a9D9F2AAe8B')).toBe(true);
  });

  it('rejects short address', () => {
    expect(isValidAddress('0xabc')).toBe(false);
  });

  it('rejects missing prefix', () => {
    expect(isValidAddress('ed0037e27139a7792c7982640d045a9d9f2aae8b')).toBe(false);
  });
});

describe('isValidTxHash', () => {
  it('accepts valid 66-char tx hash', () => {
    expect(isValidTxHash('0x' + 'ab'.repeat(32))).toBe(true);
  });

  it('rejects short hash', () => {
    expect(isValidTxHash('0xabc')).toBe(false);
  });

  it('rejects non-hex characters', () => {
    expect(isValidTxHash('0x' + 'zz'.repeat(32))).toBe(false);
  });
});

describe('isValidDomain', () => {
  it('accepts "0"', () => {
    expect(isValidDomain('0')).toBe(true);
  });

  it('accepts "26"', () => {
    expect(isValidDomain('26')).toBe(true);
  });

  it('rejects negative', () => {
    expect(isValidDomain('-1')).toBe(false);
  });

  it('rejects non-numeric', () => {
    expect(isValidDomain('abc')).toBe(false);
  });

  it('rejects > 100', () => {
    expect(isValidDomain('101')).toBe(false);
  });
});

describe('isValidAmount', () => {
  it('accepts "100"', () => {
    expect(isValidAmount('100')).toBe(true);
  });

  it('accepts "0.01"', () => {
    expect(isValidAmount('0.01')).toBe(true);
  });

  it('rejects "0"', () => {
    expect(isValidAmount('0')).toBe(false);
  });

  it('rejects negative', () => {
    expect(isValidAmount('-10')).toBe(false);
  });

  it('rejects non-numeric', () => {
    expect(isValidAmount('abc')).toBe(false);
  });

  // Strict decimal format: parseFloat alone would accept these,
  // but BigInt conversion downstream (toMicro) would throw on them
  it('rejects trailing garbage "5abc"', () => {
    expect(isValidAmount('5abc')).toBe(false);
  });

  it('rejects scientific notation "1e3"', () => {
    expect(isValidAmount('1e3')).toBe(false);
  });

  it('rejects whitespace-padded " 5 "', () => {
    expect(isValidAmount(' 5 ')).toBe(false);
  });

  it('rejects amount over max', () => {
    expect(isValidAmount('1000000001')).toBe(false);
  });
});

describe('escapeHtml', () => {
  it('escapes angle brackets', () => {
    expect(escapeHtml('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('escapes ampersands', () => {
    expect(escapeHtml('a & b')).toBe('a &amp; b');
  });

  it('escapes quotes', () => {
    expect(escapeHtml('"hello"')).toBe('&quot;hello&quot;');
  });

  it('escapes single quotes', () => {
    expect(escapeHtml("it's")).toBe("it&#39;s");
  });

  it('leaves safe text unchanged', () => {
    expect(escapeHtml('Hello World 123')).toBe('Hello World 123');
  });
});
