# Nexus UI revamp — mapa de mudanças (2026-06-13)

Mapeamento read-only de 6 pedidos do Rafael. **Nada implementado ainda** — aguarda decisões marcadas com 🔸.

Ordem recomendada de execução: do mais barato/seguro pro mais profundo.

---

## 1. Uptime — melhorar descrição  ·  esforço **S**  ·  sem risco

**Problema:** subtítulo atual técnico demais (`"Ping HTTP periódico..."`), não diz pra que serve.

**O que faz de verdade:** cada check faz request HTTP (GET/HEAD) no intervalo definido; após N falhas consecutivas (default 3) abre incidente crítico + dispara notificações; recupera sozinho quando volta.

**Mudança:** copy-only em `src/app/(dash)/uptime/page.tsx` (subtítulo linha ~24 + empty-state linha ~69).
- Subtítulo proposto: *"Monitore a disponibilidade dos seus serviços e receba alertas automáticos quando algo ficar indisponível."*
- Card explicativo opcional acima do form: *"Cada check faz uma requisição HTTP no intervalo que você define. Se falhar várias vezes seguidas, abre um incidente crítico e envia notificações. Recupera sozinho quando o serviço volta."*

**Decisão:** nenhuma. Faço direto.

---

## 2. Auditoria — clarear (resolver os cuids)  ·  esforço **M**  ·  sem DB

**Problema:** coluna ALVO mostra cuid cru (`cmqbpkksf000m01pfsp58gpag`), sem contexto nem tipo de entidade.

**Mapa das ações** (16+ tipos): `connection.*`→Connection.name · `workspace.*`→Workspace.name · `uptime.*`→UptimeCheck.name · `channel.*`→NotificationChannel.name · `client.*`→Client.name · `resource.*`→Resource.name · `tenant.*`→Tenant.displayName · `alert.*`→AlertRule.name · `savedFilter.*`→já é o nome · `collector.run`→já é `all`/`inventory`/`cost` · `incident.*`→id (ou resumo).

**Mudança:**
- Novo `src/lib/audit-enrichment.ts`: discriminador `action→entityType` + resolver **em lote** (`findMany({id:{in:[...]}})` por tipo — evita N+1) + mapa de rótulos PT-BR (`connection.create`→"Criar conexão" etc).
- `src/app/(dash)/settings/audit/page.tsx`: resolve server-side no fetch, mostra nome no ALVO + label amigável no AÇÃO + badge do tipo.
- **Fallback obrigatório:** entidade deletada → mostra id cinza/"removido", nunca quebra. (Importante porque logs de alert/client/resource vão sobreviver mesmo se removermos essas abas — ver itens 3/4/5.)

**Decisão 🔸:** ALVO = "Nome [Tipo]" inline, ou coluna TIPO separada? (recomendo inline). Mostrar resumo do payload em tooltip? (opcional, fase 2).

---

## 3. Alertas — remover  ·  esforço **M**  ·  **com migration**

"pode tirar" → rip-out completo recomendado.

**Footprint (12 pontos):** nav.tsx:14 · `app/(dash)/alerts/` (page+actions) · schema `AlertRule` model + `Incident.alertRuleId` + `Workspace.alertRules` · `collector/runAlerts.ts` · `collector/scheduler.ts` (cron `*/5`) · `lib/alerting.ts` · `notify/context.ts` (buildAlertContext) · `notify/resolve.ts` (branch alertRule) · `notify/types.ts` (union `source`) · `incidents/page.tsx` (joins alertRule, linhas 38/44/49-50/124) · `tests/unit/lib.alerting.test.ts` · migration.

**DB:** `DROP TABLE AlertRule` + `Incident DROP COLUMN alertRuleId` (migration escrita à mão, CI valida). ⚠️ FK é `onDelete: Cascade` → incidentes de origem-alerta somem junto. Se quiser preservar histórico: backfill `alertRuleId=NULL` antes do drop.

**Nota:** o fix masked-incident #3 que acabei de subir vive em runAlerts.ts → vira moot (arquivo inteiro sai). Tudo bem.

**Decisão 🔸:** rip-out completo (recomendo) vs só esconder nav? · preservar histórico de incidentes-alerta ou deixar cascade deletar?

---

## 4. Recursos — remover  ·  esforço **M**

"acho que não precisa". **9 links de entrada** apontam pra `/resources` ou `/resources/[id]`:
nav.tsx:11 · overview `page.tsx` (stat card :138 + top spenders :209) · `workspaces/[slug]/page.tsx` (stat "Recursos") · `connection-card.tsx:127` · `incidents/page.tsx:50` (href do incidente→recurso) · `search/route.ts` (:76 e :89).

