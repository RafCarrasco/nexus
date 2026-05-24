import { prisma } from '@/db/client';
import { PageHeader } from '@/ui/components/page-header';
import { Input } from '@/ui/components/input';
import { Button } from '@/ui/components/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/ui/components/table';
import { createClient, deleteClient } from './actions';

export default async function ClientsPage() {
  const clients = await prisma.client.findMany({ orderBy: { name: 'asc' } });
  return (
    <div className="space-y-6">
      <PageHeader title="Clientes" />

      {/* Add client form */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900 mb-4">Adicionar cliente</h2>
        <form action={createClient} className="flex items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-600">Nome</label>
            <Input name="name" placeholder="Acme Inc." className="w-64" />
          </div>
          <Button type="submit">Adicionar cliente</Button>
        </form>
      </div>

      {/* Clients table */}
      <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Criado em</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-zinc-400 py-8">
                  Nenhum cliente ainda.
                </TableCell>
              </TableRow>
            )}
            {clients.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium text-zinc-900">{c.name}</TableCell>
                <TableCell className="text-zinc-500">{c.createdAt.toISOString().slice(0, 10)}</TableCell>
                <TableCell>
                  <form action={deleteClient}>
                    <input type="hidden" name="id" value={c.id} />
                    <Button type="submit" variant="outline" size="sm">Excluir</Button>
                  </form>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
