import { describe, it, expect } from 'vitest';
import { sanitizeIncidentIds } from '@/lib/incidents';

describe('sanitizeIncidentIds', () => {
  it('returns [] for non-array input', () => {
    expect(sanitizeIncidentIds(undefined)).toEqual([]);
    expect(sanitizeIncidentIds('abc')).toEqual([]);
    expect(sanitizeIncidentIds(null)).toEqual([]);
  });

  it('keeps non-empty strings, drops empties and non-strings, dedupes', () => {
    expect(sanitizeIncidentIds(['a', '', '  ', 'b', 'a', 2, null, ' c '])).toEqual(['a', 'b', 'c']);
  });

  it('caps to max', () => {
    const ids = Array.from({ length: 500 }, (_, i) => `id${i}`);
    expect(sanitizeIncidentIds(ids, 200)).toHaveLength(200);
  });
});
