import { NextResponse } from 'next/server';
import { prisma } from '@/db/client';
import { authOrE2E } from '@/auth/config';
import { writeAudit } from '@/lib/audit';

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await authOrE2E(req);
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (user?.role !== 'admin') {
    return new NextResponse('forbidden', { status: 403 });
  }
  const { id } = await ctx.params;
  await prisma.client.delete({ where: { id } });
  await writeAudit({ userId: user?.id, action: 'client.delete', target: id });
  return new NextResponse(null, { status: 204 });
}
