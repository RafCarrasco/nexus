'use client';
import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/ui/components/button';
import { Input } from '@/ui/components/input';
import { Label } from '@/ui/components/label';
import { ConnectionGuide } from './connection-guides';

type Workspace = { id: string; name: string };

interface Props {
  workspaces?: Workspace[];
  /** When set, workspaceId is fixed (workspace-scoped create page) */
  fixedWorkspaceId?: string;
  /** After save, redirect here instead of /connections */
  successRedirect?: string;
  /** Banner shown at top (e.g. "Aplicativo criado! Agora adicione a primeira conexão.") */
  banner?: string;
  /** When set, locks the type selector to this value */
  forcedType?: string;
}

type SAJson = {
  project_id: string;
  client_email: string;
  private_key: string;
  [k: string]: unknown;
};

const PLACEHOLDER: Record<string, string> = {
  vercel:     '{\n  "token": "your-vercel-token",\n  "teamId": "team_xxx (optional)"\n}',
  github:     '{\n  "token": "ghp_...",\n  "org": "your-org (optional, defaults to your repos)"\n}',
  cloudflare: '{\n  "token": "cf-api-token",\n  "accountId": "your-account-id (optional, needed for Workers)"\n}',
  azure:      '{\n  "tenantId": "...",\n  "clientId": "...",\n  "clientSecret": "...",\n  "subscriptionId": "optional"\n}',
  n8n:        '{\n  "baseUrl": "https://your-n8n-host",\n  "apiKey": "n8n_api_..."\n}',
  supabase:   '{\n  "token": "sbp_...",\n  "orgSlug": "your-org-slug"\n}',
  docker:     '{}',
  fake:       '{\n  "resourceCount": 3\n}',
};

