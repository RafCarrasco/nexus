/**
 * Per-provider "how to connect" guidance shown in the new-connection form.
 * Firebase has its own upload wizard; every other provider shares a raw JSON
 * textarea, so this panel tells the user what Nexus collects, where to get the
 * credential, and exactly which fields go in the JSON.
 */

type GuideStep = { text: string; href?: string; linkLabel?: string };
type GuideField = { key: string; required: boolean; hint: string };
type Guide = { monitors: string; steps: GuideStep[]; fields: GuideField[]; note?: string };

export const CONNECTION_GUIDES: Record<string, Guide> = {
  supabase: {
    monitors: 'Projetos Supabase (status/health, última atividade) e custo diário por organização.',
    steps: [
      { text: 'No Supabase, abra Account → Access Tokens.', href: 'https://supabase.com/dashboard/account/tokens', linkLabel: 'abrir Access Tokens' },
      { text: 'Clique em "Generate new token", dê um nome (ex.: nexus) e copie o valor sbp_… — ele aparece só uma vez.' },
      { text: 'Para acompanhar só projetos específicos, pegue o ref de cada um: está na URL do projeto, dashboard/project/<ref>. Liste em projectRefs (separados por vírgula).' },
      { text: '(Opcional, para custo) pegue o slug da organização: está na URL dashboard/org/<slug> ou em Organization Settings.' },
    ],
    fields: [
      { key: 'token', required: true, hint: 'Personal Access Token da Management API (começa com sbp_).' },
      { key: 'projectRefs', required: false, hint: 'Refs dos projetos a acompanhar (vírgula ou lista). Em branco = todos os projetos da conta.' },
      { key: 'orgSlug', required: false, hint: 'Slug da organização — só necessário para puxar custo/billing.' },
    ],
    note: 'O token do Supabase enxerga TODOS os projetos da conta. Para trazer só um (ou alguns), preencha projectRefs — senão vem tudo junto.',
  },
  vercel: {
    monitors: 'Projetos e deployments da Vercel, com custo.',
    steps: [
      { text: 'Vercel → Settings → Tokens.', href: 'https://vercel.com/account/tokens', linkLabel: 'abrir Tokens' },
      { text: 'Crie um token e copie o valor.' },
    ],
    fields: [
      { key: 'token', required: true, hint: 'Token da conta Vercel.' },
      { key: 'teamId', required: false, hint: 'team_… — só para contas de time.' },
    ],
  },
  github: {
    monitors: 'Repositórios do GitHub (atividade recente).',
    steps: [
      { text: 'GitHub → Settings → Developer settings → Personal access tokens.', href: 'https://github.com/settings/tokens', linkLabel: 'abrir Tokens' },
      { text: 'Gere um PAT (ghp_…) com leitura de repositórios.' },
    ],
    fields: [
      { key: 'token', required: true, hint: 'Personal Access Token (ghp_…).' },
      { key: 'org', required: false, hint: 'Foca numa organização. Em branco = seus repositórios.' },
    ],
  },
  cloudflare: {
    monitors: 'Recursos Cloudflare (Workers, etc.).',
    steps: [
      { text: 'Cloudflare → My Profile → API Tokens.', href: 'https://dash.cloudflare.com/profile/api-tokens', linkLabel: 'abrir API Tokens' },
      { text: 'Crie um token com as permissões de leitura desejadas.' },
    ],
    fields: [
      { key: 'token', required: true, hint: 'API Token da Cloudflare.' },
      { key: 'accountId', required: false, hint: 'Necessário para enxergar Workers.' },
    ],
  },
  azure: {
    monitors: 'Recursos do Azure e custo da assinatura.',
    steps: [
      { text: 'Portal Azure → Microsoft Entra ID → App registrations → registre um app.' },
      { text: 'Copie Directory (tenant) ID e Application (client) ID; em Certificates & secrets, crie um client secret.' },
      { text: '(Opcional) informe a subscriptionId para puxar custo.' },
    ],
    fields: [
      { key: 'tenantId', required: true, hint: 'Directory (tenant) ID.' },
      { key: 'clientId', required: true, hint: 'Application (client) ID.' },
      { key: 'clientSecret', required: true, hint: 'Secret criado em Certificates & secrets.' },
      { key: 'subscriptionId', required: false, hint: 'Só para custo.' },
    ],
  },
  n8n: {
    monitors: 'Workflows do n8n — estrutura, execuções e custo de tokens de IA.',
    steps: [
      { text: 'No seu n8n → Settings → n8n API.' },
      { text: 'Crie uma API key (n8n_api_…).' },
      { text: 'A baseUrl é a URL pública do seu n8n.' },
    ],
    fields: [
      { key: 'baseUrl', required: true, hint: 'https://seu-n8n — sem barra no final.' },
      { key: 'apiKey', required: true, hint: 'API key do n8n (n8n_api_…).' },
    ],
  },
  sentry: {
    monitors: 'Erros/issues dos apps via Sentry — chegam por webhook e viram incidentes (sentry_issue) com a contagem de eventos do Sentry.',
    steps: [
      { text: 'Salve a conexão (pode ser com {} vazio — modo só-webhook).' },
      { text: 'No card da conexão, gere um Token de ingest e copie o valor.' },
      { text: 'No Sentry → Settings → Alerts (ou uma Internal Integration), crie uma regra que dispara num webhook apontando para https://nexus.srv1625247.hstgr.cloud/api/ingest/sentry?token=SEU_TOKEN', href: 'https://pg-consulting.sentry.io/settings/integrations/', linkLabel: 'abrir integrações do Sentry' },
      { text: '(Opcional) informe authToken + org para o Nexus também LISTAR os projetos do Sentry antes do primeiro erro.' },
    ],
    fields: [
      { key: 'authToken', required: false, hint: 'Auth token de org do Sentry — só para listar projetos (modo pull). Em branco = só webhook.' },
      { key: 'org', required: false, hint: 'Slug da organização no Sentry (ex.: pg-consulting). Necessário com authToken.' },
      { key: 'baseUrl', required: false, hint: 'Default https://sentry.io. Mude só para Sentry self-hosted.' },
    ],
    note: 'O token de ingest vai na URL do webhook (?token=…). É um token de baixo privilégio, revogável a qualquer momento no card da conexão.',
  },
  docker: {
    monitors: 'Containers Docker do host onde o Nexus roda.',
    steps: [
      { text: 'Normalmente nada a fazer — usa o socket padrão. Pode salvar com {} mesmo.' },
      { text: '(Opcional) informe socketPath se o socket estiver em outro caminho.' },
    ],
    fields: [{ key: 'socketPath', required: false, hint: 'Default: /var/run/docker.sock.' }],
  },
  fake: {
    monitors: 'Recursos sintéticos para testar o Nexus (somente dev).',
    steps: [{ text: 'Use apenas para testar — gera recursos falsos.' }],
    fields: [
      { key: 'resourceCount', required: false, hint: 'Quantos recursos falsos gerar.' },
      { key: 'dailyCost', required: false, hint: 'Custo diário sintético por recurso.' },
    ],
  },
};

