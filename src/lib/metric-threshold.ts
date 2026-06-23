/**
 * Pure comparison helpers for the metric threshold evaluator. Kept separate from the
 * collector so the operator logic is unit-testable without a DB.
 */

export const METRIC_OPERATORS = ['gt', 'gte', 'lt', 'lte', 'eq'] as const;
export type MetricOperator = (typeof METRIC_OPERATORS)[number];

export const OP_LABEL: Record<MetricOperator, string> = {
  gt: '>',
  gte: '≥',
  lt: '<',
  lte: '≤',
  eq: '=',
};

export function isMetricOperator(s: string): s is MetricOperator {
  return (METRIC_OPERATORS as readonly string[]).includes(s);
}

/** Evaluate `value <op> threshold`. Unknown operators never breach. */
export function compareMetric(value: number, op: string, threshold: number): boolean {
  switch (op) {
    case 'gt':
      return value > threshold;
    case 'gte':
      return value >= threshold;
    case 'lt':
      return value < threshold;
    case 'lte':
      return value <= threshold;
    case 'eq':
      return value === threshold;
    default:
      return false;
  }
}

/** Stable incident type for a threshold so dedup is per (resource, metricName). */
export function thresholdIncidentType(metricName: string): string {
  return `metric_threshold:${metricName}`;
}
