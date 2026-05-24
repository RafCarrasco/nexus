# Rastreamento de custo no Nexus

## O que é

O Nexus possui uma seção dedicada ao rastreamento de custo de cada Connection e Workspace. Com ela você consegue:

- Ver o **custo acumulado dos últimos 30 dias** por Connection, Workspace e na visão geral.
- **Detectar picos** de gasto: quando o custo de um dia ultrapassa 1,5× a média dos últimos 7 dias, o sistema abre um incidente automático do tipo `cost-spike`.
- **Ratear custos por cliente**: via a tela de Configurações → Clientes, você associa um percentual de cada projeto a um cliente.

Enquanto o export de billing não estiver habilitado, o Nexus exibe "**—  não configurado**" no lugar do valor monetário. Isso é intencional — preferimos mostrar que não há dado a exibir um "$0,00" enganoso.

---

## Como funciona tecnicamente

1. **Coletor agendado (cron)**: toda noite, aproximadamente às 6h UTC, o Nexus executa `runCost` para cada Connection ativa.
2. **Chamada à Cloud Monitoring API**: o coletor pergunta à API do Google: *"qual foi o valor da métrica `billing.googleapis.com/billing/total_cost` para este projeto Firebase ontem?"*
3. **Gravação no banco**: o valor retornado é salvo em `CostSnapshot` com a data correspondente.
4. **Agregação na UI**: a interface soma todos os `CostSnapshot` dos últimos 30 dias e exibe o total. Se não há nenhum snapshot, exibe "não configurado".

A coleta roda automaticamente — sem intervenção humana depois de configurado.

---

## Por que mostra "Não configurado"

A métrica `billing.googleapis.com/billing/total_cost` só fica disponível na Cloud Monitoring se o **export de billing para o Cloud Monitoring** estiver habilitado na conta de billing do projeto.

Sem esse export:
- A API retorna série temporal vazia.
- O `runCost` não salva nenhum snapshot.
- A UI não tem dados para exibir → mostra "não configurado".

Isso **não é um bug** — é o comportamento esperado enquanto o setup não for feito.

---

## Quanto custa para a empresa

**Custo real: R$ 0,00.**

Detalhamento:

- A Cloud Monitoring API tem **free tier de 1 milhão de leituras/mês**.
- Nosso uso: **1 leitura por projeto por dia**.
  - Com 100 projetos monitorados: 100 leituras/dia × 30 dias = **3.000 leituras/mês**.
  - Isso representa **0,3% do free tier** — bem abaixo do limite.
- O export de billing para o Cloud Monitoring em si também é **gratuito**: habilitar o export apenas ativa uma métrica adicional no Cloud Monitoring, sem cobrar pelo armazenamento ou pela transmissão dos dados.

---

## Como habilitar

Você precisa ter o papel **Billing Account Administrator** ou **Billing Account Costs Manager** na conta de billing (veja seção de permissões abaixo).

Passo a passo:

1. Acesse [https://console.cloud.google.com/billing](https://console.cloud.google.com/billing).
2. Clique na conta de billing usada pelo projeto Firebase (geralmente algo como *PG-Consulting Group*).
3. No menu esquerdo, clique em **Billing export** (ou **Account management** → aba **Billing export**).
4. Localize a seção **Cloud Monitoring** e clique em **Edit settings** → ative o export.
5. Salve. O Google começa a publicar a métrica a partir do dia seguinte.
6. **Aguarde até 24 horas** para a primeira leitura aparecer no Cloud Monitoring.
7. O Nexus coleta automaticamente no próximo ciclo do cron (pode levar até 6 horas após o dado aparecer).

Depois disso, o valor "$0,00 não configurado" some e o custo real passa a ser exibido — sem necessidade de rebuild ou alteração de código.

---

## Permissão necessária

**Importante**: a permissão necessária é na **conta de billing**, não no projeto Firebase.

| Permissão | Onde fica |
|---|---|
| `roles/billing.admin` (Billing Account Administrator) | Conta de billing |
| `roles/billing.costsManager` (Billing Account Costs Manager) | Conta de billing |

Essas permissões são **diferentes** de ser Owner ou Editor de um projeto Google Cloud. Você pode ter acesso total ao projeto Firebase e ainda não ter permissão para alterar o billing da conta.

**Se você não tem essa permissão**: solicite ao responsável pela conta de billing da PG-Consulting Group (quem criou ou administra a conta de billing no Google Cloud).

O service account já configurado no Nexus possui `Monitoring Viewer`, que é suficiente para **ler** as métricas após o export estar ativo. Nenhuma alteração de permissão adicional é necessária no lado do Nexus.

---

## Alternativas se o export não for possível agora

Se não for possível habilitar o export de billing no momento, há alternativas planejadas:

- **BigQuery export** (mais preciso, mais complexo): o Google Cloud permite exportar dados de billing para o BigQuery, de onde o Nexus poderia importar. Isso exige configuração adicional e um dataset no BigQuery. Mais preciso para análises históricas longas.
- **Budget manual por Workspace** *(futuro)*: permitir que o time insira um valor mensal de budget estimado por Workspace manualmente no Nexus, sem depender de export automático.
- **Importação de CSV mensal** *(futuro)*: o console do Google Cloud permite exportar um CSV com o custo do mês. Futuramente o Nexus poderá aceitar o upload desse CSV para preencher os dados históricos.

---

## Quando vai funcionar automaticamente

Assim que:

1. O export de billing para o Cloud Monitoring estiver **habilitado** na conta de billing, **E**
2. O service account do Nexus tiver `Monitoring Viewer` no projeto Firebase (já está configurado),

o Nexus passa a coletar os custos automaticamente, sem nenhuma intervenção adicional. O "não configurado" some e o custo real aparece.

---

## Suporte de custo por provedor

| Provedor | Custo automático | Status |
|----------|------------------|--------|
| **Firebase** | ⚠️ Sim, via Cloud Monitoring | Precisa habilitar billing export → Monitoring (1x) + role `Monitoring Viewer` no SA |
| **Supabase** | ✅ Sim, via Management API | Funciona com PAT (`token`) + `orgSlug` |
| **Docker** | ❌ Não | Containers não têm custo direto — fica como recurso do VPS (custo fixo) |
| **Vercel** | ❌ Não | API pública não expõe custo diário. Bandwidth/invocações sim, futuramente derivamos |
| **GitHub** | ❌ Não | Actions billing exige escopo admin + Billing API; fora do MVP |
| **Cloudflare** | ❌ Não | Sem endpoint público simples; futuramente via Billing API |
| **Azure** | ⚠️ Possível | Cost Management API existe mas auth + setup separado; TODO |

Provedores marcados ❌ mostram **"não disponível"** no card de custo (cinza, sem link). Provedores ⚠️ mostram **"não configurado"** com link pra esta página enquanto setup não foi feito. ✅ rastreia normalmente.

Pra esses casos sem custo automático, os caminhos no roadmap:

- **Budget manual por workspace** — você digita gasto esperado/mês, app rastreia
- **Importação CSV** — baixa fatura do console + sobe no Nexus
- **Estimativa via usage × preço público** — futuramente derivamos do número de invocações × tabela de preço
