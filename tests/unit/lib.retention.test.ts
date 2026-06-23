import { describe, it, expect } from 'vitest';
import { cutoff, RETENTION_DAYS } from '@/lib/retention';

describe('cutoff', () => {
  it('subtracts the given number of days', () => {
    const now = new Date('2026-06-23T12:00:00.000Z');
    expect(cutoff(now, 14).toISOString()).toBe('2026-06-09T12:00:00.000Z');
    expect(cutoff(now, 90).toISOString()).toBe('2026-03-25T12:00:00.000Z');
  });

  it('does not mutate the input date', () => {
    const now = new Date('2026-06-23T12:00:00.000Z');
    cutoff(now, 14);
    expect(now.toISOString()).toBe('2026-06-23T12:00:00.000Z');
  });
});

describe('RETENTION_DAYS', () => {
  it('keeps the latency baseline window (7d) plus margin for uptime samples', () => {
    expect(RETENTION_DAYS.uptimeSample).toBeGreaterThanOrEqual(7);
    expect(RETENTION_DAYS.metric).toBeGreaterThan(RETENTION_DAYS.uptimeSample);
  });
});
