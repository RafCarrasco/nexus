# Project Intelligence — Fila de execução

Epic: Nexus vira *project-aware* — entende cada projeto a fundo (o que usa, quanto,
saúde, postura) e observa agentes. Trabalho autônomo em fila, do recomendado ao resto.

Branch: `feat/project-intelligence`. **Não dar push em `main` até o pipeline + OK do Rafael.**
(Auto-deploy NÃO está ligado ainda — push em main hoje é inerte; ver Frente E.)

| # | Frente | Estado | Spec |
|---|--------|--------|------|
| A | Firebase profundo (inventário de serviços) | ✅ done (provider + UI) | `docs/superpowers/specs/2026-06-12-project-intelligence-design.md` |
| E | Auto-deploy (GitHub Actions CI-gated + SSH) | ✅ arquivos prontos / ativação pendente (Rafael) | `docs/auto-deploy.md` |
| B | Observabilidade de agentes (n8n + OpenClaw) | n8n dados ✅ / UI+OpenClaw pendente | inline abaixo |
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
- ⬜ **Ativação (Rafael):** deploy key SSH + secrets GitHub + symlink do script no VPS. Checklist no doc.

## B — Observabilidade de agentes
- ✅ **n8n camada de dados:** provider enriquece workflows ativos com `execStats`
  (window/success/error/errorRate/avgDurationMs/lastErrorAt/lastRunAt) + `recentTokens`
  (parser best-effort de tokens de IA da última execução). `fetchWithTimeout` em todas as
  chamadas. Só workflows ativos (poupa calls). 4 testes novos.
- ⬜ **n8n UI:** painel "Agentes / execuções" na tela do recurso `n8n-workflow` (taxa de erro,
  duração média, tokens, último erro) — additive como o ServiceInventoryPanel.
- ⬜ **token → custo (R$/USD):** precisa tabela de preço por modelo; `getDailyCost` do n8n segue
  null até isso. Mapear modelo→preço (OpenAI/Anthropic/etc).
- ⬜ **auto-incidente por pico de falha:** usar `errorRate` do execStats pra abrir incidente
  (hoje getHealth ainda usa "erros nos últimos 5"). Migrar health pro execStats.
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
Ver `docs/roadmap.md` (16 itens já priorizados). Puxar daqui quando A/B/C zerarem.
