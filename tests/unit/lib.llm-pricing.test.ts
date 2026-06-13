import { describe, it, expect } from 'vitest';
import { pricePerMillion, estimateTokenCostUsd } from '@/lib/llm-pricing';

describe('llm-pricing', () => {
  it('prices known models by pattern', () => {
    expect(pricePerMillion('gpt-4o-mini')).toBe(0.3);
    expect(pricePerMillion('gpt-4o-2024-08-06')).toBe(5);
    expect(pricePerMillion('claude-sonnet-4-5')).toBe(6);
    expect(pricePerMillion('claude-3-5-haiku')).toBe(1);
  });

  it('falls back to the default rate for unknown/missing models', () => {
    expect(pricePerMillion(undefined)).toBe(2);
    expect(pricePerMillion('some-random-model')).toBe(2);
  });

  it('estimates cost from tokens', () => {
    expect(estimateTokenCostUsd(1_000_000, 'gpt-4o')).toBeCloseTo(5);
    expect(estimateTokenCostUsd(500_000, 'gpt-4o-mini')).toBeCloseTo(0.15);
    expect(estimateTokenCostUsd(0, 'gpt-4o')).toBe(0);
  });
});
