# Project Intelligence — Fila de execução

Epic: Nexus vira *project-aware* — entende cada projeto a fundo (o que usa, quanto,
saúde, postura) e observa agentes. Trabalho autônomo em fila, do recomendado ao resto.

Branch: `feat/project-intelligence`. **Não dar push em `main` até o pipeline + OK do Rafael.**
(Auto-deploy NÃO está ligado ainda — push em main hoje é inerte; ver Frente E.)

| # | Frente | Estado | Spec |
|---|--------|--------|------|
| A | Firebase profundo (inventário de serviços) | ✅ done (provider + UI) | `docs/superpowers/specs/2026-06-12-project-intelligence-design.md` |
| E | Auto-deploy (GitHub Actions CI-gated + SSH) | ✅ ATIVADO + prod no ar (2026-06-12) | `docs/auto-deploy.md` |
| B | Observabilidade de agentes (n8n + OpenClaw) | n8n ✅ (dados+UI+incidente) / token-custo+OpenClaw pendente | inline abaixo |
| C | Parrudão (hardening: segurança, resiliência, testes) | ⬜ fila | a escrever |
| D | Roadmap breadth (uptime, alerting, status page, forecast, dark mode...) | ⬜ fila | `docs/roadmap.md` |

## A — Firebase profundo (feito x resta)
- ✅ Provider: 6 helpers (enabled services, firestore dbs+collections, storage, rtdb, auth config),
  `serviceInventory` no project, recursos novos (`firebase-firestore`/`-storage-bucket`/`-rtdb`),
  guard de health. 6 testes novos verdes (18/18 no arquivo firebase).
- ✅ UI: `<ServiceInventoryPanel>` na tela do recurso `firebase-project` (grid de cards por serviço).
  Build-verificada (`next build` OK). Visual com dado real pendente env viva.

## E — Auto-deploy (feito x ativação)
- ✅ `src/app/api/health/route.ts` (probe público), middleware libera `/api/health`.
- ✅ `scripts/deploy.sh` reescrito: `prisma migrate deploy` + health gate + rollback.
- ✅ `.github/workflows/ci.yml` (lint+typecheck+testes com Postgres) e `deploy.yml` (workflow_run, SSH).
- ✅ doc `auto-deploy.md` reescrito; rascunho n8n preservado em `auto-deploy-n8n-legacy.md`.
- ✅ **ATIVADO 2026-06-12:** deploy key SSH (via hPanel SSH Keys) + secrets GitHub (VPS_HOST/USER/SSH_KEY)
  + symlink no VPS. Prod (`nexus.srv1625247.hstgr.cloud`) atualizado de `987c7c4` → main com A+B+C+D+E.
- ✅ **Fixes de deploy descobertos no 1º deploy real:** health gate via `docker compose exec` em
  `127.0.0.1` (não host/`localhost` — porta atrás do Traefik + IPv6); Dockerfile com node_modules
  completo + `prisma.config.ts` (CLI do Prisma 7 precisa pro `migrate deploy`); baseline das 4
  migrations no prod (tabela `_prisma_migrations` não existia — deploy antigo aplicava SQL na mão).
- ✅ **Modelo final = PULL via cron** (`scripts/autopull.sh`, every 2min, CI-gated, flock).
  Push-SSH (`deploy.yml`) **falha** (firewall Hostinger dropa SSH de entrada dos runners GitHub) →
  desabilitado. Pull testado end-to-end: push→CI verde→cron deploya com health gate. Ver `auto-deploy.md`.

## B — Observabilidade de agentes
- ✅ **n8n camada de dados:** provider enriquece workflows ativos com `execStats`
  (window/success/error/errorRate/avgDurationMs/lastErrorAt/lastRunAt) + `recentTokens`
  (parser best-effort de tokens de IA da última execução). `fetchWithTimeout` em todas as
  chamadas. Só workflows ativos (poupa calls). 4 testes novos.
- ✅ **n8n UI:** `<AgentStatsPanel>` na tela do recurso `n8n-workflow` (janela, taxa de erro,
  duração média, tokens IA, último erro). Build-verificado.
