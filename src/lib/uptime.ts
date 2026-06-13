export type UptimeStatus = 'up' | 'down';

export type UptimeState = {
  consecutiveFails: number;
  lastStatus: UptimeStatus | null;
};

export type UptimeProbe = {
  ok: boolean;
  status?: number;
  error?: string;
};

export type UptimeTransition = {
  consecutiveFails: number;
  lastStatus: UptimeStatus;
  openIncident: boolean; // crossed the failure threshold this tick
  resolveIncident: boolean; // recovered this tick
};

/**
 * Pure state machine for a single uptime check tick. A check only flips to 'down'
 * (and opens an incident) after `failThreshold` consecutive failures — this debounces
 * transient blips. Recovery resolves an open incident and resets the fail counter.
 */
export function evaluateUptime(prev: UptimeState, probe: UptimeProbe, failThreshold: number): UptimeTransition {
  if (probe.ok) {
    return {
      consecutiveFails: 0,
      lastStatus: 'up',
      openIncident: false,
      resolveIncident: prev.lastStatus === 'down',
    };
  }

  const fails = prev.consecutiveFails + 1;
  const down = fails >= Math.max(1, failThreshold);
  const wasDown = prev.lastStatus === 'down';
  return {
    consecutiveFails: fails,
    lastStatus: down ? 'down' : wasDown ? 'down' : 'up',
    openIncident: down && !wasDown,
    resolveIncident: false,
  };
}
