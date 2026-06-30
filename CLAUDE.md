# CLAUDE.md — nexus

> Memória permanente para sessões do Claude Code neste repositório.
> **A fonte oficial de conhecimento do projeto é o Obsidian** (ver [📍 Documentação principal](#-documentação-principal-obsidian)). Este arquivo é orientação rápida; quando divergir do Obsidian, **o Obsidian prevalece**.

---

## ⚠️ Instruções permanentes (sempre seguir)

1. **Consultar a documentação existente ANTES de implementar** qualquer funcionalidade — ler o doc do Obsidian (`Projetos/nexus.md`) primeiro. ⚠️ Os docs in-repo (`docs/ui-revamp-map.md`, `docs/handoff-2026-05-24.md`, `docs/project-intelligence/QUEUE.md`) estão **desatualizados** — não confiar neles sem validar.
2. **Verificar se a documentação está consistente com o código** antes de confiar nela.
3. **Atualizar a documentação** (doc do Obsidian + este CLAUDE.md) sempre que criar ou alterar funcionalidade relevante.
4. **Registrar novas decisões arquiteturais** relevantes na seção *Decisões Arquiteturais* do doc do Obsidian.
5. **Alertar o usuário** sempre que identificar divergência entre código e documentação.
6. **Obsidian é a fonte oficial de conhecimento.** Os docs em `docs/` são históricos/de trabalho e podem estar estagnados.

---

## 📍 Documentação principal (Obsidian)

- **Vault:** `~/DEV/knowledge_base` (`../knowledge_base` a partir deste repo)
- **Doc canônica:** **`Projetos/nexus.md`** — engenharia reversa verificada arquivo-a-arquivo (2026-06-24), cobre frontend + engine + infra. É o estado real do código.
- Nexus **observa** os outros projetos: `Projetos/bpd_vision.md` (Firebase) e `Projetos/ams-agentes-n8n.md` (n8n) estão entre os providers monitorados.

## Resumo executivo

Plataforma **self-hosted de observabilidade + project-intelligence interna da PG**. Monitora "tudo da PG que está no ar" em 3 eixos: **disponibilidade** (up/down), **qualidade** (apps de IA respondem com coerência?) e **custo** (incl. tokens de IA). Cadastra Aplicativos (workspaces) → conecta providers (Firebase/Supabase/Vercel/GitHub/Cloudflare/Azure/Docker/n8n) → descobre recursos, abre incidentes automáticos, faz uptime/probes IA, antecipa degradação e rastreia custo. Roda em **VPS Hostinger atrás do Traefik**. Branch `main`.

## Objetivo principal

Painel único interno para a saúde, qualidade e custo de tudo que a PG mantém no ar, sobre recursos heterogêneos de múltiplos provedores — sem depender de SaaS de observabilidade externo.

## Stack utilizada

- **Next.js 15** App Router (RSC + server actions + route handlers), **React 18.3**.
- **NextAuth v5** (`5.0.0-beta.31`, ⚠️ beta) — **Microsoft Entra ID**, estratégia JWT.
- **Prisma 7** + **`@prisma/adapter-pg`** sobre **Postgres 16**. 24 models.
- **Scheduler: `node-cron` in-process** (iniciado por `instrumentation.ts`).
- **Cripto: `node:crypto` AES-256-GCM** (vault de credenciais). `firebase-admin`, `dockerode`.
- UI: Radix + base-ui + shadcn + Tailwind 3.4 (violet) + Recharts. **Node 22** (Docker). vitest + Playwright.

## Principais integrações

- **9 providers monitorados:** firebase, n8n, supabase, vercel, github, cloudflare, azure, docker (+ fake).
- **Postgres** (único datastore). **Firebase project-intelligence** (inventário profundo).
- **Notificações:** webhook / slack / teams + in-app (**e-mail NÃO implementado**).
- **LLM:** Anthropic (`claude-opus-4-8`) / OpenAI / Gemini — chat grounded + juiz de probe.
- **Ingest push** (`/api/ingest`, Bearer por-conexão) — n8n/scripts empurram cost/metric/incident.
- **GitHub Actions** (CI) + **autopull cron** (deploy pull na VPS).

## Regras arquiteturais importantes

- **`instrumentation.ts` é o único entry do background loop** → `node-cron` com 6 jobs (runAll 5min, runCost 6h, runUptime/runAiProbes 1min, runMetricEval 5min, runRetention 02:00).
- **Coleta sob advisory lock do Postgres** por-conexão (`pg_try_advisory_lock`).
- **RSC + Prisma direto** (leitura); **server actions** com guard + `writeAudit` + `revalidatePath` (mutação); **`/api`** (client fetch + ingest + health).
- **Credenciais sempre cifradas** (AES-256-GCM via `crypto/vault.ts`) — `Connection.credentials`, `NotificationChannel.config`, `AiConfig.config`. Chave de IA **nunca** volta ao browser.
- **SSRF guard universal** (`lib/http.ts`) em todo fetch externo (HEAD probes + webhooks).
- **Incidente é polimórfico** (3 FKs opcionais resource/uptime/aiprobe); dedup por `(alvo, tipo, resolvedAt=null)`.
- **Login PG-only fail-closed** (2 domínios); `assertApiRole`/guards em toda mutação.

## Convenções do projeto

- Migrations Prisma expand/contract (rollback do deploy NÃO reverte schema). `prisma migrate deploy` roda no deploy.
- Toda mutação → `writeAudit`. URLs externas → validar com `isSafePublicHttpUrl`.
- Adicionar provider = implementar a interface `Provider` (`providers/types.ts`) + registrar em `providers/registry.ts`.
- Adicionar canal de notificação = `notify/` (registry + dispatcher + formatter).
- Séries temporais novas precisam entrar no `runRetention`/`lib/retention.ts`.
- Zod está instalado mas os forms validam imperativo server-side (manter o padrão atual).

## Decisões arquiteturais relevantes

- **node-cron in-process / single-node** (simplicidade de 1 VPS) — não escala horizontal sem lock global.
- **Prisma 7 + adapter-pg** (driver adapter explícito; CLI precisa de `prisma.config.ts`).
- **JWT, não DB sessions** (adapter só persiste users/accounts).
- **Auto-deploy pull-cron** (`autopull.sh`) — evoluiu de n8n→SSH-push→pull porque o firewall Hostinger dropa SSH dos runners. Health-gate + rollback no `deploy.sh`.
- **Cripto própria** (sem KMS), master key única no `.env` da VPS.
- **Self-host VPS + Traefik** (`pg-cloud-net` external, TLS automático).

## ⚠️ Cuidados antes de implementar mudanças

- 🔴 **Bug de segurança aberto:** compose/CI/`.env.example` usam `NEXUS_ALLOWED_EMAIL_DOMAIN` (singular), mas o código lê **`NEXUS_ALLOWED_EMAIL_DOMAINS` (plural)** → o override de domínio **nunca dispara**, vale só o fallback PG hardcoded. Alinhar antes de mexer em auth.
- **Não rodar 2 réplicas** sem antes adicionar lock global aos jobs (runCost/runUptime/runMetricEval/runRetention duplicariam — só `runCollection` tem lock).
- **`crypto/vault.ts`:** perder a `NEXUS_MASTER_KEY` = perder todas as credenciais de provider (recovery = recriar conexões). Não rotacionar sem plano de re-encrypt.
- **NextAuth tem config duplicada** (`auth/config.ts` Node vs `auth/edge.ts` Edge) — manter os dois em sincronia (issuer/secret).
- **`/resources` está fora da nav mas viva** + 9 links apontam pra ela — não remover a página sem reapontar os links (404).
- **Migrations são expand/contract** — o rollback do deploy não reverte schema; escrever migrations compatíveis com a versão anterior.
- **Não confiar nos docs `docs/`** (ui-revamp-map, QUEUE.md, handoff) — estão estagnados; usar o doc do Obsidian.
- **e-mail como canal não funciona** (sem SMTP) — não oferecer como pronto.
- **`/var/run/docker.sock`** está montado (DockerProvider) — superfície sensível; cuidado ao expandir o acesso.

---

## Comandos

```bash
npm run dev              # next dev (local)
npm run build            # next build (standalone)
npm run start            # next start
npm run lint             # next lint
npm test                 # vitest run (precisa Postgres p/ alguns; ver vitest.config.ts)
npm run migrate:deploy   # prisma migrate deploy
npx playwright test      # e2e (precisa NEXUS_E2E=1 + secret)
```

**Deploy:** é **automático via pull-cron** na VPS — `git push main` → CI (lint+tsc+vitest) verde → `autopull.sh` (cron 2min) roda `deploy.sh` (build + `prisma migrate deploy` + health-gate + rollback). Não há push manual; o `deploy.yml` (SSH) e o webhook n8n são **legados mortos**.

**Ops na VPS:** o Claude tem chave SSH na VPS (env/logs/deploy direto) — ver memória `nexus-vps-ssh-microsoft-login`.

> Nota: arquitetura detalhada (6 cron jobs, pipeline coleta→incidente→notificação, 24 models Prisma + ER, 9 providers, fluxo de auto-deploy, regras de negócio com thresholds) está no Obsidian (`Projetos/nexus.md`).