**Opção A — esconder nav** (30s, zero risco): tira só nav.tsx:11. Páginas/links continuam funcionando por URL. Inconsistente mas seguro.

**Opção B — remover de vez** (~20min): deleta `app/(dash)/resources/` + `api/resources/` + conserta os 9 links (top spenders→`/workspaces`, href de incidente→sem link ou `/workspaces`, search sem resultado de recurso). Risco: link órfão→404 se esquecer algum.

**Interação:** view por-workspace já existe (connection-card mostra recursos). O que se perde no B = inventário global pesquisável. E o filtro `?client=` mora aqui (some junto — ok, ver item 5).

**Decisão 🔸:** A ou B? Se B, top-spenders do overview viram link pra quê?

---

## 5. Clientes — remover (tentativo)  ·  esforço **S** (hide) / **M** (full)

"não precisa se bobear também" → baixa confiança.

**Footprint:** nav (settings/clients) · `settings/clients/` (CRUD) · `settings/allocations/` (aloca recurso→cliente, allocationPct) · schema `Client` + `Resource.clientId/allocationPct` + `Tenant.clientId` · `api/clients/[id]` · search · `lib/saved-filters.ts` (param `client`) · `resources/[id]` mostra clientId.

**Chave:** custo **NÃO** usa cliente hoje (dashboard é por-workspace). Mas spec lista "custo por cliente" como Fase 2.

**Recomendo Opção A — esconder nav, adiar removal full.** Tira clutter sem quebrar nada, mantém porta aberta pra Fase 2. Full removal = 3 migrations (drop Client + 3 colunas) + perde trilha tenant→cliente permanentemente.

**Decisão 🔸:** esconder nav (recomendo) vs apagar de vez? Custo-por-cliente está morto ou é Fase 2?

---

## 6. Chat IA — tirar config da aba + add Gemini  ·  esforço **M**  ·  **com migration**

**Hoje:** `ui/components/chat-widget.tsx` tem config inline (gear): provider Anthropic|OpenAI, **API key em localStorage**, model. Backend `api/chat/route.ts` recebe `provider+apiKey+model` no body e chama Anthropic/OpenAI direto. **Sem abstração de provider, sem Gemini, sem storage server-side.** `lib/llm-pricing.ts` já tem padrões Gemini (custo).

⚠️ **Segurança:** key em localStorage + mandada no request body é fraco. Mover pra server-side criptografado (vault AES-256-GCM, igual NotificationChannel) é upgrade de segurança também.

**Mudança:**
- Novo model `AiConfig` (provider, model, `encryptedApiKey` Bytes, por user) + migration.
- Nova página `settings/ai/` (page+actions, gated requireAdmin): dropdown provider (Claude/Gemini/OpenAI), model, campo key (password), salva criptografado. + entrada na nav settings (ex: "IA / LLM", ícone Sparkles).
- `api/chat/route.ts`: tira apiKey do body, busca AiConfig do user, decripta server-side, roteia por provider. Add branch Gemini (`@google/generative-ai`, `generateContent`).
- `chat-widget.tsx`: remove form de config + localStorage, vira só mensagens; busca config via novo `GET /api/ai-config` (devolve só provider+model, **nunca a key**).

**Decisão 🔸:** key por-user no DB (recomendo, isolamento) vs env compartilhada do server? · streaming ou one-shot v1 (recomendo one-shot)? · model Gemini default (ex: `gemini-2.0-flash` rápido / `gemini-2.5-pro` forte — confirmo doc atual na hora).

---

## Resumo / sequência sugerida

| # | Mudança | Esforço | DB? | Decisão pendente |
|---|---------|---------|-----|------------------|
| 1 | Uptime copy | S | não | — (faço direto) |
| 2 | Auditoria legível | M | não | layout ALVO |
| 3 | Remover Alertas | M | **sim** | full vs hide; histórico |
| 4 | Remover Recursos | M | não | A (hide) vs B (full) |
| 5 | Esconder Clientes | S | não | hide vs full |
| 6 | Config IA→settings + Gemini | M | **sim** | key storage; streaming; model |

**Interações cross-cutting:**
- Tirar Recursos/Alertas/Clientes encolhe muito a nav → mais limpo. Overview perde stat-cards de Recursos (repontar/remover).
- Auditoria (#2) precisa do fallback gracioso porque logs de `alert.*`/`client.*`/`resource.*` sobrevivem à remoção das abas.
- Filtro `?client=` mora na página de Recursos → some junto no #4-B.
- Migrations (#3, #6) escritas à mão, CI valida com Postgres antes do prod.

Default de execução (sem resposta): faço #1 e #2 (seguros, alto valor), e nos demais sigo minha recomendação da tabela. Mas espero teu OK nas decisões 🔸 antes de mexer em schema (#3, #6).
