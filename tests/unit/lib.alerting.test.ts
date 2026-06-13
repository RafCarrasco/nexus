import { describe, it, expect } from 'vitest';
import { evaluateAlert } from '@/lib/alerting';

describe('evaluateAlert', () => {
  it('opens an incident on the transition into firing (gt)', () => {
    expect(evaluateAlert(100, 'gt', 50, false)).toEqual({ firing: true, openIncident: true, resolveIncident: false });
  });

  it('does not re-open while already firing', () => {
    expect(evaluateAlert(100, 'gt', 50, true)).toEqual({ firing: true, openIncident: false, resolveIncident: false });
  });

  it('resolves on the transition out of firing', () => {
    expect(evaluateAlert(10, 'gt', 50, true)).toEqual({ firing: false, openIncident: false, resolveIncident: true });
  });

  it('stays quiet when under threshold and not firing', () => {
    expect(evaluateAlert(10, 'gt', 50, false)).toEqual({ firing: false, openIncident: false, resolveIncident: false });
  });

  it('supports the lt operator', () => {
    expect(evaluateAlert(5, 'lt', 10, false)).toMatchObject({ firing: true, openIncident: true });
    expect(evaluateAlert(20, 'lt', 10, true)).toMatchObject({ firing: false, resolveIncident: true });
  });
});
