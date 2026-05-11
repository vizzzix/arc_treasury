import { describe, it, expect, vi } from 'vitest';
import { safeStringify } from '../utils';

vi.mock('@/lib/supabase', () => ({
  supabase: null,
}));

describe('safeStringify', () => {
  it('serializes plain objects', () => {
    expect(safeStringify({ a: 1, b: 'hello' })).toBe('{"a":1,"b":"hello"}');
  });

  it('converts BigInt to string', () => {
    const result = safeStringify({ amount: 123n });
    expect(result).toBe('{"amount":"123"}');
  });

  it('handles nested BigInt values', () => {
    const obj = { outer: { inner: 999_999_999n } };
    const result = JSON.parse(safeStringify(obj));
    expect(result.outer.inner).toBe('999999999');
  });

  it('handles null and undefined', () => {
    expect(safeStringify(null)).toBe('null');
    expect(safeStringify(undefined)).toBeUndefined();
    expect(safeStringify({ a: null, b: undefined })).toBe('{"a":null}');
  });

  it('handles arrays with BigInt', () => {
    const result = safeStringify([1n, 2n, 3n]);
    expect(result).toBe('["1","2","3"]');
  });

  it('applies indentation with space parameter', () => {
    const result = safeStringify({ a: 1 }, 2);
    expect(result).toContain('\n');
    expect(result).toContain('  "a"');
  });

  it('handles empty object', () => {
    expect(safeStringify({})).toBe('{}');
  });

  it('handles mixed types including BigInt', () => {
    const obj = {
      name: 'test',
      amount: 100n,
      active: true,
      nested: { fee: 50n },
    };
    const parsed = JSON.parse(safeStringify(obj));
    expect(parsed.name).toBe('test');
    expect(parsed.amount).toBe('100');
    expect(parsed.active).toBe(true);
    expect(parsed.nested.fee).toBe('50');
  });
});
