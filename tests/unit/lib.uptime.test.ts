import { describe, it, expect } from 'vitest';
import { evaluateUptime, type UptimeState } from '@/lib/uptime';

const start: UptimeState = { consecutiveFails: 0, lastStatus: null };

describe('evaluateUptime', () => {
  it('stays up on success', () => {
    const t = evaluateUptime({ consecutiveFails: 0, lastStatus: 'up' }, { ok: true, status: 200 }, 3);
    expect(t).toMatchObject({ consecutiveFails: 0, lastStatus: 'up', openIncident: false, resolveIncident: false });
  });

  it('debounces blips — no incident before the threshold', () => {
    const t1 = evaluateUptime(start, { ok: false, status: 500 }, 3);
    expect(t1).toMatchObject({ consecutiveFails: 1, lastStatus: 'up', openIncident: false });
    const t2 = evaluateUptime(t1, { ok: false, status: 500 }, 3);
    expect(t2).toMatchObject({ consecutiveFails: 2, lastStatus: 'up', openIncident: false });
  });

  it('opens an incident exactly when the threshold is crossed', () => {
    const t = evaluateUptime({ consecutiveFails: 2, lastStatus: 'up' }, { ok: false, error: 'timeout' }, 3);
    expect(t).toMatchObject({ consecutiveFails: 3, lastStatus: 'down', openIncident: true, resolveIncident: false });
  });

  it('does not re-open while already down', () => {
    const t = evaluateUptime({ consecutiveFails: 5, lastStatus: 'down' }, { ok: false, status: 502 }, 3);
    expect(t).toMatchObject({ lastStatus: 'down', openIncident: false });
  });

  it('resolves the incident on recovery', () => {
    const t = evaluateUptime({ consecutiveFails: 5, lastStatus: 'down' }, { ok: true, status: 200 }, 3);
    expect(t).toMatchObject({ consecutiveFails: 0, lastStatus: 'up', resolveIncident: true });
  });

  it('threshold of 1 trips on the first failure', () => {
    const t = evaluateUptime({ consecutiveFails: 0, lastStatus: 'up' }, { ok: false, status: 503 }, 1);
    expect(t).toMatchObject({ lastStatus: 'down', openIncident: true });
  });
});
