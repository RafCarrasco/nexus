import { prisma } from '@/db/client';
import { PageHeader } from '@/ui/components/page-header';
import { Input } from '@/ui/components/input';
import { Button } from '@/ui/components/button';
import { Badge } from '@/ui/components/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/ui/components/table';
import { createAiProbe, deleteAiProbe } from './actions';

export const dynamic = 'force-dynamic';

function statusBadge(s: string | null) {
  if (s === 'up') return <Badge variant="active">ok</Badge>;
  if (s === 'down') return <Badge variant="destructive">falhando</Badge>;
  return <Badge variant="default">—</Badge>;
}

/** Pull the human judgement out of the stored lastResult Json blob, when present. */
function judgement(lastResult: unknown): string | null {
  if (lastResult && typeof lastResult === 'object' && !Array.isArray(lastResult)) {
    const j = (lastResult as Record<string, unknown>).judgement;
    if (typeof j === 'string' && j.trim()) return j;
  }
  return null;
}

export default async function ProbesPage() {
  const probes = await prisma.aiProbe.findMany({ orderBy: { createdAt: 'desc' } });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Probes IA"
        subtitle="Verifique se os apps com IA realmente respondem — com coerência, não só conectados"
      />

      <div className="rounded-xl border border-violet-200 bg-violet-50 p-4 text-sm text-violet-900 dark:border-violet-900/40 dark:bg-violet-950/30 dark:text-violet-200">
        <p>
          <span className="font-semibold">O que é:</span> cada probe envia uma{' '}
          <span className="font-semibold">pergunta conhecida</span> ao endpoint de IA do app e{' '}
          <span className="font-semibold">valida a resposta</span> — por regra (não vazia / contém um texto) ou por um{' '}
          <span className="font-semibold">juiz LLM</span> que reusa a IA configurada no Nexus para julgar se a resposta é
          coerente. Falhou várias vezes seguidas? O Nexus abre um incidente e notifica. Use{' '}
          <code className="font-mono text-xs">$PROMPT</code> no corpo para marcar onde a pergunta entra. Se o juiz do
          Nexus estiver fora, o tick é ignorado — uma queda de IA aqui não marca o app como quebrado à toa.
        </p>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Adicionar probe</h2>
        <form action={createAiProbe} className="grid grid-cols-1 items-end gap-3 sm:grid-cols-6">
          <div className="space-y-1 sm:col-span-3">
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Nome</label>
            <Input name="name" placeholder="Chatbot de produção" required />
          </div>
          <div className="space-y-1 sm:col-span-3">
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">URL do endpoint de IA</label>
            <Input name="url" placeholder="https://app.exemplo.com/api/chat" required />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Método</label>
            <select
              name="method"
              className="h-9 w-full rounded-md border border-zinc-300 bg-transparent px-2 text-sm dark:border-zinc-700"
              defaultValue="POST"
            >
              <option value="POST">POST</option>
              <option value="GET">GET</option>
            </select>
          </div>
          <div className="space-y-1 sm:col-span-5">
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400" title="JSON com o placeholder $PROMPT">
              Corpo (template JSON, use $PROMPT)
            </label>
            <Input
              name="bodyTemplate"
              placeholder={'{"messages":[{"role":"user","content":"$PROMPT"}]}'}
              defaultValue={'{"messages":[{"role":"user","content":"$PROMPT"}]}'}
              required
            />
          </div>
          <div className="space-y-1 sm:col-span-3">
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Pergunta enviada ($PROMPT)</label>
            <Input name="prompt" placeholder="Qual a capital da França?" required />
          </div>
          <div className="space-y-1 sm:col-span-3">
            <label
              className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
              title="Dot-path para extrair a resposta do JSON; vazio = corpo inteiro"
            >
              Caminho da resposta (opcional)
            </label>
            <Input name="responsePath" placeholder="choices.0.message.content" />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Validação</label>
            <select
              name="validationMode"
              className="h-9 w-full rounded-md border border-zinc-300 bg-transparent px-2 text-sm dark:border-zinc-700"
              defaultValue="rule"
            >
              <option value="rule">Regra</option>
              <option value="llm_judge">Juiz LLM</option>
            </select>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label
              className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
              title="Para modo Regra: non_empty ou contains:texto"
            >
              Regra (non_empty | contains:texto)
            </label>
            <Input name="validationRule" placeholder="contains:Paris" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400" title="Intervalo em segundos">
              Intervalo (s)
            </label>
            <Input name="intervalSec" type="number" min={30} defaultValue={300} />
          </div>
          <div className="space-y-1">
            <label
              className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
              title="Falhas consecutivas até abrir incidente"
            >
              Falhas
            </label>
            <Input name="failThreshold" type="number" min={1} defaultValue={2} />
          </div>
          <Button type="submit" className="sm:col-span-6 sm:w-fit">
            Adicionar probe
          </Button>
        </form>
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        {probes.length === 0 ? (
          <p className="p-6 text-sm text-zinc-500 dark:text-zinc-400">
            Nenhum probe ainda. Cadastre o endpoint de IA de um app acima para começar a verificar se ele responde com
            coerência.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Endpoint</TableHead>
                <TableHead>Validação</TableHead>
                <TableHead>Falhas</TableHead>
                <TableHead>Último check</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {probes.map((p) => {
                const j = judgement(p.lastResult);
                return (
                  <TableRow key={p.id}>
                    <TableCell>{statusBadge(p.lastStatus)}</TableCell>
                    <TableCell className="text-sm font-medium">{p.name}</TableCell>
                    <TableCell
                      className="max-w-[240px] truncate font-mono text-xs text-zinc-500 dark:text-zinc-400"
                      title={p.url}
                    >
                      {p.method} {p.url}
                    </TableCell>
                    <TableCell className="text-xs text-zinc-500 dark:text-zinc-400">
                      {p.validationMode === 'llm_judge' ? 'Juiz LLM' : `Regra${p.validationRule ? `: ${p.validationRule}` : ''}`}
                      {j ? <span className="mt-0.5 block max-w-[260px] truncate text-zinc-400" title={j}>{j}</span> : null}
                    </TableCell>
                    <TableCell className="text-xs text-zinc-500 dark:text-zinc-400">
                      {p.consecutiveFails > 0 ? `${p.consecutiveFails}/${p.failThreshold}` : '—'}
                      {p.lastError ? <span className="block text-rose-600">{p.lastError}</span> : null}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-zinc-500 dark:text-zinc-400">
                      {p.lastCheckedAt ? p.lastCheckedAt.toISOString().slice(0, 16).replace('T', ' ') : 'nunca'}
                    </TableCell>
                    <TableCell className="text-right">
                      <form action={deleteAiProbe}>
                        <input type="hidden" name="id" value={p.id} />
                        <Button type="submit" variant="ghost" className="text-rose-600">
                          Remover
                        </Button>
                      </form>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
