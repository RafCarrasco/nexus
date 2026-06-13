import { NextResponse } from 'next/server';
import { prisma } from '@/db/client';
import { assertApiRole } from '@/auth/guards';
import { writeAudit } from '@/lib/audit';

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await assertApiRole(req, ['admin']);
  if (gate.response) return gate.response;
  const { id } = await ctx.params;
  await prisma.tenant.delete({ where: { id } });
  await writeAudit({ userId: gate.user.id, action: 'tenant.delete', target: id });
  return new NextResponse(null, { status: 204 });
}
