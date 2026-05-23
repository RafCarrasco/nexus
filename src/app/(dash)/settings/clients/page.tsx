import { prisma } from '@/db/client';
import { PageHeader } from '@/ui/components/page-header';
import { Input } from '@/ui/components/input';
import { Button } from '@/ui/components/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/ui/components/table';
import { createClient, deleteClient } from './actions';

export default async function ClientsPage() {
  const clients = await prisma.client.findMany({ orderBy: { name: 'asc' } });
  return (
    <>
      <PageHeader title="Clients" />
      <form action={createClient} className="p-6 flex items-end gap-2">
        <div className="space-y-1">
          <label className="text-sm">Name</label>
          <Input name="name" placeholder="Acme Inc." />
        </div>
        <Button type="submit">Add</Button>
      </form>
      <div className="p-6 pt-0">
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Created</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {clients.map((c) => (
              <TableRow key={c.id}>
                <TableCell>{c.name}</TableCell>
                <TableCell>{c.createdAt.toISOString().slice(0, 10)}</TableCell>
                <TableCell>
                  <form action={deleteClient}>
                    <input type="hidden" name="id" value={c.id} />
                    <Button type="submit" variant="outline" size="sm">Delete</Button>
                  </form>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
