'use server';
import { prisma } from '@/db/client';
import { auth } from '@/auth/config';
import { writeAudit } from '@/lib/audit';
import { sanitizeIncidentIds } from '@/lib/incidents';
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
  revalidatePath('/incidents');
  return { count: res.count };
}
