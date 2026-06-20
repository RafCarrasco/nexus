import { NextResponse } from 'next/server';
import { prisma } from '@/db/client';
import { assertApiRole } from '@/auth/guards';
import { writeAudit } from '@/lib/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Revoke an ingest token. Verifies the token belongs to the connection. Admin-only, audited. */
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string; tokenId: string }> }) {
  const gate = await assertApiRole(req, ['admin']);
  if (gate.response) return gate.response;
  const user = gate.user;
  const { id, tokenId } = await ctx.params;

  const token = await prisma.ingestToken.findUnique({ where: { id: tokenId }, select: { id: true, connectionId: true } });
  if (!token || token.connectionId !== id) return new NextResponse('token not found', { status: 404 });

  await prisma.ingestToken.delete({ where: { id: tokenId } });
  await writeAudit({ userId: user?.id, action: 'ingest_token.delete', target: id, payload: { tokenId } });

  return new NextResponse(null, { status: 204 });
}
