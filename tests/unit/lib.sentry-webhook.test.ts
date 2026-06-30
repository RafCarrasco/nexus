import { describe, it, expect } from 'vitest';
import { mapSentryWebhook } from '@/lib/sentry-webhook';

describe('mapSentryWebhook', () => {
  it('parses an issue-alert webhook (Internal Integration shape)', () => {
    const body = {
      action: 'created',
      data: {
        issue: {
          id: '123456',
          title: 'claim queue: 400 code 23514',
          culprit: 'notification-dispatcher/index.ts in claimQueued',
          level: 'error',
          status: 'unresolved',
          count: '719',
          project: { slug: 'acume-edge-functions', name: 'acume-edge-functions' },
          web_url: 'https://pg-consulting.sentry.io/issues/123456/',
        },
      },
    };
    const r = mapSentryWebhook(body)!;
    expect(r.issueId).toBe('123456');
    expect(r.projectSlug).toBe('acume-edge-functions');
    expect(r.title).toContain('23514');
    expect(r.culprit).toContain('claimQueued');
    expect(r.severity).toBe('crit');
    expect(r.count).toBe(719);
    expect(r.isResolved).toBe(false);
    expect(r.permalink).toContain('sentry.io');
  });

  it('maps warning level to warn severity', () => {
    const r = mapSentryWebhook({ data: { issue: { id: '1', title: 'x', level: 'warning' } } })!;
    expect(r.severity).toBe('warn');
  });

  it('flags resolution from action or status', () => {
    expect(mapSentryWebhook({ action: 'resolved', data: { issue: { id: '1', title: 'x' } } })!.isResolved).toBe(true);
    expect(mapSentryWebhook({ data: { issue: { id: '1', title: 'x', status: 'ignored' } } })!.isResolved).toBe(true);
  });

  it('falls back to event payload and metadata when issue is absent', () => {
    const r = mapSentryWebhook({ data: { event: { issue_id: '99', project: 'frontend', metadata: { value: 'TypeError: boom' } } } })!;
    expect(r.issueId).toBe('99');
    expect(r.projectSlug).toBe('frontend');
    expect(r.title).toBe('TypeError: boom');
  });

  it('returns null when there is nothing usable', () => {
    expect(mapSentryWebhook(null)).toBeNull();
    expect(mapSentryWebhook({ action: 'created', data: {} })).toBeNull();
  });

  it('clamps a hostile issueId and title to bounded lengths', () => {
    const r = mapSentryWebhook({
      data: { issue: { id: 'A'.repeat(10_000), title: 'B'.repeat(10_000), project: { slug: 'p' } } },
    })!;
    expect(r.issueId!.length).toBe(64);
    expect(r.title.length).toBe(500);
  });

  it('rejects a non-https permalink (javascript:/data:) but keeps https', () => {
    const bad = mapSentryWebhook({ data: { issue: { id: '1', title: 'x', web_url: 'javascript:alert(1)' } } })!;
    expect(bad.permalink).toBeNull();
    const ok = mapSentryWebhook({ data: { issue: { id: '1', title: 'x', web_url: 'https://sentry.io/i/1/' } } })!;
    expect(ok.permalink).toBe('https://sentry.io/i/1/');
  });

  it('drops an overflowing count instead of returning a column-overflowing number', () => {
    const r = mapSentryWebhook({ data: { issue: { id: '1', title: 'x', count: 9_007_199_254_740_991 } } })!;
    expect(r.count).toBeNull();
  });
});
