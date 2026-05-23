import Link from 'next/link';
import { prisma } from '@/db/client';
import { PageHeader } from '@/ui/components/page-header';
import { Button } from '@/ui/components/button';
import { RunNow } from './run-now';
import { Badge } from '@/ui/components/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/ui/components/table';

export default async function ConnectionsPage() {
  const rows = await prisma.connection.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, name: true, type: true, status: true,
      lastError: true, lastCollectedAt: true,
    },
  });
  return (
    <div className="space-y-6">
      <PageHeader
        title="Connections"
        action={
          <>
            <RunNow />
            <Button asChild><Link href="/connections/new">New connection</Link></Button>
          </>
        }
      />
      <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last collected</TableHead>
              <TableHead>Last error</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <Link href={`/connections/${c.id}` as never} className="font-medium text-zinc-900 hover:text-violet-600 transition-colors">
                    {c.name}
                  </Link>
                </TableCell>
                <TableCell><Badge variant="outline">{c.type}</Badge></TableCell>
                <TableCell>
                  <Badge variant={c.status === 'active' ? 'active' : 'destructive'}>{c.status}</Badge>
                </TableCell>
                <TableCell className="text-zinc-500">
                  {c.lastCollectedAt ? c.lastCollectedAt.toISOString().slice(0, 19).replace('T', ' ') : '—'}
                </TableCell>
                <TableCell className="max-w-[400px] truncate text-xs text-zinc-400">
                  {c.lastError ?? ''}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
