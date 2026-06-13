import { NextResponse } from 'next/server';
import { prisma } from '@/db/client';
import { authOrE2E } from '@/auth/config';
import { writeAudit } from '@/lib/audit';
import { notifyResolvedIncidents } from '@/notify/resolve';

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await authOrE2E(req);
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (user?.role !== 'admin' && user?.role !== 'member') {
    return new NextResponse('forbidden', { status: 403 });
  }
  const body = (await req.json()) as { resolved?: boolean };
  const { id } = await ctx.params;

  // Was it open before? Only fire resolve notifications on a real open→resolved transition.
  const wasOpen = body.resolved
    ? (await prisma.incident.findUnique({ where: { id }, select: { resolvedAt: true } }))?.resolvedAt == null
    : false;

  await prisma.incident.update({
    where: { id },
    data: { resolvedAt: body.resolved ? new Date() : null },
  });
  await writeAudit({
    userId: user?.id,
    action: body.resolved ? 'incident.resolve' : 'incident.reopen',
    target: id,
  });
  // Best-effort outbound notifications — must never break the request.
  if (body.resolved && wasOpen) await notifyResolvedIncidents([id]);
  return new NextResponse(null, { status: 204 });
}
