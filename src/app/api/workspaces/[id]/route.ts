import { NextResponse } from 'next/server';
import { prisma } from '@/db/client';
import { authOrE2E } from '@/auth/config';
import { writeAudit } from '@/lib/audit';

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await authOrE2E(req);
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (user?.role !== 'admin' && user?.role !== 'member') {
    return new NextResponse('forbidden', { status: 403 });
  }
  const { id } = await ctx.params;
  await prisma.workspace.delete({ where: { id } });
  await writeAudit({ userId: user?.id, action: 'workspace.delete', target: id });
  return new NextResponse(null, { status: 204 });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await authOrE2E(req);
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (user?.role !== 'admin' && user?.role !== 'member') {
    return new NextResponse('forbidden', { status: 403 });
  }
  const { id } = await ctx.params;
  const body = (await req.json()) as { name?: string; description?: string | null };
  const name = body.name?.trim();
  if (!name) return new NextResponse('name required', { status: 400 });
  const row = await prisma.workspace.update({
    where: { id },
    data: { name, description: body.description?.toString().trim() || null },
  });
  await writeAudit({ userId: user?.id, action: 'workspace.update', target: id, payload: { name } });
  return NextResponse.json({ id: row.id, name: row.name });
}
