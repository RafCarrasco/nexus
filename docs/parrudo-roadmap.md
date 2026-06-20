# Nexus "parrudo" — roadmap (2026-06-16)

Objetivo (Rafael): Nexus = painel único pra **entender tudo da PG que está no ar** — não só up/down, mas **qualidade** (apps de IA realmente funcionam?) e **custo dos apps monitorados** (incl. tokens de IA). Robusto + extensível via n8n.

Design completo via workflow (4 agents grounded). 4 frentes que encaixam numa arquitetura única: tudo escreve em `CostSnapshot` / `Incident` / `Metric`, então push (ingest) e pull (collectors) viram um painel só.

## Frentes

### 1. Ingest API — fundação
- `POST /api/ingest` autenticado por **token por-conexão** (model `IngestToken`: hash SHA-256 + salt, mostrado 1x, igual padrão do vault). Guard `assertIngestToken`.
- Payload discriminado por `kind`: `cost` (→ CostSnapshot), `metric` (→ novo model `Metric`: name/value/unit/ts/resourceId), `incident` (→ Incident, dedup por type+resourceId).
- Endpoints de gestão de token: `POST/GET/DELETE /api/connections/[id]/ingest-tokens` (admin).
- Destrava: n8n como motor de coleta, custo sem API, probes externos.
- Esforço M. Migration: IngestToken + Metric.

### 2. AI Probes — qualidade
- Model `AiProbe` espelha `UptimeCheck` (url, method, headers, bodyTemplate, prompts, validationMode, failThreshold, lastStatus...). `Incident.aiProbeId`.
- `runAiProbes` (scheduler ~60s): manda input conhecido → valida resposta por **regra** (não-vazio/contém/json-schema) ou **LLM-judge** (reusa `loadAiConfig`/`callLlm`: "essa resposta é coerente?"). Debounce igual uptime → incidente `ai_probe_failed`.
- `POST /api/probes/result` (HMAC) pra n8n postar veredito externo.
- Severidade: erro HTTP = crit; resposta ruim = warn.
- Esforço M. Migration: AiProbe + Incident.aiProbeId.

### 3. Custo de IA dos apps monitorados
- **Sem schema novo** — reusa `CostSnapshot.source = 'ai-tokens-{provider}'`.
- 3 caminhos: (a) providers nativos `openai`/`anthropic`/`gemini` (getDailyCost via usage API), (b) n8n já tem custo de token (`llm-pricing.ts`) → persistir como CostSnapshot, (c) ingest (app posta seu gasto).
- Painel `cost-dashboard.tsx`: separar Infra vs IA (KPI + barra empilhada). Forecast inclui IA.
- Esforço M. MVP: OpenAI usage (API estável); n8n persist; ingest.

### 4. Cobertura — fix de health dos providers (auditoria)
| Provider | Estado | Fix |
|---|---|---|
| **GitHub** | 🔴 sempre 'ok' | probe `GET /repos/{externalId}` → ok 2xx / down 404+401 / degraded resto |
| **Vercel** | 🔴 depende de metadata.productionUrl | buscar productionUrl fresco via `GET /v6/projects/{id}` + probe |
| **Firebase** | 🟠 só checa Auth | probe um serviço crítico (Firestore) no health do projeto |
| **n8n** | 🟠 stats null → 'ok' | se instância caída (stats null) → 'degraded'/'unknown', não 'ok' |
| Supabase | ✅ corrigido ao vivo 2026-06-16 (services repetido + body no erro) | — |
| Docker/Azure/Cloudflare | 🟢 real | opcional: validar token |

## Ordem de execução
1. **Fix dos 4 providers** (rápido, sem schema, cobertura imediata) ← primeiro
2. **Ingest API** (fundação)
3. **AI Probes** (qualidade — a parte nova de maior valor)
4. **Custo de IA** (reusa CostSnapshot)

## Decisões pendentes (do Rafael) por frente
- Ingest: avaliação de threshold síncrona vs background (rec: background); retenção de Metric.
- Probes: 1 prompt vs lista (rec: 1 no v1); guardar histórico de resultados (rec: sim, 30 últimos).
- Custo IA: source genérico vs por-provider (rec: por-provider + rollup); auth do ingest (rec: keyed por workspace).
