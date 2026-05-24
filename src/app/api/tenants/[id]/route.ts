import { NextResponse } from 'next/server';
import { prisma } from '@/db/client';
import { authOrE2E } from '@/auth/config';

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await authOrE2E(req);
  if (!session?.user) return new NextResponse('unauthorized', { status: 401 });
  const { id } = await ctx.params;
  await prisma.tenant.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
