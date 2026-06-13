import { prisma } from '@/db/client';
import { PageHeader } from '@/ui/components/page-header';
import { Input } from '@/ui/components/input';
import { Button } from '@/ui/components/button';
import { Badge } from '@/ui/components/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/ui/components/table';
import { createAlertRule, deleteAlertRule } from './actions';

export const dynamic = 'force-dynamic';

const METRIC_LABEL: Record<string, string> = {
  cost_30d: 'Custo 30d',
  open_incidents: 'Incidentes abertos',
};

const selectCls =
  'h-9 w-full rounded-md border border-zinc-300 bg-transparent px-2 text-sm dark:border-zinc-700';

export default async function AlertsPage() {
  const [rules, workspaces] = await Promise.all([
    prisma.alertRule.findMany({ orderBy: { createdAt: 'desc' }, include: { workspace: true } }),
    prisma.workspace.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Alertas"
        subtitle="Regras configuráveis — quando uma métrica cruza o limite, abre um incidente automático"
      />

      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Nova regra</h2>
        <form action={createAlertRule} className="grid grid-cols-1 items-end gap-3 sm:grid-cols-6">
          <div className="space-y-1 sm:col-span-2">
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Nome</label>
            <Input name="name" placeholder="Custo acima do orçamento" required />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Métrica</label>
            <select name="metric" className={selectCls} defaultValue="cost_30d">
              <option value="cost_30d">Custo 30d</option>
              <option value="open_incidents">Incidentes abertos</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Condição</label>
            <select name="operator" className={selectCls} defaultValue="gt">
              <option value="gt">maior que &gt;</option>
              <option value="lt">menor que &lt;</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Limite</label>
            <Input name="threshold" type="number" step="any" defaultValue={100} required />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Escopo</label>
            <select name="workspaceId" className={selectCls} defaultValue="">
              <option value="">Global</option>
              {workspaces.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" className="sm:col-span-6 sm:w-fit">
            Criar regra
          </Button>
        </form>
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        {rules.length === 0 ? (
          <p className="p-6 text-sm text-zinc-500 dark:text-zinc-400">Nenhuma regra ainda. Crie uma acima.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Estado</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Regra</TableHead>
                <TableHead>Escopo</TableHead>
                <TableHead>Valor atual</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    {r.isFiring ? <Badge variant="destructive">disparando</Badge> : <Badge variant="active">ok</Badge>}
                  </TableCell>
                  <TableCell className="text-sm font-medium">{r.name}</TableCell>
                  <TableCell className="text-xs text-zinc-500 dark:text-zinc-400">
                    {METRIC_LABEL[r.metric] ?? r.metric} {r.operator === 'lt' ? '<' : '>'} {r.threshold}
                  </TableCell>
                  <TableCell className="text-xs text-zinc-500 dark:text-zinc-400">{r.workspace?.name ?? 'Global'}</TableCell>
                  <TableCell className="text-xs text-zinc-500 dark:text-zinc-400">
                    {r.lastValue != null ? r.lastValue : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <form action={deleteAlertRule}>
                      <input type="hidden" name="id" value={r.id} />
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
