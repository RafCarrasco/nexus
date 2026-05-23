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
    <>
      <PageHeader
        title="Connections"
        action={
          <div className="flex gap-2">
            <RunNow />
            <Button asChild><Link href="/connections/new">New connection</Link></Button>
          </div>
        }
      />
      <div className="p-6">
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
                <TableCell><Link href={`/connections/${c.id}` as never} className="underline">{c.name}</Link></TableCell>
                <TableCell><Badge variant="outline">{c.type}</Badge></TableCell>
                <TableCell>
                  <Badge variant={c.status === 'active' ? 'default' : 'destructive'}>{c.status}</Badge>
                </TableCell>
                <TableCell>{c.lastCollectedAt ? c.lastCollectedAt.toISOString().slice(0, 19).replace('T', ' ') : '—'}</TableCell>
                <TableCell className="max-w-[400px] truncate text-xs text-zinc-500">{c.lastError ?? ''}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
