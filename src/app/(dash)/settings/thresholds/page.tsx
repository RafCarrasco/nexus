import { prisma } from '@/db/client';
import { PageHeader } from '@/ui/components/page-header';
import { Input } from '@/ui/components/input';
import { Button } from '@/ui/components/button';
import { Badge } from '@/ui/components/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/ui/components/table';
import { OP_LABEL, type MetricOperator } from '@/lib/metric-threshold';
import { createThreshold, deleteThreshold, toggleThreshold } from './actions';

export const dynamic = 'force-dynamic';

const selectCls = 'h-9 w-full rounded-md border border-zinc-300 bg-transparent px-2 text-sm dark:border-zinc-700';

export default async function ThresholdsPage() {
  const [resources, rules] = await Promise.all([
    prisma.resource.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, connection: { select: { name: true } } },
    }),
    prisma.metricThreshold.findMany({
      orderBy: { createdAt: 'desc' },
      include: { resource: { select: { name: true } } },
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Limites de métrica"
        subtitle="Dispare incidentes ANTES da falha: defina limites em métricas enviadas pelos apps (via API de ingest) — cpu, memória, fila, taxa de erro"
      />

      <div className="rounded-xl border border-violet-200 bg-violet-50 p-4 text-sm text-violet-900 dark:border-violet-900/40 dark:bg-violet-950/30 dark:text-violet-200">
        <p>
          <span className="font-semibold">Como funciona:</span> o app empurra um valor numérico (ex.{' '}
          <code className="font-mono text-xs">cpu_pct</code>, <code className="font-mono text-xs">queue_depth</code>,{' '}
          <code className="font-mono text-xs">error_rate</code>) pela API de ingest. A cada 5 min o Nexus compara o
          último valor recebido (dentro da janela) com o limite. Se cruzar, abre um incidente e notifica — e resolve
          sozinho quando volta ao normal. É o que transforma número solto em aviso antecipado.
        </p>
      </div>

      {resources.length === 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
          Nenhum recurso descoberto ainda. Cadastre uma conexão e deixe a coleta rodar para que apareçam recursos aqui.
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Adicionar limite</h2>
          <form action={createThreshold} className="grid grid-cols-1 items-end gap-3 sm:grid-cols-12">
            <div className="space-y-1 sm:col-span-4">
              <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Recurso</label>
              <select name="resourceId" className={selectCls} required defaultValue="">
                <option value="" disabled>
                  Selecione…
                </option>
                {resources.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} {r.connection ? `· ${r.connection.name}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1 sm:col-span-3">
              <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Métrica</label>
              <Input name="metricName" placeholder="cpu_pct" required />
            </div>
            <div className="space-y-1 sm:col-span-1">
              <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Op.</label>
              <select name="operator" className={selectCls} defaultValue="gt">
                {(Object.keys(OP_LABEL) as MetricOperator[]).map((op) => (
                  <option key={op} value={op}>
                    {OP_LABEL[op]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1 sm:col-span-1">
              <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Limite</label>
              <Input name="threshold" type="number" step="any" placeholder="85" required />
            </div>
            <div className="space-y-1 sm:col-span-1">
              <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Sev.</label>
              <select name="severity" className={selectCls} defaultValue="warn">
                <option value="warn">warn</option>
                <option value="crit">crit</option>
              </select>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400" title="Janela em segundos para aceitar o último valor">
                Janela (s)
              </label>
              <Input name="lookbackSec" type="number" min={60} defaultValue={3600} />
            </div>
            <Button type="submit" className="sm:col-span-12 sm:w-fit">
              Adicionar limite
            </Button>
          </form>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        {rules.length === 0 ? (
          <p className="p-6 text-sm text-zinc-500 dark:text-zinc-400">
            Nenhum limite definido. Crie um acima para o Nexus vigiar uma métrica e avisar antes do problema estourar.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Recurso</TableHead>
                <TableHead>Regra</TableHead>
                <TableHead>Severidade</TableHead>
                <TableHead>Último valor</TableHead>
                <TableHead>Avaliado</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell>
                    {rule.enabled ? <Badge variant="active">ativo</Badge> : <Badge variant="default">pausado</Badge>}
                  </TableCell>
                  <TableCell className="text-sm font-medium">{rule.resource.name}</TableCell>
                  <TableCell className="font-mono text-xs text-zinc-600 dark:text-zinc-400">
                    {rule.metricName} {OP_LABEL[rule.operator as MetricOperator] ?? rule.operator} {String(rule.threshold)}
                  </TableCell>
                  <TableCell>
                    {rule.severity === 'crit' ? (
                      <Badge variant="destructive">crit</Badge>
                    ) : (
                      <Badge variant="default">warn</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-zinc-500 dark:text-zinc-400">
                    {rule.lastValue != null ? String(rule.lastValue) : '—'}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-zinc-500 dark:text-zinc-400">
                    {rule.lastEvalAt ? rule.lastEvalAt.toISOString().slice(0, 16).replace('T', ' ') : 'nunca'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <form action={toggleThreshold}>
                        <input type="hidden" name="id" value={rule.id} />
                        <Button type="submit" variant="ghost" className="text-xs">
                          {rule.enabled ? 'Pausar' : 'Ativar'}
                        </Button>
                      </form>
                      <form action={deleteThreshold}>
                        <input type="hidden" name="id" value={rule.id} />
                        <Button type="submit" variant="ghost" className="text-rose-600">
                          Remover
                        </Button>
                      </form>
                    </div>
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
