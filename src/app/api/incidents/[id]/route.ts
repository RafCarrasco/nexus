import { NextResponse } from 'next/server';
import { prisma } from '@/db/client';
import { authOrE2E } from '@/auth/config';

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await authOrE2E(req);
  if (!session?.user) return new NextResponse('unauthorized', { status: 401 });
  const body = (await req.json()) as { resolved?: boolean };
  const { id } = await ctx.params;
  await prisma.incident.update({
    where: { id },
    data: { resolvedAt: body.resolved ? new Date() : null },
  });
  return new NextResponse(null, { status: 204 });
}
