import { prisma } from '@/db/client';
import { auth } from '@/auth/config';
import { PageHeader } from '@/ui/components/page-header';
import { Input } from '@/ui/components/input';
import { Button } from '@/ui/components/button';
import { saveAiConfig } from './actions';
import { AI_PROVIDERS, PROVIDER_LABEL, DEFAULT_MODEL, isAiProvider, AI_CONFIG_ID, type AiProvider } from '@/lib/ai';

export const dynamic = 'force-dynamic';

export default async function AiSettingsPage() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;

  if (role !== 'admin') {
    return (
      <div className="space-y-6">
        <PageHeader title="IA" subtitle="Provedor e chave do assistente de chat" />
        <p className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
          Restrito a administradores.
        </p>
      </div>
    );
  }

  const row = await prisma.aiConfig.findUnique({
    where: { id: AI_CONFIG_ID },
    select: { provider: true, model: true },
  });
  const provider: AiProvider = row && isAiProvider(row.provider) ? row.provider : 'anthropic';
  const hasKey = !!row;

  return (
    <div className="space-y-6">
      <PageHeader
        title="IA"
        subtitle="Provedor e chave do assistente de chat — vale para todo o time"
      />

      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <form action={saveAiConfig} className="max-w-lg space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Provedor</label>
            <select
              name="provider"
              defaultValue={provider}
              className="h-9 w-full rounded-md border border-zinc-300 bg-transparent px-2 text-sm dark:border-zinc-700"
            >
              {AI_PROVIDERS.map((p) => (
                <option key={p} value={p}>
                  {PROVIDER_LABEL[p]}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Modelo (opcional)</label>
            <Input name="model" defaultValue={row?.model ?? ''} placeholder={DEFAULT_MODEL[provider]} />
            <p className="text-xs text-zinc-400">
              Em branco usa o padrão do provedor — Claude: <code className="font-mono">{DEFAULT_MODEL.anthropic}</code> ·
              Gemini: <code className="font-mono">{DEFAULT_MODEL.gemini}</code> ·
              OpenAI: <code className="font-mono">{DEFAULT_MODEL.openai}</code>
            </p>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Chave de API</label>
            <Input
              name="apiKey"
              type="password"
              placeholder={hasKey ? '•••••••• (já configurada — deixe em branco para manter)' : 'cole a chave do provedor'}
            />
          </div>

          <Button type="submit" className="w-fit">
            Salvar
          </Button>

          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            A chave é criptografada (AES-256-GCM) e fica apenas no servidor — nunca é exibida de volta nem enviada ao
            navegador. Status atual: {hasKey ? `configurado (${PROVIDER_LABEL[provider]})` : 'não configurado'}.
          </p>
        </form>
      </div>
    </div>
  );
}
