import { describe, it, expect } from 'vitest';
import {
  compareMetric,
  isMetricOperator,
  thresholdIncidentType,
  OP_LABEL,
} from '@/lib/metric-threshold';

describe('compareMetric', () => {
  it('evaluates each operator', () => {
    expect(compareMetric(90, 'gt', 85)).toBe(true);
    expect(compareMetric(85, 'gt', 85)).toBe(false);
    expect(compareMetric(85, 'gte', 85)).toBe(true);
    expect(compareMetric(5, 'lt', 10)).toBe(true);
    expect(compareMetric(10, 'lte', 10)).toBe(true);
    expect(compareMetric(3, 'eq', 3)).toBe(true);
    expect(compareMetric(3, 'eq', 4)).toBe(false);
  });

  it('never breaches on an unknown operator', () => {
    expect(compareMetric(999, 'nope', 0)).toBe(false);
  });
});

describe('isMetricOperator', () => {
  it('accepts known operators and rejects others', () => {
    expect(isMetricOperator('gte')).toBe(true);
    expect(isMetricOperator('between')).toBe(false);
  });
});

describe('thresholdIncidentType', () => {
  it('produces a stable per-metric type for dedup', () => {
    expect(thresholdIncidentType('cpu_pct')).toBe('metric_threshold:cpu_pct');
  });
});

describe('OP_LABEL', () => {
  it('has a human symbol for every operator', () => {
    expect(OP_LABEL.gt).toBe('>');
    expect(OP_LABEL.lte).toBe('≤');
  });
});
