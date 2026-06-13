import { Users } from 'lucide-react';
import { prisma } from '@/db/client';
import { PageHeader } from '@/ui/components/page-header';
import { Input } from '@/ui/components/input';
import { Button } from '@/ui/components/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/ui/components/table';
import { createClient } from './actions';
import { DeleteConfirmDialog } from '@/ui/components/delete-confirm-dialog';

export default async function ClientsPage() {
  const clients = await prisma.client.findMany({ orderBy: { name: 'asc' } });
  return (
    <div className="space-y-6">
      <PageHeader title="Clientes" />

      {/* Add client form */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Adicionar cliente</h2>
        <form action={createClient} className="flex items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Nome</label>
            <Input name="name" placeholder="Acme Inc." className="w-64" />
          </div>
          <Button type="submit">Adicionar cliente</Button>
        </form>
      </div>

      {/* Clients table */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-sm">
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
                <TableCell colSpan={3} className="py-12">
                  <div className="flex flex-col items-center gap-3 text-center">
                    <Users className="h-10 w-10 text-zinc-300" />
                    <div>
                      <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Cadastre seus clientes</p>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-md mt-1">
                        Clientes permitem alocar recursos e calcular custo por cliente.
                        Use o formulário acima para adicionar o primeiro.
                      </p>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            )}
            {clients.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium text-zinc-900 dark:text-zinc-100">{c.name}</TableCell>
                <TableCell className="text-zinc-500 dark:text-zinc-400">{c.createdAt.toISOString().slice(0, 10)}</TableCell>
                <TableCell>
                  <DeleteConfirmDialog
                    trigger={
                      <Button variant="outline" size="sm" className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 border-red-200 dark:border-red-900">
                        Excluir
                      </Button>
                    }
                    title="Excluir cliente"
                    confirmName={c.name}
                    inputLabel="Digite o nome do cliente para confirmar"
                    description={`Cliente: ${c.name}\n\nIsto vai apagar o cliente permanentemente. Recursos associados perderão a referência a este cliente.`}
                    endpoint={`/api/clients/${c.id}`}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