- ✅ **auto-incidente por pico de falha:** n8n getHealth migrado pro `execStats` (errorRate sobre
  janela de 20) → collector abre incidente quando agente começa a falhar. Teste "down" novo.
- ✅ **token → custo (USD):** `src/lib/llm-pricing.ts` (tabela preço/modelo + fallback) + `findModelName`
  (extrai modelo do payload best-effort) → `recentTokenCostUsd`/`recentModel` no metadata + no painel.
  Estimativa (não billing-accurate). `getDailyCost` segue null (custo é por-execução, não diário).
- ⬜ **OpenClaw: bloqueado** — Rafael não sabe o que expõe (REST? logs? só container?).
  Investigar via Chrome/SSH quando der acesso. Fallback: docker provider (container health) + logs.

## C — Parrudão (notas pré-spec)
- Segurança: authz nas rotas API (quem pode ler/escrever connection/resource), vault de
  credencial (rotação master key), BYO API key do chat (onde fica, vaza?), rate-limit.
- Resiliência: retry/backoff nas chamadas de provider, isolamento de falha parcial no
  collector (já tem try/catch por etapa — auditar), timeout nas chamadas fetch (hoje sem timeout).
- Testes: cobertura dos providers novos, integração com DB real no CI.

### Achados de review do PR #1 diferidos pra cá
- ✅ **Timeout em TODOS os providers** — `src/lib/http.ts` (`fetchWithTimeout` + `isSafePublicHttpUrl`
  + `probePublicUrl`); firebase/n8n refatorados pra importar; vercel/github/cloudflare/azure/supabase
  ligados; HEAD probes externos (vercel/cloudflare/azure) agora com guard SSRF. 6 testes do lib.
  (docker usa dockerode, não fetch — N/A.)
- **runCost: pular recursos não-`project:` do firebase** — hoje os rows de inventário
  (`firestore:`/`storage:`/`rtdb:`) geram chamada no-op + ruído de log + métrica `calls` inflada.
- **/api/health rate-limit no Traefik** — PR #1 adicionou cache in-process (5s) que limita carga
  no DB; pra DoS completo, considerar `rateLimit` middleware do Traefik na rota.
- **ServiceInventory tri-state** — distinguir "API negada" de "serviço inativo" (badge hoje é
  binário em-uso/inativo; quando Service Usage retorna [] não dá pra afirmar inativo).
- **deploy.sh expand/contract** — migração forward não reverte no rollback (documentado);
  considerar guard que exija migração backward-compatible.
- **Mock de teste** `accessTokenMock` retorna `{token}` em vez de `string` (contrato real do
  `googleAccessToken`) — corrigir pra `.mockResolvedValue('fake-token')`.
- **npm audit**: 13 moderate (firebase-admin/next/prisma chains), 0 high/critical — ticket à parte.

## D — Roadmap breadth
Ver `docs/roadmap.md` (16 itens já priorizados).
- ✅ **#5 Audit log** — `src/lib/audit.ts` (`writeAudit`, best-effort) gravando em 6 mutações
  (connection create/delete, collector.run, resource/workspace/client delete) + página
  `/settings/audit` + link no nav. 3 testes do helper. (Faltam: tenant.delete, incident.patch — triviais.)
- ✅ **#6 Dark mode** — JÁ ESTAVA PRONTO (ThemeProvider no layout + ThemeToggle + classes `dark:`).
- ✅ **#10 Cost forecasting** — `src/lib/forecast.ts` `forecastCost` (regressão linear, 30d) + card na cost page.
- ✅ **#9 Compare-period** — `compareCostPeriods` (30d vs anteriores, delta%) + card na cost page.
- ⬜ Restantes (#1 uptime checks, #2 alerting rules, #3 bulk incidentes, #4 saved filters, #7 canais notif,
  #8 status page pública, #11 runbooks, ...). uptime já têm base: `/api/health` + `probePublicUrl`.
- ⬜ **C retry/backoff** (adiado — baixo ROI + risco de prolongar o lock do collector).
