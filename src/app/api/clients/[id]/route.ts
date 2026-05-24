import { NextResponse } from 'next/server';
import { prisma } from '@/db/client';
import { authOrE2E } from '@/auth/config';

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await authOrE2E(req);
  if ((session?.user as { role?: string })?.role !== 'admin') {
    return new NextResponse('forbidden', { status: 403 });
  }
  const { id } = await ctx.params;
  await prisma.client.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
