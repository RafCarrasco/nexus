import { NextResponse } from 'next/server';
import { authOrE2E } from '@/auth/config';
import { prisma } from '@/db/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Open incidents for the header notification bell. Session required.
 * Returns up to ~15 newest-open incidents plus a total open count.
 */
export async function GET(req: Request) {
  const session = await authOrE2E(req);
  if (!session?.user) return new NextResponse('unauthorized', { status: 401 });

  const [rows, total] = await Promise.all([
    prisma.incident.findMany({
      where: { resolvedAt: null },
      orderBy: { openedAt: 'desc' },
      take: 15,
      include: {
        resource: { select: { name: true } },
        uptimeCheck: { select: { name: true } },
        aiProbe: { select: { name: true } },
      },
    }),
    prisma.incident.count({ where: { resolvedAt: null } }),
  ]);

  const incidents = rows.map((i) => ({
    id: i.id,
    type: i.type,
    severity: i.severity,
    message: i.message,
    openedAt: i.openedAt.toISOString(),
    name: i.resource?.name ?? i.uptimeCheck?.name ?? i.aiProbe?.name ?? '—',
  }));

  return NextResponse.json({ incidents, total });
}
