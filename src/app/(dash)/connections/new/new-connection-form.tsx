'use client';
import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/ui/components/button';
import { Input } from '@/ui/components/input';
import { Label } from '@/ui/components/label';
import { ConnectionGuide, CONNECTION_GUIDES } from './connection-guides';

type Workspace = { id: string; name: string };

/** Turn a config key (e.g. "projectRefs") into a friendly label ("Project Refs"). */
function friendlyLabel(key: string): string {
  const spaced = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Numeric-looking fields: send as number when the value parses to a finite number, else string. */
const NUMERIC_FIELDS = new Set(['resourceCount', 'dailyCost']);
function coerce(key: string, value: string): string | number {
  if (NUMERIC_FIELDS.has(key)) {
    const n = Number(value);
    if (value.trim() !== '' && Number.isFinite(n)) return n;
  }
  return value;
}

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
  supabase:   '{\n  "token": "sbp_...",\n  "projectRefs": "ref1, ref2 (opcional — em branco = todos)",\n  "orgSlug": "your-org-slug (opcional)"\n}',
  docker:     '{}',
  fake:       '{\n  "resourceCount": 3\n}',
};

export function NewConnectionForm({ workspaces = [], fixedWorkspaceId, successRedirect, banner, forcedType }: Props) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [type, setType] = useState(forcedType ?? 'firebase');
  // non-firebase: one labeled input per guide field, keyed by field.key
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  // non-firebase power-user escape hatch: raw JSON that overrides assembled fields
  const [advancedJson, setAdvancedJson] = useState('');
  // firebase-specific
  const [serviceAccount, setServiceAccount] = useState<SAJson | null>(null);
  const [billingInput, setBillingInput] = useState('');
  const [projectIdPreview, setProjectIdPreview] = useState('');
  const [emailPreview, setEmailPreview] = useState('');
  // workspace
  const [workspaceId, setWorkspaceId] = useState<string>(fixedWorkspaceId ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
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

  /**
   * Assemble the provider config from the form (firebase upload, or guide fields with the
   * advanced-JSON escape hatch). Returns the config or a human error message — shared by
   * both Save and the Test button so they validate exactly the same payload.
   */
  function assembleConfig(): { config: Record<string, unknown> } | { error: string } {
    if (type === 'firebase') {
      if (!serviceAccount) return { error: 'Carregue o arquivo de serviço (.json) do Firebase primeiro.' };
      return {
        config: {
          serviceAccount,
          ...(billingInput.trim() ? { billingAccountId: billingInput.trim() } : {}),
        },
      };
    }

    const fields = CONNECTION_GUIDES[type]?.fields ?? [];
    const missing = fields.filter((f) => f.required && !fieldValues[f.key]?.trim());
    if (missing.length > 0) {
      return { error: `Preencha os campos obrigatórios: ${missing.map((f) => friendlyLabel(f.key)).join(', ')}.` };
    }

    const assembled: Record<string, unknown> = {};
    for (const f of fields) {
      const raw = fieldValues[f.key];
      if (raw == null || raw.trim() === '') continue;
      assembled[f.key] = coerce(f.key, raw.trim());
    }

    if (advancedJson.trim() !== '') {
      try {
        return { config: JSON.parse(advancedJson) };
      } catch {
        return { error: 'JSON avançado inválido — corrija ou limpe o campo para usar os campos acima.' };
      }
    }
    return { config: assembled };
  }

  async function testConnection() {
    setTesting(true);
    setError(null);
    setTestResult(null);
    try {
      const built = assembleConfig();
      if ('error' in built) {
        setError(built.error);
        return;
      }
      const res = await fetch('/api/connections/validate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type, config: built.config }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (data?.ok) {
        setTestResult({ ok: true, msg: 'Conexão validada — credenciais OK.' });
      } else {
        setTestResult({ ok: false, msg: data?.error ?? 'Falha na validação.' });
      }
    } catch (e) {
      setTestResult({ ok: false, msg: (e as Error).message });
    } finally {
      setTesting(false);
    }
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const built = assembleConfig();
      if ('error' in built) {
        setError(built.error);
        setBusy(false);
        return;
      }
      const finalConfig = built.config;

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
              onChange={(e) => { setType(e.target.value); setServiceAccount(null); setProjectIdPreview(''); setEmailPreview(''); setFieldValues({}); setAdvancedJson(''); setError(null); }}
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

        {/* Non-firebase: per-provider guide (tutorial) + one labeled input per field */}
        {type !== 'firebase' && (
          <div className="space-y-4">
            <ConnectionGuide type={type} />

            {(CONNECTION_GUIDES[type]?.fields ?? []).map((f) => (
              <div key={f.key} className="space-y-2">
                <Label className="flex items-center gap-2">
                  {friendlyLabel(f.key)}
                  <span className={f.required ? 'text-xs font-normal text-rose-600 dark:text-rose-300' : 'text-xs font-normal text-zinc-500 dark:text-zinc-400'}>
                    {f.required ? 'obrigatório' : 'opcional'}
                  </span>
                </Label>
                <Input
                  value={fieldValues[f.key] ?? ''}
                  onChange={(e) => setFieldValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
                  placeholder={f.hint}
                  className="border-zinc-200 dark:border-zinc-800 focus:border-violet-500 focus:ring-2 focus:ring-violet-100 focus:ring-offset-0 font-mono"
                />
                <p className="text-xs text-zinc-500 dark:text-zinc-400">{f.hint}</p>
              </div>
            ))}

            {/* Power-user escape hatch: raw JSON overrides the fields above when filled. */}
            <details className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 px-3 py-2">
              <summary className="cursor-pointer text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Avançado: editar JSON
              </summary>
              <div className="mt-3 space-y-2">
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Para configs fora do padrão. Quando preenchido, este JSON substitui os campos acima.
                </p>
                <textarea
                  className="w-full min-h-[160px] rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-violet-100 focus:border-violet-500"
                  value={advancedJson}
                  onChange={(e) => setAdvancedJson(e.target.value)}
                  placeholder={PLACEHOLDER[type] ?? '{\n  "url": "...",\n  "token": "..."\n}'}
                />
              </div>
            </details>
          </div>
        )}

        {error && (
          <p className="text-sm text-red-600 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg p-3 whitespace-pre-wrap">
            {error}
          </p>
        )}

        {testResult && (
          <p
            className={
              testResult.ok
                ? 'text-sm text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-lg p-3 whitespace-pre-wrap'
                : 'text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-lg p-3 whitespace-pre-wrap'
            }
          >
            {testResult.ok ? '✓ ' : '✕ '}
            {testResult.msg}
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={busy || testing || !name}>
            {busy ? 'Salvando…' : 'Salvar conexão'}
          </Button>
          <Button type="button" variant="outline" onClick={testConnection} disabled={busy || testing}>
            {testing ? 'Testando…' : 'Testar conexão'}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()} disabled={busy || testing}>
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  );
}
