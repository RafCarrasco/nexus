import Link from 'next/link';
import { prisma } from '@/db/client';
import { PageHeader } from '@/ui/components/page-header';
import { Badge } from '@/ui/components/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/ui/components/table';

type Search = { client?: string; type?: string; q?: string };

export default async function ResourcesPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const rows = await prisma.resource.findMany({
    where: {
      ...(sp.client ? { clientId: sp.client } : {}),
      ...(sp.q ? { OR: [{ name: { contains: sp.q, mode: 'insensitive' } }, { externalId: { contains: sp.q, mode: 'insensitive' } }] } : {}),
      ...(sp.type ? { connection: { type: sp.type } } : {}),
    },
    include: { connection: true, activityLog: true, _count: { select: { incidents: { where: { resolvedAt: null } } } } },
    orderBy: { updatedAt: 'desc' },
    take: 200,
  });
  return (
    <>
      <PageHeader title="Resources" />
      <form className="px-6 pt-4 flex gap-2 text-sm">
        <input name="q" defaultValue={sp.q ?? ''} placeholder="search…" className="rounded border px-2 py-1" />
        <select name="type" defaultValue={sp.type ?? ''} className="rounded border px-2 py-1">
          <option value="">all types</option>
          <option value="firebase">firebase</option>
          <option value="supabase">supabase</option>
          <option value="docker">docker</option>
        </select>
        <button type="submit" className="rounded border bg-white px-3 py-1">Filter</button>
      </form>
      <div className="p-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Kind</TableHead>
              <TableHead>Provider</TableHead>
              <TableHead>Region</TableHead>
              <TableHead>Last activity</TableHead>
              <TableHead>Open incidents</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell><Link href={`/resources/${r.id}` as never} className="underline">{r.name}</Link></TableCell>
                <TableCell>{r.kind}</TableCell>
                <TableCell><Badge variant="outline">{r.connection.type}</Badge></TableCell>
                <TableCell>{r.region ?? '—'}</TableCell>
                <TableCell>{r.activityLog?.lastSeenAt?.toISOString().slice(0, 19).replace('T', ' ') ?? '—'}</TableCell>
                <TableCell>{r._count.incidents > 0 ? <Badge variant="destructive">{r._count.incidents}</Badge> : '0'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
