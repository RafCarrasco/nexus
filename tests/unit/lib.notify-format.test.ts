import { describe, it, expect } from 'vitest';
import type { Incident } from '@prisma/client';
import { formatPayload, severityColor } from '@/lib/notify-format';
import type { IncidentContext } from '@/notify/types';

const OPENED = new Date('2026-06-13T10:00:00.000Z');
const RESOLVED = new Date('2026-06-13T11:30:00.000Z');

function incident(over: Partial<Incident> = {}): Incident {
  return {
    id: 'inc1',
    resourceId: null,
    uptimeCheckId: null,
    alertRuleId: null,
    type: 'health_bad',
    severity: 'crit',
    message: 'tudo pegando fogo',
    openedAt: OPENED,
    resolvedAt: null,
    payload: null,
    ...over,
  } as Incident;
}

const resourceCtx = (phase: 'open' | 'resolve'): IncidentContext => ({
  source: 'resource',
  label: 'API de produção',
  kind: 'app-service',
  phase,
});
const uptimeCtx = (phase: 'open' | 'resolve'): IncidentContext => ({
  source: 'uptime',
  label: 'Site público',
  kind: 'GET',
  url: 'https://exemplo.com/health',
  phase,
});
const alertCtx = (phase: 'open' | 'resolve'): IncidentContext => ({
  source: 'alert',
  label: 'Custo acima do orçamento',
  kind: 'cost_30d',
  phase,
});

describe('severityColor', () => {
  it('maps each severity to a distinct color when opening', () => {
    expect(severityColor('crit', 'open')).toBe('#dc2626');
    expect(severityColor('warn', 'open')).toBe('#f59e0b');
    expect(severityColor('info', 'open')).toBe('#3b82f6');
  });

  it('falls back to info color for unknown severity', () => {
    expect(severityColor('weird', 'open')).toBe('#3b82f6');
  });

  it('always uses green on resolve regardless of severity', () => {
    expect(severityColor('crit', 'resolve')).toBe('#16a34a');
    expect(severityColor('warn', 'resolve')).toBe('#16a34a');
  });
});

describe('formatPayload — Slack', () => {
  it('open: text + colored attachment by severity', () => {
    const p = formatPayload('slack', incident({ severity: 'crit' }), resourceCtx('open')) as {
      text: string;
      attachments: { color: string; text: string; fields: unknown[] }[];
    };
    expect(p.text).toContain('[Aberto]');
    expect(p.text).toContain('API de produção');
    expect(p.attachments[0].color).toBe('#dc2626');
    expect(p.attachments[0].text).toBe('tudo pegando fogo');
  });

  it('resolve: green attachment and Resolvido heading', () => {
    const p = formatPayload(
      'slack',
      incident({ severity: 'crit', resolvedAt: RESOLVED }),
      resourceCtx('resolve'),
    ) as { text: string; attachments: { color: string }[] };
    expect(p.text).toContain('[Resolvido]');
    expect(p.attachments[0].color).toBe('#16a34a');
  });

  it('includes the url field for an uptime source', () => {
    const p = formatPayload('slack', incident(), uptimeCtx('open')) as {
      attachments: { fields: { title: string; value: string }[] }[];
    };
    const urlField = p.attachments[0].fields.find((f) => f.title === 'URL');
    expect(urlField?.value).toBe('https://exemplo.com/health');
  });
});

describe('formatPayload — Teams', () => {
  it('open: MessageCard with themeColor (no #) by severity', () => {
    const p = formatPayload('teams', incident({ severity: 'warn' }), alertCtx('open')) as {
      '@type': string;
      themeColor: string;
      title: string;
      sections: { facts: { name: string; value: string }[] }[];
    };
    expect(p['@type']).toBe('MessageCard');
    expect(p.themeColor).toBe('f59e0b');
    expect(p.title).toContain('Alerta');
    expect(p.sections[0].facts.some((f) => f.name === 'Severidade' && f.value === 'warn')).toBe(true);
  });

  it('resolve: green themeColor', () => {
    const p = formatPayload(
      'teams',
      incident({ resolvedAt: RESOLVED }),
      uptimeCtx('resolve'),
    ) as { themeColor: string };
    expect(p.themeColor).toBe('16a34a');
  });
});

describe('formatPayload — generic webhook', () => {
  it('open from a resource: flat shape with phase/source/severity', () => {
    const p = formatPayload('webhook', incident(), resourceCtx('open')) as Record<string, unknown>;
    expect(p).toMatchObject({
      event: 'incident',
      phase: 'open',
      source: 'resource',
      label: 'API de produção',
      type: 'health_bad',
      severity: 'crit',
      message: 'tudo pegando fogo',
      openedAt: OPENED.toISOString(),
      resolvedAt: null,
    });
  });

  it('resolve from an alert: carries resolvedAt and alert source', () => {
    const p = formatPayload(
      'webhook',
      incident({ type: 'alert', severity: 'warn', resolvedAt: RESOLVED }),
      alertCtx('resolve'),
    ) as Record<string, unknown>;
    expect(p).toMatchObject({
      phase: 'resolve',
      source: 'alert',
      type: 'alert',
      resolvedAt: RESOLVED.toISOString(),
    });
  });

  it('resolve from uptime: includes the url', () => {
    const p = formatPayload(
      'webhook',
      incident({ type: 'uptime_down', resolvedAt: RESOLVED }),
      uptimeCtx('resolve'),
    ) as Record<string, unknown>;
    expect(p).toMatchObject({ source: 'uptime', url: 'https://exemplo.com/health', phase: 'resolve' });
  });

  it('email uses the generic webhook shape as carrier', () => {
    const p = formatPayload('email', incident(), resourceCtx('open')) as Record<string, unknown>;
    expect(p.event).toBe('incident');
    expect(p.source).toBe('resource');
  });
});
