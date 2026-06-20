'use client';

import { useCallback, useState } from 'react';
import { ChevronDown, Copy, Trash2, KeyRound } from 'lucide-react';
import { Button } from '@/ui/components/button';
import { Input } from '@/ui/components/input';
import { useToast } from '@/ui/components/toast';

type TokenRow = {
  id: string;
  name: string;
  lastUsedAt: string | null;
  createdAt: string;
  expiresAt: string | null;
};

function fmt(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toISOString().slice(0, 19).replace('T', ' ');
}

/**
 * Per-connection ingest-token manager. Lets an admin list, generate and revoke
 * tokens used by n8n / external scripts to PUSH data into Nexus. The plaintext
 * token is shown exactly once, right after creation, in a copyable box.
 */
export function IngestTokens({ connectionId }: { connectionId: string }) {
  const { toast } = useToast();
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [revealed, setRevealed] = useState<string | null>(null);

  const base = `/api/connections/${connectionId}/ingest-tokens`;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(base);
      if (!res.ok) throw new Error(String(res.status));
      setTokens(await res.json());
      setLoaded(true);
    } catch {
      toast('Erro ao carregar tokens', 'error');
    } finally {
      setLoading(false);
    }
  }, [base, toast]);

  async function create() {
    setCreating(true);
    try {
      const res = await fetch(base, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: name.trim() || 'default' }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data: { id: string; token: string } = await res.json();
      setRevealed(data.token);
      setName('');
      await load();
      toast('Token gerado', 'success');
    } catch {
      toast('Erro ao gerar token', 'error');
    } finally {
      setCreating(false);
    }
  }

  async function revoke(tokenId: string) {
    try {
      const res = await fetch(`${base}/${tokenId}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) throw new Error(String(res.status));
      setTokens((prev) => prev.filter((t) => t.id !== tokenId));
      toast('Token revogado', 'success');
    } catch {
      toast('Erro ao revogar token', 'error');
    }
  }

  function copy(value: string) {
    void navigator.clipboard
      .writeText(value)
      .then(() => toast('Copiado', 'success'))
      .catch(() => toast('Não foi possível copiar', 'error'));
  }

  return (
    <details
      className="group rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/40"
      onToggle={(e) => {
        if ((e.currentTarget as HTMLDetailsElement).open && !loaded) void load();
      }}
    >
      <summary className="flex cursor-pointer select-none list-none items-center gap-2 px-4 py-2.5 text-sm font-medium text-zinc-600 dark:text-zinc-400">
        <KeyRound className="h-3.5 w-3.5 text-violet-500" />
        <span>Tokens de ingest</span>
        <ChevronDown className="ml-auto h-4 w-4 text-zinc-400 transition-transform -rotate-90 group-open:rotate-0" />
      </summary>

      <div className="space-y-3 border-t border-zinc-200 p-4 dark:border-zinc-800">
        {/* One-time reveal box */}
        {revealed && (
          <div className="rounded-lg border border-violet-300 bg-violet-50 p-3 text-sm dark:border-violet-800 dark:bg-violet-950/40">
            <p className="mb-2 text-xs font-medium text-violet-700 dark:text-violet-300">
              Copie agora — este token não será exibido de novo.
            </p>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded bg-white px-2 py-1.5 font-mono text-xs text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
                {revealed}
              </code>
              <Button size="sm" variant="outline" onClick={() => copy(revealed)}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setRevealed(null)}>
                OK
              </Button>
            </div>
          </div>
        )}

        {/* Create */}
        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1">
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Nome (opcional)</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="default" />
          </div>
          <Button size="sm" disabled={creating} onClick={create} className="bg-violet-600 hover:bg-violet-700 text-white">
            {creating ? 'Gerando…' : 'Gerar token'}
          </Button>
        </div>

        {/* List */}
        {loading && !loaded ? (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Carregando…</p>
        ) : tokens.length === 0 ? (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Nenhum token ainda.</p>
        ) : (
          <ul className="divide-y divide-zinc-100 overflow-hidden rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-700">
            {tokens.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between gap-3 bg-white px-3 py-2 text-sm dark:bg-zinc-900"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium text-zinc-900 dark:text-zinc-100">{t.name}</div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    último uso {fmt(t.lastUsedAt)}
                    {t.expiresAt && ` · expira ${fmt(t.expiresAt)}`}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                  onClick={() => revoke(t.id)}
                  title="Revogar token"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}
