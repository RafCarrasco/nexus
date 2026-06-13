export type AlertEval = {
  firing: boolean;
  openIncident: boolean; // crossed into firing this tick
  resolveIncident: boolean; // recovered this tick
};

/**
 * Pure evaluation of one alert rule tick. `gt` fires when value > threshold, `lt` when
 * value < threshold. An incident opens only on the transition into firing and resolves
 * on the transition out — no duplicate incidents while it stays firing.
 */
export function evaluateAlert(
  value: number,
  operator: string,
  threshold: number,
  wasFiring: boolean,
): AlertEval {
  const breached = operator === 'lt' ? value < threshold : value > threshold;
  return {
    firing: breached,
    openIncident: breached && !wasFiring,
    resolveIncident: !breached && wasFiring,
  };
}
