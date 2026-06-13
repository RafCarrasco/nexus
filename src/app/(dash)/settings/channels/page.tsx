import { prisma } from '@/db/client';
import { decrypt } from '@/crypto/vault';
import { PageHeader } from '@/ui/components/page-header';
import { Input } from '@/ui/components/input';
import { Button } from '@/ui/components/button';
import { Badge } from '@/ui/components/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/ui/components/table';
import { createChannel, deleteChannel, toggleChannel, testChannel } from './actions';

export const dynamic = 'force-dynamic';

const selectCls = 'h-9 w-full rounded-md border border-zinc-300 bg-transparent px-2 text-sm dark:border-zinc-700';

const TYPE_LABEL: Record<string, string> = {
  webhook: 'Webhook',
  slack: 'Slack',
  teams: 'Teams',
  email: 'Email',
};

/**
 * Decrypt just enough to show a SAFE destination hint — host only, never the full URL or
 * any SMTP secret. Webhook/slack/teams show the host; email shows the SMTP host.
 */
function maskedTarget(type: string, config: Buffer): string {
  try {
    const cfg = decrypt<{ url?: string; host?: string }>(Buffer.from(config));
    if (type === 'email') return cfg.host ? `smtp: ${cfg.host}` : '—';
    if (cfg.url) {
      try {
        return new URL(cfg.url).host;
      } catch {
        return '—';
      }
    }
    return '—';
  } catch {
    return '(config ilegível)';
  }
}

export default async function ChannelsPage() {
  const channels = await prisma.notificationChannel.findMany({ orderBy: { createdAt: 'desc' } });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notificações"
        subtitle="Canais de saída — disparam quando um incidente abre ou é resolvido (webhook, Slack, Teams, email)"
      />

      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Adicionar canal</h2>
        <form action={createChannel} className="grid grid-cols-1 items-end gap-3 sm:grid-cols-6">
          <div className="space-y-1 sm:col-span-2">
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Nome</label>
            <Input name="name" placeholder="Canal de alertas #ops" required />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Tipo</label>
            <select name="type" className={selectCls} defaultValue="webhook">
              <option value="webhook">Webhook</option>
              <option value="slack">Slack</option>
              <option value="teams">Teams</option>
              <option value="email">Email (SMTP)</option>
            </select>
          </div>
          <div className="space-y-1 sm:col-span-3">
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              URL (webhook / Slack / Teams)
            </label>
            <Input name="url" placeholder="https://hooks.slack.com/services/..." />
          </div>

          {/* SMTP fields — only used when tipo = Email */}
          <div className="space-y-1 sm:col-span-2">
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">SMTP host (email)</label>
            <Input name="host" placeholder="smtp.exemplo.com" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Porta</label>
            <Input name="port" type="number" defaultValue={587} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Usuário</label>
            <Input name="user" placeholder="apikey" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Senha</label>
            <Input name="pass" type="password" placeholder="••••••" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">De (from)</label>
            <Input name="from" placeholder="nexus@exemplo.com" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Para (to)</label>
            <Input name="to" placeholder="ops@exemplo.com" />
          </div>

          <div className="flex items-center gap-4 sm:col-span-3">
            <label className="flex items-center gap-2 text-xs font-medium text-zinc-600 dark:text-zinc-400">
              <input type="checkbox" name="notifyOnOpen" defaultChecked className="h-4 w-4 accent-violet-600" />
              Avisar ao abrir
            </label>
            <label className="flex items-center gap-2 text-xs font-medium text-zinc-600 dark:text-zinc-400">
              <input type="checkbox" name="notifyOnResolve" defaultChecked className="h-4 w-4 accent-violet-600" />
              Avisar ao resolver
            </label>
          </div>

          <Button type="submit" className="sm:col-span-6 sm:w-fit">
            Adicionar canal
          </Button>
        </form>
        <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
          Para webhook / Slack / Teams preencha a URL. Para email preencha os campos SMTP. As credenciais são
          criptografadas em repouso e nunca exibidas.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        {channels.length === 0 ? (
          <p className="p-6 text-sm text-zinc-500 dark:text-zinc-400">
            Nenhum canal ainda. Adicione um webhook, Slack, Teams ou email acima.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Destino</TableHead>
                <TableHead>Eventos</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Último disparo</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {channels.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{c.name}</TableCell>
                  <TableCell>
                    <Badge variant="violet">{TYPE_LABEL[c.type] ?? c.type}</Badge>
                  </TableCell>
                  <TableCell className="max-w-[220px] truncate font-mono text-xs text-zinc-500 dark:text-zinc-400">
                    {maskedTarget(c.type, Buffer.from(c.config))}
                  </TableCell>
                  <TableCell className="text-xs text-zinc-500 dark:text-zinc-400">
                    {c.notifyOnOpen ? 'abre' : ''}
                    {c.notifyOnOpen && c.notifyOnResolve ? ' · ' : ''}
                    {c.notifyOnResolve ? 'resolve' : ''}
                    {!c.notifyOnOpen && !c.notifyOnResolve ? '—' : ''}
                  </TableCell>
                  <TableCell>
                    {c.enabled ? <Badge variant="active">ativo</Badge> : <Badge variant="default">inativo</Badge>}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-zinc-500 dark:text-zinc-400">
                    {c.lastFiredAt ? c.lastFiredAt.toISOString().slice(0, 16).replace('T', ' ') : 'nunca'}
                    {c.lastError ? <span className="block text-rose-600">{c.lastError}</span> : null}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <form action={testChannel}>
                        <input type="hidden" name="id" value={c.id} />
                        <Button type="submit" variant="ghost" size="sm">
                          Testar
                        </Button>
                      </form>
                      <form action={toggleChannel}>
                        <input type="hidden" name="id" value={c.id} />
                        <Button type="submit" variant="ghost" size="sm">
                          {c.enabled ? 'Desativar' : 'Ativar'}
                        </Button>
                      </form>
                      <form action={deleteChannel}>
                        <input type="hidden" name="id" value={c.id} />
                        <Button type="submit" variant="ghost" size="sm" className="text-rose-600">
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
