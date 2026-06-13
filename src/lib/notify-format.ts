import type { Incident } from '@prisma/client';
import type { IncidentContext } from '@/notify/types';

/**
 * Pure payload formatting for outbound notification channels. No IO, no secrets.
 * Given the channel type, the incident, and its context, returns the JSON body to POST.
 * Keep this side-effect free so it stays trivially unit-testable.
 */

export type ChannelType = 'webhook' | 'slack' | 'teams' | 'email';

/** Severity → hex color (Slack attachment color / Teams themeColor, no leading '#' variants kept consistent). */
const SEVERITY_COLOR: Record<string, string> = {
  crit: '#dc2626', // red-600
  error: '#dc2626',
  warn: '#f59e0b', // amber-500
  info: '#3b82f6', // blue-500
};

const RESOLVED_COLOR = '#16a34a'; // green-600

/** Color for an incident given its phase + severity. Resolve is always green. */
export function severityColor(severity: string, phase: 'open' | 'resolve'): string {
  if (phase === 'resolve') return RESOLVED_COLOR;
  return SEVERITY_COLOR[severity] ?? SEVERITY_COLOR.info;
}

const SOURCE_LABEL: Record<IncidentContext['source'], string> = {
  resource: 'Recurso',
  uptime: 'Uptime',
  alert: 'Alerta',
};

function title(incident: Incident, ctx: IncidentContext): string {
  const verb = ctx.phase === 'resolve' ? 'Resolvido' : 'Aberto';
  return `[${verb}] ${SOURCE_LABEL[ctx.source]}: ${ctx.label}`;
}

function isoOrNull(d: Date | null): string | null {
  return d ? new Date(d).toISOString() : null;
}

/** Generic webhook body — flat, stable shape consumers can map however they like. */
function formatWebhook(incident: Incident, ctx: IncidentContext): Record<string, unknown> {
  return {
    event: 'incident',
    phase: ctx.phase,
    source: ctx.source,
    label: ctx.label,
    kind: ctx.kind ?? null,
    type: incident.type,
    severity: incident.severity,
    message: incident.message,
    url: ctx.url ?? null,
    openedAt: isoOrNull(incident.openedAt),
    resolvedAt: isoOrNull(incident.resolvedAt),
  };
}

/** Slack incoming-webhook body: top-level text + a colored attachment. */
function formatSlack(incident: Incident, ctx: IncidentContext): Record<string, unknown> {
  const heading = title(incident, ctx);
  const fields = [
    { title: 'Tipo', value: incident.type, short: true },
    { title: 'Severidade', value: incident.severity, short: true },
  ];
  if (ctx.url) fields.push({ title: 'URL', value: ctx.url, short: false });
  return {
    text: heading,
    attachments: [
      {
        color: severityColor(incident.severity, ctx.phase),
        title: heading,
        text: incident.message,
        fields,
        ts: Math.floor(
          (ctx.phase === 'resolve' && incident.resolvedAt
            ? new Date(incident.resolvedAt).getTime()
            : new Date(incident.openedAt).getTime()) / 1000,
        ),
      },
    ],
  };
}

/** Microsoft Teams legacy MessageCard (incoming-webhook compatible). */
function formatTeams(incident: Incident, ctx: IncidentContext): Record<string, unknown> {
  const heading = title(incident, ctx);
  const facts = [
    { name: 'Origem', value: SOURCE_LABEL[ctx.source] },
    { name: 'Tipo', value: incident.type },
    { name: 'Severidade', value: incident.severity },
  ];
  if (ctx.url) facts.push({ name: 'URL', value: ctx.url });
  if (incident.resolvedAt) facts.push({ name: 'Resolvido em', value: new Date(incident.resolvedAt).toISOString() });
  else facts.push({ name: 'Aberto em', value: new Date(incident.openedAt).toISOString() });
  return {
    '@type': 'MessageCard',
    '@context': 'http://schema.org/extensions',
    themeColor: severityColor(incident.severity, ctx.phase).replace('#', ''),
    summary: heading,
    title: heading,
    sections: [
      {
        activityTitle: ctx.label,
        text: incident.message,
        facts,
        markdown: false,
      },
    ],
  };
}

/**
 * Build the POST body for a channel type. Email uses the generic webhook shape as a
 * data carrier (the SMTP transport is responsible for turning it into a message);
 * the three real HTTP channels each get their native format.
 */
export function formatPayload(type: ChannelType, incident: Incident, ctx: IncidentContext): Record<string, unknown> {
  switch (type) {
    case 'slack':
      return formatSlack(incident, ctx);
    case 'teams':
      return formatTeams(incident, ctx);
    case 'webhook':
    case 'email':
    default:
      return formatWebhook(incident, ctx);
  }
}
