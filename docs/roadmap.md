# Nexus — Roadmap

> Priorizado por impacto × esforço. PT-BR por padrão.

---

## Próximas (alto valor, baixo esforço)

| # | Feature | Descrição |
|---|---------|-----------|
| 1 | **Synthetic uptime checks** | Ping HTTP/TCP periódico por recurso. Abre incidente automático se falhar N vezes. |
| 2 | **Alerting rules com thresholds** | Regras configuráveis: custo > X, latência > Y, erros > Z → incidente. |
| 3 | **Bulk actions em incidentes** | Resolver/ignorar múltiplos incidentes de uma vez na listagem. |
| 4 | **Saved filters** | Salvar filtros de recurso/incidente/custo por usuário (localStorage ou banco). |
| 5 | **Audit log UI** | Tela que exibe o `AuditLog` já modelado no banco — quem fez o quê e quando. |
| 6 | **Dark mode** | Tailwind `dark:` classes + toggle no sidebar. Zero dependência nova. |

---

## Médio prazo

| # | Feature | Descrição |
|---|---------|-----------|
| 7 | **Canais de notificação** | Webhook configurável para Teams, Slack, e-mail (SMTP) quando incidente abre/fecha. |
| 8 | **Status page pública por workspace** | URL pública `/status/[slug]` sem login — verde/amarelo/vermelho por recurso. Ideal para comunicação com clientes. |
| 9 | **Compare-period view** | Comparar custo e incidentes de período atual vs anterior (MoM, WoW). |
| 10 | **Cost forecasting** | Regressão linear simples sobre snapshots de custo → projeção dos próximos 30 dias. |
| 11 | **Runbooks por tipo de incidente** | Campo de texto rico por `incident.type` — instrução de remediação exibida ao abrir o incidente. |
| 12 | **Custom dashboards** | Usuário monta layout de widgets (custo, incidentes, uptime) por workspace. |

---

## Longo prazo

| # | Feature | Descrição |
|---|---------|-----------|
| 13 | **Synthetic monitoring distribuído** | Checks rodando de múltiplas regiões (edge functions). Detecta degradação regional. |
| 14 | **Mobile / PWA** | Manifest + service worker. Push notifications nativas para incidentes críticos. |
| 15 | **Log search full-text** | Ingestão de logs de função/container com busca via PostgreSQL `tsvector` ou OpenSearch. |
| 16 | **Anomaly detection ML** | Substituir regras fixas por modelo de séries temporais (Prophet ou ARIMA) para alertas adaptativos. |
| 17 | **Service map de dependências** | Grafo interativo de recursos — quais dependem de quais, propagação de falha visualizada. |

---

## Pesquisa de mercado — inspirações

| Ferramenta | Feature inspiradora |
|------------|---------------------|
| **Datadog** | Mapa de serviços com latência por aresta — visualizar impacto de falha upstream |
| **New Relic** | Distributed tracing com flame graph inline na tela de erro |
| **Vercel Observability** | Speed Insights: métricas de Web Vitals por rota, sem SDK extra |
| **Sentry** | Session Replay — gravar sessão de usuário que gerou o erro |
| **BetterUptime** | Status page white-label extremamente polida + subscriber notifications |
| **PagerDuty** | Escalation policies — se A não resolve em 10 min, notifica B automaticamente |
| **Linear** | Triage view — incidentes triados com prioridade e assignee, igual issues de produto |

---

*Última atualização: 2026-05-24. Adicione itens via PR com `## Backlog` no final.*

---

## Provedores

### Suportados agora

| Provedor | Recursos | Custo | Atividade | Health |
|----------|----------|-------|-----------|--------|
| **firebase** | Projects, Hosting sites, Cloud Functions | Cloud Monitoring | — | Hosting URL HEAD |
| **supabase** | Projects | Billing API | Database usage | `/health` endpoint |
| **docker** | Containers | — | `StartedAt` | Container state + health check |
| **vercel** | Projects | — (API pública não expõe custo) | Last deployment | `productionUrl` HEAD |
| **github** | Repos (org ou user) | — (Billing API requer admin scope) | `pushed_at` | Sempre ok (repo existe) |
| **cloudflare** | Zones + Workers scripts | — (Billing separado, fora do MVP) | `modified_on` | Zone hostname HEAD |
| **azure** | Subscriptions ou App Services | — (Cost Management API, fora do MVP) | — | `defaultHostName` HEAD |
| **fake** | Recursos sintéticos (dev) | — | — | — |

### TODO — próximos provedores

| Provedor | Prioridade | Notas |
|----------|-----------|-------|
| **AWS** | Alta | Usar AWS SDK ou STS/EC2/ECS via REST. Custo via Cost Explorer API. |
| **GCP direto** | Média | Alternativa ao Firebase SA — enumerate projects via Resource Manager. |
| **OpenAI usage** | Média | `/v1/usage` endpoint + API key. Custo diário por modelo. |
| **Anthropic usage** | Média | Console usage API (quando disponível publicamente). |
| **Stripe** | Média | Listar produtos/preços; MRR como "custo invertido". |
| **Sentry** | Baixa | Organizations + Projects + error rate como health proxy. |
| **Render** | Baixa | Services API; deploy timestamp para atividade. |
| **Netlify** | Baixa | Sites API; deploy timestamp para atividade. |
| **Resend** | Baixa | Domains + sending stats; bounce rate como health. |
| **PlanetScale / Neon** | Baixa | DB branches; query throughput para atividade. |