export function NewConnectionForm({ workspaces = [], fixedWorkspaceId, successRedirect, banner, forcedType }: Props) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [type, setType] = useState(forcedType ?? 'firebase');
  // non-firebase: raw JSON textarea
  const [config, setConfig] = useState('{}');
  // firebase-specific
  const [serviceAccount, setServiceAccount] = useState<SAJson | null>(null);
  const [billingInput, setBillingInput] = useState('');
  const [projectIdPreview, setProjectIdPreview] = useState('');
  const [emailPreview, setEmailPreview] = useState('');
  // workspace
  const [workspaceId, setWorkspaceId] = useState<string>(fixedWorkspaceId ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    let parsed: SAJson;
    try {
      parsed = JSON.parse(text);
    } catch {
      setError('Arquivo não é JSON válido');
      return;
    }
    if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
      setError('JSON não parece um service account (faltam project_id, client_email ou private_key)');
      return;
    }
    setServiceAccount(parsed);
    setProjectIdPreview(parsed.project_id);
    setEmailPreview(parsed.client_email);
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      let finalConfig: Record<string, unknown>;
      if (type === 'firebase') {
        if (!serviceAccount) {
          setError('Carregue o arquivo de serviço (.json) do Firebase primeiro.');
          setBusy(false);
          return;
        }
        finalConfig = {
          serviceAccount,
          ...(billingInput.trim() ? { billingAccountId: billingInput.trim() } : {}),
        };
      } else {
        finalConfig = JSON.parse(config);
      }

      const res = await fetch('/api/connections', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name,
          type,
          config: finalConfig,
          workspaceId: workspaceId || null,
        }),
      });
      if (!res.ok) {
        setError(await res.text());
        return;
      }
      router.push((successRedirect ?? '/connections') as never);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      {banner && (
        <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-800 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-200">
          {banner}
        </div>
      )}

      <form
        className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm space-y-5"
        onSubmit={(e) => { e.preventDefault(); submit(); }}
      >
        {/* Nome */}
        <div className="space-y-2">
          <Label>Nome</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Production Firebase"
            className="border-zinc-200 dark:border-zinc-800 focus:border-violet-500 focus:ring-2 focus:ring-violet-100 focus:ring-offset-0"
          />
        </div>

        {/* Tipo */}
        {!forcedType && (
          <div className="space-y-2">
            <Label>Tipo</Label>
            <select
              className="w-full rounded-md border border-zinc-200 dark:border-zinc-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-100 focus:border-violet-500 bg-white dark:bg-zinc-900"
              value={type}
              onChange={(e) => { setType(e.target.value); setServiceAccount(null); setProjectIdPreview(''); setEmailPreview(''); }}
            >
              <option value="firebase">firebase</option>
              <option value="supabase">supabase</option>
              <option value="vercel">vercel</option>
              <option value="github">github</option>
              <option value="cloudflare">cloudflare</option>
              <option value="azure">azure</option>
              <option value="n8n">n8n</option>
              <option value="docker">docker</option>
              <option value="fake">fake (dev only)</option>
            </select>
          </div>
        )}
        {forcedType && (
          <div className="space-y-2">
            <Label>Tipo</Label>
            <div className="rounded-md border border-zinc-200 dark:border-zinc-800 px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300">
              {forcedType}
            </div>
          </div>
        )}

        {/* Workspace selector — only when not fixed */}
        {!fixedWorkspaceId && workspaces.length > 0 && (
          <div className="space-y-2">
            <Label>Aplicativo (opcional)</Label>
            <select
              className="w-full rounded-md border border-zinc-200 dark:border-zinc-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-100 focus:border-violet-500 bg-white dark:bg-zinc-900"
              value={workspaceId}
              onChange={(e) => setWorkspaceId(e.target.value)}
            >
              <option value="">— Nenhum —</option>
              {workspaces.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Firebase: file upload + billing */}
        {type === 'firebase' && (
          <>
            <div className="space-y-2">
              <Label>Arquivo de serviço (.json)</Label>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileRef.current?.click()}
                  className="shrink-0"
                >
                  Carregar arquivo de serviço (.json)
                </Button>
                {projectIdPreview && (
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{projectIdPreview}</span>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={handleFile}
              />
              {/* Preview box */}
              {serviceAccount && (
                <div className="mt-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-4 py-3 text-xs text-zinc-700 dark:text-zinc-300 space-y-1">
                  <div><span className="font-medium text-zinc-900 dark:text-zinc-100">project_id:</span> {projectIdPreview}</div>
                  <div><span className="font-medium text-zinc-900 dark:text-zinc-100">client_email:</span> {emailPreview}</div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Billing Account ID (opcional)</Label>
              <Input
                value={billingInput}
                onChange={(e) => setBillingInput(e.target.value)}
                placeholder="XXXXXX-XXXXXX-XXXXXX"
                className="border-zinc-200 dark:border-zinc-800 focus:border-violet-500 focus:ring-2 focus:ring-violet-100 focus:ring-offset-0 font-mono"
              />
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Encontrado no Console GCP → Faturamento. Necessário para custo diário.</p>
            </div>
          </>
        )}

        {/* Non-firebase: per-provider guide + raw JSON textarea */}
        {type !== 'firebase' && (
          <div className="space-y-3">
            <ConnectionGuide type={type} />
            <Label>Configuração (JSON)</Label>
            <textarea
              className="w-full min-h-[200px] rounded-md border border-zinc-200 dark:border-zinc-800 px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-violet-100 focus:border-violet-500"
              value={config}
              onChange={(e) => setConfig(e.target.value)}
              placeholder={PLACEHOLDER[type] ?? '{\n  "url": "...",\n  "token": "..."\n}'}
            />
          </div>
        )}

        {error && (
          <p className="text-sm text-red-600 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg p-3 whitespace-pre-wrap">
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <Button type="submit" disabled={busy || !name}>
            {busy ? 'Salvando…' : 'Salvar conexão'}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()} disabled={busy}>
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  );
}
