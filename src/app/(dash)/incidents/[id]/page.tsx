import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/db/client';
import { Badge } from '@/ui/components/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/components/card';
import { ResolveToggle } from './resolve-toggle';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Full timestamp like '2026-06-23 14:05:09' (UTC, matching the incidents list). */
function fullTs(d: Date): string {
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

/** Humanize a millisecond span as 'Xh Ym' (drops the hour part when < 1h). */
function humanizeDuration(ms: number): string {
  const totalMin = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/**
 * Duration label for an incident. Kept out of the component body so the
 * request-time read (Date.now) isn't flagged as impure render work.
 */
function durationLabel(openedAt: Date, resolvedAt: Date | null): string {
  if (resolvedAt) return `ficou aberto ${humanizeDuration(resolvedAt.getTime() - openedAt.getTime())}`;
  return `aberto há ${humanizeDuration(Date.now() - openedAt.getTime())}`;
}

/** crit → rose, warn → amber, anything else → zinc. */
function severityClasses(severity: string): string {
  if (severity === 'crit')
    return 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300';
  if (severity === 'warn')
    return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300';
  return 'border-zinc-200 bg-zinc-100 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-300';
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-1 py-3 sm:grid-cols-[160px_1fr] sm:gap-4">
      <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd className="text-sm text-zinc-900 dark:text-zinc-100">{children}</dd>
    </div>
  );
}

export default async function IncidentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const incident = await prisma.incident.findUnique({
    where: { id },
    include: {
      resource: { include: { connection: true } },
      uptimeCheck: true,
      aiProbe: true,
    },
  });
  if (!incident) return notFound();

  const resolved = incident.resolvedAt != null;

  // Origin: exactly one of resource / uptimeCheck / aiProbe is set (or none).
  let originLabel = 'Recurso';
  let originName = '—';
  let originHref: string | null = null;
  if (incident.resource) {
    originLabel = 'Recurso';
    originName = incident.resource.name;
    originHref = `/resources/${incident.resourceId}`;
  } else if (incident.uptimeCheck) {
    originLabel = 'Uptime';
    originName = incident.uptimeCheck.name;
    originHref = '/uptime';
  } else if (incident.aiProbe) {
    originLabel = 'Probe IA';
    originName = incident.aiProbe.name;
    originHref = '/probes';
  }

  const entityName = originName;

  // Duration: open span when resolved, age when still open.
  const durationText = durationLabel(incident.openedAt, incident.resolvedAt);

  // payload is Json (unknown) — guard before rendering.
  const hasPayload =
    incident.payload != null &&
    !(Array.isArray(incident.payload) && incident.payload.length === 0) &&
    !(typeof incident.payload === 'object' && Object.keys(incident.payload as object).length === 0);
  let payloadPretty = '';
  if (hasPayload) {
    try {
      payloadPretty = JSON.stringify(incident.payload, null, 2);
    } catch {
      payloadPretty = String(incident.payload);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Link
            href="/incidents"
            className="text-xs text-zinc-500 transition-colors hover:text-violet-600 dark:text-zinc-400"
          >
            ← Incidentes
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              {entityName}
            </h1>
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${severityClasses(
                incident.severity,
              )}`}
            >
              {incident.severity}
            </span>
            {resolved ? (
              <Badge variant="active">Resolvido</Badge>
            ) : (
              <Badge variant="violet">Aberto</Badge>
            )}
          </div>
        </div>
        <ResolveToggle id={incident.id} resolved={resolved} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Detalhes</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="divide-y divide-zinc-100 dark:divide-zinc-800">
            <DetailRow label="Tipo">
              <span className="text-zinc-600 dark:text-zinc-300">{incident.type}</span>
            </DetailRow>
            <DetailRow label="Severidade">
              <span
                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${severityClasses(
                  incident.severity,
                )}`}
              >
                {incident.severity}
              </span>
            </DetailRow>
            <DetailRow label="Mensagem">
              <span className="whitespace-pre-wrap break-words">{incident.message}</span>
            </DetailRow>
            <DetailRow label="Origem">
              {originHref ? (
                <Link
                  href={originHref as never}
                  className="font-medium text-violet-600 transition-colors hover:text-violet-700 dark:text-violet-400"
                >
                  {originLabel}: {originName}
                </Link>
              ) : (
                <span className="text-zinc-600 dark:text-zinc-300">
                  {originLabel}: {originName}
                </span>
              )}
            </DetailRow>
            <DetailRow label="Aberto em">
              <span className="font-mono text-xs text-zinc-600 dark:text-zinc-300">{fullTs(incident.openedAt)}</span>
              {!resolved && <span className="ml-2 text-zinc-500 dark:text-zinc-400">· {durationText}</span>}
            </DetailRow>
            <DetailRow label="Resolvido em">
              {resolved ? (
                <>
                  <span className="font-mono text-xs text-zinc-600 dark:text-zinc-300">
                    {fullTs(incident.resolvedAt!)}
                  </span>
                  <span className="ml-2 text-zinc-500 dark:text-zinc-400">· {durationText}</span>
                </>
              ) : (
                <span className="text-zinc-400 dark:text-zinc-500">—</span>
              )}
            </DetailRow>
            {hasPayload && (
              <DetailRow label="Payload">
                <pre className="max-h-96 overflow-auto rounded-lg border border-zinc-200 bg-zinc-50 p-3 font-mono text-xs text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
                  {payloadPretty}
                </pre>
              </DetailRow>
            )}
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
