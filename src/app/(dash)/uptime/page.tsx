import { prisma } from '@/db/client';
import { PageHeader } from '@/ui/components/page-header';
import { Input } from '@/ui/components/input';
import { Button } from '@/ui/components/button';
import { Badge } from '@/ui/components/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/ui/components/table';
import { createUptimeCheck, deleteUptimeCheck } from './actions';

export const dynamic = 'force-dynamic';

function statusBadge(s: string | null) {
  if (s === 'up') return <Badge variant="active">no ar</Badge>;
  if (s === 'down') return <Badge variant="destructive">fora</Badge>;
  return <Badge variant="default">—</Badge>;
}

export default async function UptimePage() {
  const checks = await prisma.uptimeCheck.findMany({ orderBy: { createdAt: 'desc' } });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Uptime"
        subtitle="Ping HTTP periódico por recurso — abre incidente automático após N falhas consecutivas"
      />

      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Adicionar check</h2>
        <form action={createUptimeCheck} className="grid grid-cols-1 items-end gap-3 sm:grid-cols-7">
          <div className="space-y-1 sm:col-span-2">
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Nome</label>
            <Input name="name" placeholder="API de produção" required />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">URL</label>
            <Input name="url" placeholder="https://exemplo.com/health" required />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Método</label>
            <select
              name="method"
              className="h-9 w-full rounded-md border border-zinc-300 bg-transparent px-2 text-sm dark:border-zinc-700"
              defaultValue="GET"
            >
              <option value="GET">GET</option>
              <option value="HEAD">HEAD</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400" title="Intervalo em segundos">
              Intervalo (s)
            </label>
            <Input name="intervalSec" type="number" min={30} defaultValue={300} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400" title="Falhas consecutivas até abrir incidente">
              Falhas
            </label>
            <Input name="failThreshold" type="number" min={1} defaultValue={3} />
          </div>
          <Button type="submit" className="sm:col-span-7 sm:w-fit">
            Adicionar check
          </Button>
        </form>
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        {checks.length === 0 ? (
          <p className="p-6 text-sm text-zinc-500">Nenhum check ainda. Adicione uma URL acima.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>URL</TableHead>
                <TableHead>Intervalo</TableHead>
                <TableHead>Falhas</TableHead>
                <TableHead>Último check</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {checks.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>{statusBadge(c.lastStatus)}</TableCell>
                  <TableCell className="text-sm font-medium">{c.name}</TableCell>
                  <TableCell className="max-w-[260px] truncate font-mono text-xs text-zinc-500" title={c.url}>
                    {c.method} {c.url}
                  </TableCell>
                  <TableCell className="text-xs text-zinc-500">{c.intervalSec}s</TableCell>
                  <TableCell className="text-xs text-zinc-500">
                    {c.consecutiveFails > 0 ? `${c.consecutiveFails}/${c.failThreshold}` : '—'}
                    {c.lastError ? <span className="block text-rose-600">{c.lastError}</span> : null}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-zinc-500">
                    {c.lastCheckedAt ? c.lastCheckedAt.toISOString().slice(0, 16).replace('T', ' ') : 'nunca'}
                  </TableCell>
                  <TableCell className="text-right">
                    <form action={deleteUptimeCheck}>
                      <input type="hidden" name="id" value={c.id} />
                      <Button type="submit" variant="ghost" className="text-rose-600">
                        Remover
                      </Button>
                    </form>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
