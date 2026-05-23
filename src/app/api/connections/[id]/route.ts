import { NextResponse } from 'next/server';
import { prisma } from '@/db/client';
import { auth } from '@/auth/config';

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if ((session?.user as { role?: string })?.role !== 'admin') return new NextResponse('forbidden', { status: 403 });
  const { id } = await ctx.params;
  await prisma.connection.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
