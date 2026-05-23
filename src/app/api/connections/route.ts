import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/db/client';
import { encrypt } from '@/crypto/vault';
import { authOrE2E } from '@/auth/config';
import { getProvider, listProviderTypes } from '@/providers/registry';

const createSchema = z.object({
  name: z.string().min(1).max(120),
  type: z.string().min(1),
  config: z.record(z.string(), z.unknown()).default({}),
});

export async function GET(req: Request) {
  const session = await authOrE2E(req);
  if (!session?.user) return new NextResponse('unauthorized', { status: 401 });
  const rows = await prisma.connection.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, name: true, type: true, status: true, lastError: true,
      lastCollectedAt: true, ownerUserId: true, createdAt: true, updatedAt: true,
    },
  });
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const session = await authOrE2E(req);
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id) return new NextResponse('unauthorized', { status: 401 });
  if (user.role !== 'admin') return new NextResponse('forbidden', { status: 403 });

  const json = await req.json();
  const parse = createSchema.safeParse(json);
  if (!parse.success) return new NextResponse(parse.error.message, { status: 400 });

  const { name, type, config } = parse.data;
  if (!listProviderTypes().includes(type)) {
    return new NextResponse(`unknown provider type: ${type}`, { status: 400 });
  }

  // Validate credentials before persisting.
  const provider = getProvider(type);
  try {
    if (provider.validate) {
      await provider.validate({ id: 'pre-' + Date.now(), type, config });
    } else {
      await provider.listResources({ id: 'pre-' + Date.now(), type, config });
    }
  } catch (e) {
    return new NextResponse(`credential validation failed: ${(e as Error).message}`, { status: 400 });
  }

  const row = await prisma.connection.create({
    data: { name, type, credentials: encrypt(config) as unknown as Uint8Array<ArrayBuffer>, ownerUserId: user.id },
    select: { id: true },
  });
  return NextResponse.json(row, { status: 201 });
}
