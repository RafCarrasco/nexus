import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/db/client';
import { assertApiRole } from '@/auth/guards';
import { writeAudit } from '@/lib/audit';
import { generateToken, hashToken } from '@/lib/ingest-token';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const createSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  expiresAt: z.string().datetime({ offset: true }).or(z.string().datetime()).nullable().optional(),
});

/** List ingest tokens for a connection. NEVER returns the hash or any plaintext. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await assertApiRole(req, ['admin']);
  if (gate.response) return gate.response;
  const { id } = await ctx.params;

  const connection = await prisma.connection.findUnique({ where: { id }, select: { id: true } });
  if (!connection) return new NextResponse('connection not found', { status: 404 });

  const tokens = await prisma.ingestToken.findMany({
    where: { connectionId: id },
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, lastUsedAt: true, createdAt: true, expiresAt: true },
  });
  return NextResponse.json(tokens);
}

/**
 * Generate a new ingest token. The plaintext is returned ONCE here and never again
 * (only its hash is persisted). Admin-only, audited.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await assertApiRole(req, ['admin']);
  if (gate.response) return gate.response;
  const user = gate.user;
  const { id } = await ctx.params;

  const connection = await prisma.connection.findUnique({ where: { id }, select: { id: true } });
  if (!connection) return new NextResponse('connection not found', { status: 404 });

  const json = await req.json().catch(() => ({}));
  const parse = createSchema.safeParse(json ?? {});
  if (!parse.success) return new NextResponse(parse.error.message, { status: 400 });

  const token = generateToken();
  const row = await prisma.ingestToken.create({
    data: {
      connectionId: id,
      tokenHash: hashToken(token),
      name: parse.data.name ?? 'default',
      expiresAt: parse.data.expiresAt ? new Date(parse.data.expiresAt) : null,
    },
    select: { id: true, name: true },
  });

  await writeAudit({
    userId: user?.id,
    action: 'ingest_token.create',
    target: id,
    payload: { tokenId: row.id, name: row.name },
  });

  // Plaintext token — shown to the caller exactly once.
  return NextResponse.json({ id: row.id, token }, { status: 201 });
}
