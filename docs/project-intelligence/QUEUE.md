# Project Intelligence — Fila de execução

Epic: Nexus vira *project-aware* — entende cada projeto a fundo (o que usa, quanto,
saúde, postura) e observa agentes. Trabalho autônomo em fila, do recomendado ao resto.

Branch: `feat/project-intelligence`. **Não dar push em `main` até o pipeline + OK do Rafael.**
(Auto-deploy NÃO está ligado ainda — push em main hoje é inerte; ver Frente E.)

| # | Frente | Estado | Spec |
|---|--------|--------|------|
| A | Firebase profundo (inventário de serviços) | provider ✅ / UI pendente | `docs/superpowers/specs/2026-06-12-project-intelligence-design.md` |
| E | Auto-deploy (GitHub Actions CI-gated + SSH) | ✅ arquivos prontos / ativação pendente (Rafael) | `docs/auto-deploy.md` |
| B | Observabilidade de agentes (n8n + OpenClaw) | ⬜ fila | a escrever |
| C | Parrudão (hardening: segurança, resiliência, testes) | ⬜ fila | a escrever |
| D | Roadmap breadth (uptime, alerting, status page, forecast, dark mode...) | ⬜ fila | `docs/roadmap.md` |

## A — Firebase profundo (feito x resta)
- ✅ Provider: 6 helpers (enabled services, firestore dbs+collections, storage, rtdb, auth config),
  `serviceInventory` no project, recursos novos (`firebase-firestore`/`-storage-bucket`/`-rtdb`),
  guard de health. 6 testes novos verdes (18/18 no arquivo firebase).
- ⬜ UI: `<ServiceInventoryPanel>` na tela do recurso `firebase-project` (grid de cards por serviço).

## E — Auto-deploy (feito x ativação)
- ✅ `src/app/api/health/route.ts` (probe público), middleware libera `/api/health`.
- ✅ `scripts/deploy.sh` reescrito: `prisma migrate deploy` + health gate + rollback.
- ✅ `.github/workflows/ci.yml` (lint+typecheck+testes com Postgres) e `deploy.yml` (workflow_run, SSH).
- ✅ doc `auto-deploy.md` reescrito; rascunho n8n preservado em `auto-deploy-n8n-legacy.md`.
- ⬜ **Ativação (Rafael):** deploy key SSH + secrets GitHub + symlink do script no VPS. Checklist no doc.

## B — Observabilidade de agentes (notas pré-spec)
- n8n: ingerir execuções (sucesso/falha/duração) ao longo do tempo, falha por nó,
  **tokens de nós de IA (LangChain/AI Agent) → custo estimado**, auto-incidente em pico.
- OpenClaw: **bloqueio** — preciso saber o que expõe (API REST? logs? só container Docker?).
  Perguntar ao Rafael quando chegar a vez. Fallback: tratar como container (docker provider) + logs.

## C — Parrudão (notas pré-spec)
- Segurança: authz nas rotas API (quem pode ler/escrever connection/resource), vault de
  credencial (rotação master key), BYO API key do chat (onde fica, vaza?), rate-limit.
- Resiliência: retry/backoff nas chamadas de provider, isolamento de falha parcial no
  collector (já tem try/catch por etapa — auditar), timeout nas chamadas fetch (hoje sem timeout).
- Testes: cobertura dos providers novos, integração com DB real no CI.

## D — Roadmap breadth
Ver `docs/roadmap.md` (16 itens já priorizados). Puxar daqui quando A/B/C zerarem.
