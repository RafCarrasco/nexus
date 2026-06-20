import { NextResponse } from 'next/server';
import type { Connection } from '@prisma/client';
import { prisma } from '@/db/client';
import { hashToken } from '@/lib/ingest-token';
import { log } from '@/lib/logger';

/**
 * Bearer-token guard for the public ingest endpoint. Mirrors the discriminated
 * `{connection}|{response}` shape of assertApiRole so the route can early-return.
 *
 * Auth is by lookup on the unique tokenHash index (no plaintext compare, no
 * per-row salt): the raw token is hashed once and matched O(1). The token must
 * belong to the connectionId in the body (no cross-connection reuse) and not be
 * expired. The connection itself must exist and be active. The raw token is
 * never logged or echoed in any response.
 */

type IngestGate = { connection: Connection; response?: undefined } | { connection?: undefined; response: NextResponse };

const BEARER_RE = /^Bearer\s+(\S+)$/i;

export async function assertIngestToken(
  req: Request,
  parsedBody: { connectionId?: string },
): Promise<IngestGate> {
  const auth = req.headers.get('authorization') ?? '';
  const m = BEARER_RE.exec(auth);
  if (!m) return { response: new NextResponse('unauthorized', { status: 401 }) };
  const raw = m[1];

  const connectionId = parsedBody.connectionId;
  if (!connectionId) return { response: new NextResponse('connectionId is required', { status: 400 }) };

  const token = await prisma.ingestToken.findUnique({ where: { tokenHash: hashToken(raw) } });
  if (
    !token ||
    token.connectionId !== connectionId ||
    (token.expiresAt && token.expiresAt.getTime() < Date.now())
  ) {
    return { response: new NextResponse('unauthorized', { status: 401 }) };
  }

  const connection = await prisma.connection.findUnique({ where: { id: connectionId } });
  if (!connection) return { response: new NextResponse('connection not found', { status: 404 }) };
  if (connection.status !== 'active') {
    return { response: new NextResponse('connection is not active', { status: 409 }) };
  }

  // Best-effort touch — never block ingest on this write.
  prisma.ingestToken
    .update({ where: { id: token.id }, data: { lastUsedAt: new Date() } })
    .catch((e) => log.warn('ingest token lastUsedAt update failed', { err: (e as Error).message }));

  return { connection };
}
