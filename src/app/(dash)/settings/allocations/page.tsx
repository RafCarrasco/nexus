import Link from 'next/link';
import { Boxes, Users } from 'lucide-react';
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
      <option value="">— não atribuído —</option>
      {clients.map((c) => (
        <option key={c.id} value={c.id} selected={c.id === selected}>{c.name}</option>
      ))}
    </>
  );

  return (
    <div className="space-y-8">
      <PageHeader title="Alocações por cliente" />

      {/* Prompt: no clients */}
      {clients.length === 0 && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-10 text-center space-y-3 shadow-sm">
          <Users className="h-10 w-10 text-zinc-300 mx-auto" />
          <h3 className="text-base font-semibold text-zinc-900">Nenhum cliente cadastrado</h3>
          <p className="text-sm text-zinc-500 max-w-md mx-auto">
            Para alocar recursos, primeiro cadastre ao menos um cliente.
          </p>
          <Button asChild className="bg-violet-600 hover:bg-violet-700 text-white rounded-xl">
            <Link href="/settings/clients">Ir para Clientes</Link>
          </Button>
        </div>
      )}

      {/* Prompt: no resources */}
      {resources.length === 0 && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-10 text-center space-y-3 shadow-sm">
          <Boxes className="h-10 w-10 text-zinc-300 mx-auto" />
          <h3 className="text-base font-semibold text-zinc-900">Nenhum recurso disponível</h3>
          <p className="text-sm text-zinc-500 max-w-md mx-auto">
            Adicione conexões nos seus aplicativos para descobrir recursos.
          </p>
          <Button asChild className="bg-violet-600 hover:bg-violet-700 text-white rounded-xl">
            <Link href="/workspaces">Ir para Aplicativos</Link>
          </Button>
        </div>
      )}

      {/* Resources section */}
      {resources.length > 0 && clients.length > 0 && (
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-zinc-900">Recursos</h2>
        <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Recurso</TableHead>
                <TableHead>Provedor</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>% participação</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {resources.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium text-zinc-900">{r.name}</TableCell>
                  <TableCell className="text-zinc-500">{r.connection.type}</TableCell>
                  <TableCell>
                    <form action={setResourceClient} className="flex items-center gap-2">
                      <input type="hidden" name="resourceId" value={r.id} />
                      <select
                        name="clientId"
                        className="rounded-md border border-zinc-200 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-violet-100 focus:border-violet-500 bg-white"
                      >
                        {clientOptions(r.clientId)}
                      </select>
                      <Input name="allocationPct" defaultValue={r.allocationPct ?? ''} placeholder="100" className="w-20" />
                      <Button type="submit" size="sm">Salvar</Button>
                    </form>
                  </TableCell>
                  <TableCell colSpan={2} />
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
      )}

      {/* Tenants section */}
      {tenants.length > 0 && clients.length > 0 && (
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-zinc-900">Tenants</h2>
        <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tenant</TableHead>
                <TableHead>Recurso</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tenants.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium text-zinc-900">{t.displayName}</TableCell>
                  <TableCell className="text-zinc-500">{t.resource.name}</TableCell>
                  <TableCell>
                    <form action={setTenantClient} className="flex items-center gap-2">
                      <input type="hidden" name="tenantId" value={t.id} />
                      <select
                        name="clientId"
                        className="rounded-md border border-zinc-200 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-violet-100 focus:border-violet-500 bg-white"
                      >
                        {clientOptions(t.clientId)}
                      </select>
                      <Button type="submit" size="sm">Salvar</Button>
                    </form>
                  </TableCell>
                  <TableCell />
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
      )}
    </div>
  );
}