export function ConnectionGuide({ type }: { type: string }) {
  const guide = CONNECTION_GUIDES[type];
  if (!guide) return null;

  return (
    <div className="space-y-3 rounded-xl border border-violet-200 bg-violet-50 p-4 text-sm text-violet-900 dark:border-violet-900/40 dark:bg-violet-950/30 dark:text-violet-100">
      <p>
        <span className="font-semibold">O que o Nexus coleta:</span> {guide.monitors}
      </p>

      <div>
        <p className="font-semibold">Passo a passo</p>
        <ol className="mt-1 list-decimal space-y-1 pl-5">
          {guide.steps.map((s, i) => (
            <li key={i}>
              {s.text}
              {s.href && (
                <>
                  {' '}
                  <a
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium underline"
                  >
                    {s.linkLabel ?? s.href}
                  </a>
                </>
              )}
            </li>
          ))}
        </ol>
      </div>

      <div>
        <p className="font-semibold">Campos do JSON</p>
        <ul className="mt-1 space-y-1">
          {guide.fields.map((f) => (
            <li key={f.key}>
              <code className="font-mono text-xs">{f.key}</code>{' '}
              <span className={f.required ? 'text-rose-600 dark:text-rose-300' : 'text-violet-500 dark:text-violet-300'}>
                {f.required ? '(obrigatório)' : '(opcional)'}
              </span>{' '}
              — {f.hint}
            </li>
          ))}
        </ul>
      </div>

      {guide.note && (
        <p className="rounded-md bg-amber-100 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
          ⚠️ {guide.note}
        </p>
      )}

      <p className="text-xs text-violet-500 dark:text-violet-300">
        Ao salvar, o Nexus testa as credenciais — se estiverem erradas, o erro aparece na hora.
      </p>
    </div>
  );
}
