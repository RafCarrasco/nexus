import { NextResponse } from 'next/server';
import { authOrE2E } from '@/auth/config';
import { prisma } from '@/db/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const session = await authOrE2E(req);
  if (!session?.user) return new NextResponse('unauthorized', { status: 401 });

  const url = new URL(req.url);
  const q = (url.searchParams.get('q') ?? '').trim();
  if (!q) return NextResponse.json({ results: [] });

  const like = { contains: q, mode: 'insensitive' as const };

  const [workspaces, connections, resources, clients, incidents] = await Promise.all([
    prisma.workspace.findMany({
      where: { name: like },
      take: 5,
      select: { id: true, slug: true, name: true },
    }),
    prisma.connection.findMany({
      where: { name: like },
      take: 5,
      select: {
        id: true,
        name: true,
        type: true,
        workspace: { select: { slug: true } },
      },
    }),
    prisma.resource.findMany({
      where: { name: like },
      take: 5,
      select: { id: true, name: true, kind: true },
    }),
    prisma.client.findMany({
      where: { name: like },
      take: 5,
      select: { id: true, name: true },
    }),
    prisma.incident.findMany({
      where: { message: like, resolvedAt: null },
      take: 5,
      select: {
        id: true,
        message: true,
        severity: true,
        resource: { select: { id: true, name: true } },
      },
    }),
  ]);

  return NextResponse.json({
    results: [
      ...workspaces.map((w) => ({
        type: 'workspace' as const,
        id: w.id,
        label: w.name,
        href: `/workspaces/${w.slug}`,
      })),
      ...connections.map((c) => ({
        type: 'connection' as const,
        id: c.id,
        label: c.name,
        sub: c.type,
        href: c.workspace ? `/workspaces/${c.workspace.slug}` : '/connections',
      })),
      ...resources.map((r) => ({
        type: 'resource' as const,
        id: r.id,
        label: r.name,
        sub: r.kind,
        href: `/resources/${r.id}`,
      })),
      ...clients.map((c) => ({
        type: 'client' as const,
        id: c.id,
        label: c.name,
        href: '/settings/clients',
      })),
      ...incidents.map((i) => ({
        type: 'incident' as const,
        id: i.id,
        label: i.message.slice(0, 80),
        sub: i.severity,
        href: `/resources/${i.resource.id}`,
      })),
    ],
  });
}
