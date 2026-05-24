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
    <div className="space-y-6">
      <PageHeader title="Recursos" />

      {/* Filter bar */}
      <form className="flex items-center gap-2 text-sm">
        <input
          name="q"
          defaultValue={sp.q ?? ''}
          placeholder="buscar…"
          className="rounded-md border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-100 focus:border-violet-500 bg-white"
        />
        <select
          name="type"
          defaultValue={sp.type ?? ''}
          className="rounded-md border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-100 focus:border-violet-500 bg-white"
        >
          <option value="">todos os tipos</option>
          <option value="firebase">firebase</option>
          <option value="supabase">supabase</option>
          <option value="docker">docker</option>
        </select>
        <button
          type="submit"
          className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
        >
          Filtrar
        </button>
      </form>

      {/* Table */}
      <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Provedor</TableHead>
              <TableHead>Região</TableHead>
              <TableHead>Última atividade</TableHead>
              <TableHead>Incidentes abertos</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <Link href={`/resources/${r.id}` as never} className="font-medium text-zinc-900 hover:text-violet-600 transition-colors">
                    {r.name}
                  </Link>
                </TableCell>
                <TableCell className="text-zinc-500">{r.kind}</TableCell>
                <TableCell><Badge variant="outline">{r.connection.type}</Badge></TableCell>
                <TableCell className="text-zinc-500">{r.region ?? '—'}</TableCell>
                <TableCell className="text-zinc-500">
                  {r.activityLog?.lastSeenAt?.toISOString().slice(0, 19).replace('T', ' ') ?? '—'}
                </TableCell>
                <TableCell>
                  {r._count.incidents > 0
                    ? <Badge variant="destructive">{r._count.incidents}</Badge>
                    : <span className="text-zinc-400">0</span>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
