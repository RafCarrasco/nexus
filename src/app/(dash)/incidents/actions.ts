'use server';
import { prisma } from '@/db/client';
import { auth } from '@/auth/config';
import { writeAudit } from '@/lib/audit';
import { sanitizeIncidentIds } from '@/lib/incidents';
import { notifyResolvedIncidents } from '@/notify/resolve';
import { revalidatePath } from 'next/cache';

async function requireWriter() {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (user?.role !== 'admin' && user?.role !== 'member') throw new Error('forbidden');
  return user;
}

export async function bulkResolveIncidents(ids: string[]): Promise<{ count: number }> {
  const user = await requireWriter();
  const clean = sanitizeIncidentIds(ids);
  if (clean.length === 0) return { count: 0 };

  // Capture exactly which ids are still open before resolving, so we can fire resolve
  // notifications for the rows we actually transition (and not re-notify already-resolved).
  const open = await prisma.incident.findMany({
    where: { id: { in: clean }, resolvedAt: null },
    select: { id: true },
  });

  // resolvedAt:null in the WHERE makes this idempotent and only-open (won't re-stamp).
  const res = await prisma.incident.updateMany({
    where: { id: { in: clean }, resolvedAt: null },
    data: { resolvedAt: new Date() },
  });
  await writeAudit({
    userId: user?.id,
    action: 'incident.bulk_resolve',
    target: `${res.count} incidente(s)`,
    payload: { count: res.count, ids: clean },
  });
  // Best-effort outbound notifications — must never break the bulk action.
  await notifyResolvedIncidents(open.map((i) => i.id));
  revalidatePath('/incidents');
  return { count: res.count };
}
