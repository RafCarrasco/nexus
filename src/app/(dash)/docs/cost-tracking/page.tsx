import { PageHeader } from '@/ui/components/page-header';

export const dynamic = 'force-static';

export default function CostTrackingDocPage() {
  return (
    <div className="max-w-3xl mx-auto py-4">
      <PageHeader
        title="Rastreamento de custo"
        subtitle="Como o Nexus calcula custos e como habilitar"
      />

      <div className="space-y-6 text-sm text-zinc-700 dark:text-zinc-300">

        <section>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2">O que é</h2>
          <p>
            O Nexus possui uma seção dedicada ao rastreamento de custo de cada Connection e Workspace. Com ela você consegue:
          </p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Ver o <strong>custo acumulado dos últimos 30 dias</strong> por Connection, Workspace e na visão geral.</li>
            <li>
              <strong>Detectar picos</strong> de gasto: quando o custo de um dia ultrapassa 1,5× a média dos últimos 7 dias,
              o sistema abre um incidente automático do tipo <code className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded text-xs">cost-spike</code>.
            </li>
            <li><strong>Ratear custos por cliente</strong>: via Configurações → Clientes, associe um percentual de cada projeto a um cliente.</li>
          </ul>
          <p className="mt-2">
            Enquanto o export de billing não estiver habilitado, o Nexus exibe{' '}
            <strong className="text-zinc-900 dark:text-zinc-100">&ldquo;— não configurado&rdquo;</strong> no lugar do valor monetário.
            Isso é intencional — preferimos mostrar que não há dado a exibir um &ldquo;$0,00&rdquo; enganoso.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Como funciona tecnicamente</h2>
          <ol className="list-decimal list-inside space-y-1">
            <li><strong>Coletor agendado (cron):</strong> toda noite, aproximadamente às 6h UTC, o Nexus executa <code className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded text-xs">runCost</code> para cada Connection ativa.</li>
            <li>
              <strong>Chamada à Cloud Monitoring API:</strong> o coletor pergunta à API do Google:{' '}
              <em>&ldquo;qual foi o valor da métrica <code className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded text-xs">billing.googleapis.com/billing/total_cost</code> para este projeto Firebase ontem?&rdquo;</em>
            </li>
            <li><strong>Gravação no banco:</strong> o valor retornado é salvo em <code className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded text-xs">CostSnapshot</code> com a data correspondente.</li>
            <li><strong>Agregação na UI:</strong> a interface soma todos os snapshots dos últimos 30 dias. Se não há nenhum, exibe &ldquo;não configurado&rdquo;.</li>
          </ol>
          <p className="mt-2">A coleta roda automaticamente — sem intervenção humana depois de configurado.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Por que mostra &ldquo;Não configurado&rdquo;</h2>
          <p>
            A métrica <code className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded text-xs">billing.googleapis.com/billing/total_cost</code> só
            fica disponível na Cloud Monitoring se o <strong>export de billing para o Cloud Monitoring</strong> estiver
            habilitado na conta de billing do projeto.
          </p>
          <p className="mt-2">Sem esse export:</p>
          <ul className="list-disc list-inside mt-1 space-y-1">
            <li>A API retorna série temporal vazia.</li>
            <li>O <code className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded text-xs">runCost</code> não salva nenhum snapshot.</li>
            <li>A UI não tem dados para exibir → mostra &ldquo;não configurado&rdquo;.</li>
          </ul>
          <p className="mt-2">Isso <strong>não é um bug</strong> — é o comportamento esperado enquanto o setup não for feito.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Quanto custa para a empresa</h2>
          <p className="font-semibold text-zinc-900 dark:text-zinc-100">Custo real: R$ 0,00.</p>
          <p className="mt-2">Detalhamento:</p>
          <ul className="list-disc list-inside mt-1 space-y-1">
            <li>A Cloud Monitoring API tem <strong>free tier de 1 milhão de leituras/mês</strong>.</li>
            <li>Nosso uso: <strong>1 leitura por projeto por dia</strong>.</li>
            <li>Com 100 projetos monitorados: 100 leituras/dia × 30 dias = <strong>3.000 leituras/mês</strong> = 0,3% do free tier.</li>
            <li>O export de billing para o Cloud Monitoring é <strong>gratuito</strong>: habilitar apenas ativa uma métrica adicional, sem cobrar armazenamento ou transmissão.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Como habilitar</h2>
          <p>
            Você precisa ter o papel <strong>Billing Account Administrator</strong> ou{' '}
            <strong>Billing Account Costs Manager</strong> na conta de billing (veja seção de permissões abaixo).
          </p>
          <ol className="list-decimal list-inside mt-3 space-y-2">
            <li>
              Acesse{' '}
              <a
                href="https://console.cloud.google.com/billing"
                target="_blank"
                rel="noreferrer"
                className="text-violet-600 hover:underline"
              >
                https://console.cloud.google.com/billing
              </a>
              .
            </li>
            <li>Clique na conta de billing usada pelo projeto Firebase (geralmente <em>PG-Consulting Group</em>).</li>
            <li>No menu esquerdo, clique em <strong>Billing export</strong> (ou <strong>Account management</strong> → aba <strong>Billing export</strong>).</li>
            <li>Localize a seção <strong>Cloud Monitoring</strong> e clique em <strong>Edit settings</strong> → ative o export.</li>
            <li>Salve. O Google começa a publicar a métrica a partir do dia seguinte.</li>
            <li><strong>Aguarde até 24 horas</strong> para a primeira leitura aparecer no Cloud Monitoring.</li>
            <li>O Nexus coleta automaticamente no próximo ciclo do cron (pode levar até 6 horas após o dado aparecer).</li>
          </ol>
          <p className="mt-2">
            Depois disso, o &ldquo;não configurado&rdquo; some e o custo real passa a ser exibido —
            sem necessidade de rebuild ou alteração de código.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Permissão necessária</h2>
          <p>
            <strong>Importante:</strong> a permissão necessária é na <strong>conta de billing</strong>, não no projeto Firebase.
          </p>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-zinc-50 dark:bg-zinc-900">
                  <th className="border border-zinc-200 dark:border-zinc-800 px-3 py-2 text-left font-medium text-zinc-700 dark:text-zinc-300">Papel</th>
                  <th className="border border-zinc-200 dark:border-zinc-800 px-3 py-2 text-left font-medium text-zinc-700 dark:text-zinc-300">Onde fica</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-zinc-200 dark:border-zinc-800 px-3 py-2 font-mono text-xs">roles/billing.admin</td>
                  <td className="border border-zinc-200 dark:border-zinc-800 px-3 py-2">Conta de billing</td>
                </tr>
                <tr className="bg-zinc-50 dark:bg-zinc-900">
                  <td className="border border-zinc-200 dark:border-zinc-800 px-3 py-2 font-mono text-xs">roles/billing.costsManager</td>
                  <td className="border border-zinc-200 dark:border-zinc-800 px-3 py-2">Conta de billing</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-2">
            Essas permissões são <strong>diferentes</strong> de ser Owner ou Editor de um projeto Google Cloud.
            Você pode ter acesso total ao projeto Firebase e ainda não ter permissão para alterar o billing da conta.
          </p>
          <p className="mt-2">
            <strong>Se você não tem essa permissão:</strong> solicite ao responsável pela conta de billing da
            PG-Consulting Group (quem criou ou administra a conta de billing no Google Cloud).
          </p>
          <p className="mt-2">
            O service account já configurado no Nexus possui <code className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded text-xs">Monitoring Viewer</code>,
            suficiente para <strong>ler</strong> as métricas após o export estar ativo. Nenhuma alteração adicional é necessária no lado do Nexus.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Alternativas se o export não for possível agora</h2>
          <ul className="list-disc list-inside space-y-2">
            <li>
              <strong>BigQuery export</strong> (mais preciso, mais complexo): o Google Cloud permite exportar dados de billing
              para o BigQuery, de onde o Nexus poderia importar. Exige configuração adicional e um dataset no BigQuery.
            </li>
            <li>
              <strong>Budget manual por Workspace</strong> <em>(futuro)</em>: permitir que o time insira um valor mensal
              estimado por Workspace manualmente no Nexus.
            </li>
            <li>
              <strong>Importação de CSV mensal</strong> <em>(futuro)</em>: o console do Google Cloud permite exportar um CSV
              com o custo do mês. Futuramente o Nexus poderá aceitar o upload desse CSV para preencher dados históricos.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Quando vai funcionar automaticamente</h2>
          <p>Assim que:</p>
          <ol className="list-decimal list-inside mt-1 space-y-1">
            <li>O export de billing para o Cloud Monitoring estiver <strong>habilitado</strong> na conta de billing, <strong>e</strong></li>
            <li>O service account do Nexus tiver <code className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded text-xs">Monitoring Viewer</code> no projeto Firebase (já está configurado),</li>
          </ol>
          <p className="mt-2">
            o Nexus passa a coletar os custos automaticamente, sem nenhuma intervenção adicional.
            O &ldquo;não configurado&rdquo; some e o custo real aparece.
          </p>
        </section>

      </div>
    </div>
  );
}
