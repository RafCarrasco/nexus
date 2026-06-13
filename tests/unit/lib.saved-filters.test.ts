import { describe, it, expect } from 'vitest';
import {
  SAVED_FILTER_PAGES,
  ALLOWED_PARAMS,
  isValidPage,
  sanitizeQuery,
  queryToSearchString,
} from '@/lib/saved-filters';

describe('isValidPage', () => {
  it('accepts exactly the two supported pages', () => {
    expect(isValidPage('resources')).toBe(true);
    expect(isValidPage('incidents')).toBe(true);
    expect(SAVED_FILTER_PAGES).toEqual(['resources', 'incidents']);
  });

  it('rejects everything else (incl. the deferred cost page)', () => {
    expect(isValidPage('cost')).toBe(false);
    expect(isValidPage('')).toBe(false);
    expect(isValidPage('uptime')).toBe(false);
    expect(isValidPage(undefined)).toBe(false);
    expect(isValidPage(42)).toBe(false);
  });
});

describe('sanitizeQuery', () => {
  it('is page-scoped — a key allowed for incidents is dropped for resources', () => {
    // `severity` is valid for incidents but NOT for resources.
    expect(sanitizeQuery('resources', { severity: 'crit', q: 'api' })).toEqual({ q: 'api' });
    expect(sanitizeQuery('incidents', { severity: 'crit', q: 'api' })).toEqual({ severity: 'crit' });
  });

  it('drops unknown keys and empty/whitespace/nullish values', () => {
    expect(
      sanitizeQuery('resources', {
        client: 'acme',
        bogus: 'x',
        q: '',
        type: '   ',
        nope: null,
        also: undefined,
      }),
    ).toEqual({ client: 'acme' });
  });

  it('coerces non-string values to strings and trims', () => {
    expect(sanitizeQuery('incidents', { type: 123 as unknown as string, severity: '  warn  ' })).toEqual({
      type: '123',
      severity: 'warn',
    });
  });

  it('caps value length to ~80 chars', () => {
    const long = 'a'.repeat(200);
    const out = sanitizeQuery('resources', { q: long });
    expect(out.q).toHaveLength(80);
  });

  it('returns keys sorted and stable regardless of input order', () => {
    const a = sanitizeQuery('resources', { q: 'x', type: 'firebase', client: 'acme' });
    const b = sanitizeQuery('resources', { client: 'acme', q: 'x', type: 'firebase' });
    expect(Object.keys(a)).toEqual(['client', 'q', 'type']);
    expect(a).toEqual(b);
  });

  it('returns empty object for an unknown page', () => {
    expect(sanitizeQuery('cost', { foo: 'bar' })).toEqual({});
  });
});

describe('queryToSearchString', () => {
  it('encodes a query object and round-trips back through sanitizeQuery', () => {
    const q = sanitizeQuery('resources', { q: 'api gateway', type: 'firebase' });
    const s = queryToSearchString(q);
    expect(s).toBe('q=api+gateway&type=firebase');
    const parsed = Object.fromEntries(new URLSearchParams(s));
    expect(sanitizeQuery('resources', parsed)).toEqual(q);
  });

  it('percent-encodes special characters', () => {
    expect(queryToSearchString({ q: 'a&b=c' })).toBe('q=a%26b%3Dc');
  });

  it('produces an empty string for an empty query', () => {
    expect(queryToSearchString({})).toBe('');
  });
});

describe('ALLOWED_PARAMS', () => {
  it('matches the documented per-page allow-lists', () => {
    expect(ALLOWED_PARAMS.resources).toEqual(['client', 'type', 'q']);
    expect(ALLOWED_PARAMS.incidents).toEqual(['severity', 'type']);
    expect(ALLOWED_PARAMS.cost).toBeUndefined();
  });
});
