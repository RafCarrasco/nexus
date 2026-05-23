import { prisma } from '@/db/client';
import { PageHeader } from '@/ui/components/page-header';
import { Input } from '@/ui/components/input';
import { Button } from '@/ui/components/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/ui/components/table';
import { setResourceClient, setTenantClient } from './actions';

export default async function AllocationsPage() {
  const [clients, resources, tenants] = await Promise.all([
    prisma.client.findMany({ orderBy: { name: 'asc' } }),
    prisma.resource.findMany({ orderBy: { name: 'asc' }, include: { connection: true } }),
    prisma.tenant.findMany({ orderBy: { displayName: 'asc' }, include: { resource: true } }),
  ]);

  const clientOptions = (selected?: string | null) => (
    <>
      <option value="">— unassigned —</option>
      {clients.map((c) => (
        <option key={c.id} value={c.id} selected={c.id === selected}>{c.name}</option>
      ))}
    </>
  );

  return (
    <>
      <PageHeader title="Client allocations" />
      <section className="p-6">
        <h2 className="mb-2 text-lg font-semibold">Resources</h2>
        <Table>
          <TableHeader><TableRow><TableHead>Resource</TableHead><TableHead>Provider</TableHead><TableHead>Client</TableHead><TableHead>% share</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {resources.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.name}</TableCell>
                <TableCell>{r.connection.type}</TableCell>
                <TableCell>
                  <form action={setResourceClient} className="flex items-center gap-2">
                    <input type="hidden" name="resourceId" value={r.id} />
                    <select name="clientId" className="rounded border px-2 py-1">{clientOptions(r.clientId)}</select>
                    <Input name="allocationPct" defaultValue={r.allocationPct ?? ''} placeholder="100" className="w-20" />
                    <Button type="submit" size="sm">Save</Button>
                  </form>
                </TableCell>
                <TableCell colSpan={2} />
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
      <section className="p-6">
        <h2 className="mb-2 text-lg font-semibold">Tenants</h2>
        <Table>
          <TableHeader><TableRow><TableHead>Tenant</TableHead><TableHead>Resource</TableHead><TableHead>Client</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {tenants.map((t) => (
              <TableRow key={t.id}>
                <TableCell>{t.displayName}</TableCell>
                <TableCell>{t.resource.name}</TableCell>
                <TableCell>
                  <form action={setTenantClient} className="flex items-center gap-2">
                    <input type="hidden" name="tenantId" value={t.id} />
                    <select name="clientId" className="rounded border px-2 py-1">{clientOptions(t.clientId)}</select>
                    <Button type="submit" size="sm">Save</Button>
                  </form>
                </TableCell>
                <TableCell />
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
    </>
  );
}
