import Link from 'next/link';
import { prisma } from '@/db/client';
import { PageHeader } from '@/ui/components/page-header';
import { Badge } from '@/ui/components/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/ui/components/table';
import { ResolveButton } from './resolve-button';

export default async function IncidentsPage() {
  const open = await prisma.incident.findMany({
    where: { resolvedAt: null },
    orderBy: { openedAt: 'desc' },
    include: { resource: { include: { connection: true } } },
  });
  const recent = await prisma.incident.findMany({
    where: { resolvedAt: { not: null } },
    orderBy: { resolvedAt: 'desc' },
    take: 50,
    include: { resource: true },
  });
  return (
    <>
      <PageHeader title="Incidents" />
      <section className="p-6">
        <h2 className="mb-2 text-lg font-semibold">Open ({open.length})</h2>
        <Table>
          <TableHeader><TableRow><TableHead>Opened</TableHead><TableHead>Resource</TableHead><TableHead>Type</TableHead><TableHead>Severity</TableHead><TableHead>Message</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {open.map((i) => (
              <TableRow key={i.id}>
                <TableCell>{i.openedAt.toISOString().slice(0, 19).replace('T', ' ')}</TableCell>
                <TableCell><Link href={`/resources/${i.resourceId}` as never} className="underline">{i.resource.name}</Link></TableCell>
                <TableCell>{i.type}</TableCell>
                <TableCell><Badge variant={i.severity === 'crit' ? 'destructive' : 'default'}>{i.severity}</Badge></TableCell>
                <TableCell className="max-w-[420px] truncate">{i.message}</TableCell>
                <TableCell><ResolveButton id={i.id} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
      <section className="p-6">
        <h2 className="mb-2 text-lg font-semibold">Recently resolved</h2>
        <Table>
          <TableHeader><TableRow><TableHead>Resolved</TableHead><TableHead>Resource</TableHead><TableHead>Type</TableHead><TableHead>Message</TableHead></TableRow></TableHeader>
          <TableBody>
            {recent.map((i) => (
              <TableRow key={i.id}>
                <TableCell>{i.resolvedAt!.toISOString().slice(0, 19).replace('T', ' ')}</TableCell>
                <TableCell>{i.resource.name}</TableCell>
                <TableCell>{i.type}</TableCell>
                <TableCell className="max-w-[420px] truncate">{i.message}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
    </>
  );
}
