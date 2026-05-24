import { NextResponse } from 'next/server';
import { prisma } from '@/db/client';
import { authOrE2E } from '@/auth/config';

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await authOrE2E(req);
  const role = (session?.user as { role?: string })?.role;
  if (role !== 'admin' && role !== 'member') {
    return new NextResponse('forbidden', { status: 403 });
  }
  const { id } = await ctx.params;
  await prisma.resource.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
