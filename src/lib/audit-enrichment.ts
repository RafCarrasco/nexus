import { prisma } from '@/db/client';
import { log } from '@/lib/logger';

/**
 * Audit entries store a raw `target` (usually an entity id) and a dotted `action`
 * (e.g. 'connection.create'). This module turns that into something legible:
 * a friendly PT-BR action label, an entity-type badge, and the entity's human name
 * resolved in BATCH (one findMany per type — never N+1).
 *
 * Graceful by design: a target whose entity was deleted (or whose type we don't
 * resolve, e.g. 'alert' after the alerts feature was removed) falls back to showing
 * the raw target. The page never breaks on a stale reference.
 */

export type EntityType =
  | 'connection'
  | 'workspace'
  | 'uptime'
  | 'channel'
  | 'client'
  | 'resource'
  | 'tenant'
  | 'incident'
  | 'filter'
  | 'alert'
  | 'system'
  | 'unknown';

export type EnrichedAudit = {
  actionLabel: string;
  entityType: EntityType;
  entityLabel: string;
  /** Human name to show in the ALVO column (resolved name, or the raw target as fallback). */
  targetName: string;
  /** True when targetName is a real resolved/human value; false when it's an unresolved raw id. */
  resolved: boolean;
};

const ACTION_LABELS: Record<string, string> = {
  'connection.create': 'Conexão criada',
  'connection.delete': 'Conexão removida',
  'workspace.create': 'App criado',
  'workspace.update': 'App editado',
  'workspace.delete': 'App removido',
  'uptime.create': 'Check de uptime criado',
  'uptime.delete': 'Check de uptime removido',
  'channel.create': 'Canal de notificação criado',
  'channel.delete': 'Canal de notificação removido',
  'channel.toggle': 'Canal de notificação alternado',
  'client.create': 'Cliente criado',
  'client.delete': 'Cliente removido',
  'resource.delete': 'Recurso removido',
  'tenant.delete': 'Tenant removido',
  'incident.resolve': 'Incidente resolvido',
  'incident.reopen': 'Incidente reaberto',
  'incident.bulk_resolve': 'Incidentes resolvidos em massa',
  'alert.create': 'Alerta criado',
  'alert.delete': 'Alerta removido',
  'savedFilter.create': 'Filtro salvo',
  'savedFilter.delete': 'Filtro removido',
  'collector.run': 'Coleta executada',
};

const ENTITY_LABELS: Record<EntityType, string> = {
  connection: 'Conexão',
  workspace: 'App',
  uptime: 'Uptime',
  channel: 'Canal',
  client: 'Cliente',
  resource: 'Recurso',
  tenant: 'Tenant',
  incident: 'Incidente',
  filter: 'Filtro',
  alert: 'Alerta',
  system: 'Sistema',
  unknown: '—',
};

/** Actions whose `target` is ALREADY a human string (not an id to resolve). */
const HUMAN_TARGET_ACTIONS = new Set(['collector.run', 'savedFilter.create', 'incident.bulk_resolve']);

function entityTypeOf(action: string): EntityType {
  const prefix = action.split('.')[0];
  switch (prefix) {
    case 'connection':
      return 'connection';
    case 'workspace':
      return 'workspace';
    case 'uptime':
      return 'uptime';
    case 'channel':
      return 'channel';
    case 'client':
      return 'client';
    case 'resource':
      return 'resource';
    case 'tenant':
      return 'tenant';
    case 'incident':
      return 'incident';
    case 'savedFilter':
      return 'filter';
    case 'alert':
      return 'alert';
    case 'collector':
      return 'system';
    default:
      return 'unknown';
  }
}

export function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

type Row = { id: string; action: string; target: string };

/**
 * Resolve a batch of audit rows to human display values. Groups id-targets by entity
 * type and issues ONE findMany per type. 'alert' is intentionally not resolved (the
 * AlertRule model was removed) — those rows fall back to the raw target.
 */
