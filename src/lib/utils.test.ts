import { describe, it, expect } from 'vitest';
import { formatNumberPlain, cn } from './utils';

describe('formatNumberPlain', () => {
  it('returns em dash for null', () => {
    expect(formatNumberPlain(null)).toBe('—');
  });

  it('formats zero', () => {
    expect(formatNumberPlain(0)).toBe('0');
  });

  it('returns em dash for NaN string', () => {
    expect(formatNumberPlain('abc')).toBe('—');
  });
});

describe('cn', () => {
  it('merges classes', () => {
    expect(cn('a', 'c')).toBe('a c');
  });
});
