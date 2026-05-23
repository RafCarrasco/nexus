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
    <div className="space-y-8">
      <PageHeader
        title="Incidents"
        subtitle={open.length > 0 ? `${open.length} open incident${open.length !== 1 ? 's' : ''}` : undefined}
      />

      {/* Open incidents */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-zinc-900">
          Open <span className="text-zinc-400 font-normal">({open.length})</span>
        </h2>
        <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Opened</TableHead>
                <TableHead>Resource</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Message</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {open.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-zinc-400 py-8">
                    No open incidents
                  </TableCell>
                </TableRow>
              )}
              {open.map((i) => (
                <TableRow key={i.id}>
                  <TableCell className="text-zinc-500 text-xs">
                    {i.openedAt.toISOString().slice(0, 19).replace('T', ' ')}
                  </TableCell>
                  <TableCell>
                    <Link href={`/resources/${i.resourceId}` as never} className="font-medium text-zinc-900 hover:text-violet-600 transition-colors">
                      {i.resource.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-zinc-500">{i.type}</TableCell>
                  <TableCell>
                    <Badge variant={i.severity === 'crit' ? 'destructive' : 'default'}>{i.severity}</Badge>
                  </TableCell>
                  <TableCell className="max-w-[420px] truncate text-zinc-600">{i.message}</TableCell>
                  <TableCell><ResolveButton id={i.id} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* Recently resolved */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-zinc-900">Recently resolved</h2>
        <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Resolved</TableHead>
                <TableHead>Resource</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Message</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recent.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-zinc-400 py-8">
                    No resolved incidents yet
                  </TableCell>
                </TableRow>
              )}
              {recent.map((i) => (
                <TableRow key={i.id}>
                  <TableCell className="text-zinc-500 text-xs">
                    {i.resolvedAt!.toISOString().slice(0, 19).replace('T', ' ')}
                  </TableCell>
                  <TableCell className="font-medium text-zinc-900">{i.resource.name}</TableCell>
                  <TableCell className="text-zinc-500">{i.type}</TableCell>
                  <TableCell className="max-w-[420px] truncate text-zinc-600">{i.message}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