export async function enrichAuditEntries(rows: Row[]): Promise<Map<string, EnrichedAudit>> {
  // Collect the ids we actually need to resolve, grouped by type.
  const ids: Record<string, Set<string>> = {};
  for (const r of rows) {
    if (HUMAN_TARGET_ACTIONS.has(r.action)) continue;
    const t = entityTypeOf(r.action);
    if (t === 'alert' || t === 'system' || t === 'unknown') continue;
    (ids[t] ??= new Set()).add(r.target);
  }

  const names: Partial<Record<EntityType, Map<string, string>>> = {};
  const toMap = (arr: { id: string; name: string }[]) => new Map(arr.map((x) => [x.id, x.name]));

  // Each resolver is best-effort: a query failure logs and yields no names (raw-id fallback).
  await Promise.all([
    ids.connection &&
      prisma.connection
        .findMany({ where: { id: { in: [...ids.connection] } }, select: { id: true, name: true } })
        .then((r) => void (names.connection = toMap(r)))
        .catch((e) => log.warn('audit resolve connection failed', { err: (e as Error).message })),
    ids.workspace &&
      prisma.workspace
        .findMany({ where: { id: { in: [...ids.workspace] } }, select: { id: true, name: true } })
        .then((r) => void (names.workspace = toMap(r)))
        .catch((e) => log.warn('audit resolve workspace failed', { err: (e as Error).message })),
    ids.uptime &&
      prisma.uptimeCheck
        .findMany({ where: { id: { in: [...ids.uptime] } }, select: { id: true, name: true } })
        .then((r) => void (names.uptime = toMap(r)))
        .catch((e) => log.warn('audit resolve uptime failed', { err: (e as Error).message })),
    ids.channel &&
      prisma.notificationChannel
        .findMany({ where: { id: { in: [...ids.channel] } }, select: { id: true, name: true } })
        .then((r) => void (names.channel = toMap(r)))
        .catch((e) => log.warn('audit resolve channel failed', { err: (e as Error).message })),
    ids.client &&
      prisma.client
        .findMany({ where: { id: { in: [...ids.client] } }, select: { id: true, name: true } })
        .then((r) => void (names.client = toMap(r)))
        .catch((e) => log.warn('audit resolve client failed', { err: (e as Error).message })),
    ids.resource &&
      prisma.resource
        .findMany({ where: { id: { in: [...ids.resource] } }, select: { id: true, name: true } })
        .then((r) => void (names.resource = toMap(r)))
        .catch((e) => log.warn('audit resolve resource failed', { err: (e as Error).message })),
    ids.tenant &&
      prisma.tenant
        .findMany({ where: { id: { in: [...ids.tenant] } }, select: { id: true, displayName: true } })
        .then((r) => void (names.tenant = new Map(r.map((x) => [x.id, x.displayName]))))
        .catch((e) => log.warn('audit resolve tenant failed', { err: (e as Error).message })),
    ids.incident &&
      prisma.incident
        .findMany({ where: { id: { in: [...ids.incident] } }, select: { id: true, message: true } })
        .then((r) => void (names.incident = new Map(r.map((x) => [x.id, x.message]))))
        .catch((e) => log.warn('audit resolve incident failed', { err: (e as Error).message })),
  ]);

  const out = new Map<string, EnrichedAudit>();
  for (const r of rows) {
    const entityType = entityTypeOf(r.action);
    const base: EnrichedAudit = {
      actionLabel: actionLabel(r.action),
      entityType,
      entityLabel: ENTITY_LABELS[entityType],
      targetName: r.target,
      resolved: HUMAN_TARGET_ACTIONS.has(r.action) || entityType === 'system',
    };
    if (!base.resolved && entityType !== 'alert' && entityType !== 'unknown') {
      const name = names[entityType]?.get(r.target);
      if (name) {
        base.targetName = name;
        base.resolved = true;
      }
    }
    out.set(r.id, base);
  }
  return out;
}
