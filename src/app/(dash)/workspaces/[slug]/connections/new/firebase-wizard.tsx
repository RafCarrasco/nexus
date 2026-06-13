'use client';
import { useState, useRef, type DragEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  Check,
  Circle,
  CircleDot,
  Copy,
  ExternalLink,
  Upload,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { Button } from '@/ui/components/button';
import { Input } from '@/ui/components/input';
import { Label } from '@/ui/components/label';

type Step = 1 | 2 | 3 | 4 | 5;

type ServiceAccount = {
  type: string;
  project_id: string;
  client_email: string;
  private_key: string;
};

type Props = {
  workspaceSlug: string;
  workspaceId: string;
  workspaceName: string;
};

export function FirebaseWizard({ workspaceSlug, workspaceId, workspaceName }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [sa, setSa] = useState<ServiceAccount | null>(null);
  const [name, setName] = useState('');
  const [billingId, setBillingId] = useState('');
  const [useBigQuery, setUseBigQuery] = useState(false);
  const [bqProject, setBqProject] = useState('');
  const [bqDataset, setBqDataset] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [iamCopied, setIamCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function readFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as ServiceAccount;
        if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
          setError(
            'Arquivo não parece um service account Firebase. Faltam campos obrigatórios (project_id, client_email, private_key).',
          );
          return;
        }
        setSa(parsed);
        setName(`${parsed.project_id} (${workspaceName})`);
        setError(null);
        setStep(3);
      } catch {
        setError('Arquivo não é JSON válido.');
      }
    };
    reader.readAsText(file);
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) readFile(file);
  }

  function copyIamCommand() {
    if (!sa) return;
    let cmd: string;
    if (useBigQuery) {
      cmd =
        `gcloud projects add-iam-policy-binding ${sa.project_id} \\\n` +
        `  --member="serviceAccount:${sa.client_email}" \\\n` +
        `  --role="roles/bigquery.dataViewer"\n\n` +
        `gcloud projects add-iam-policy-binding ${sa.project_id} \\\n` +
        `  --member="serviceAccount:${sa.client_email}" \\\n` +
        `  --role="roles/bigquery.jobUser"`;
    } else {
      cmd =
        `gcloud projects add-iam-policy-binding ${sa.project_id} \\\n` +
        `  --member="serviceAccount:${sa.client_email}" \\\n` +
        `  --role="roles/monitoring.viewer"`;
    }
    void navigator.clipboard.writeText(cmd);
    setIamCopied(true);
    setTimeout(() => setIamCopied(false), 2000);
  }

  async function save() {
    if (!sa) return;
    setBusy(true);
    setError(null);
    setSyncStatus('Salvando conexão…');
    try {
      const res = await fetch('/api/connections', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name,
          type: 'firebase',
          workspaceId,
          config: {
            serviceAccount: sa,
            ...(billingId.trim() ? { billingAccountId: billingId.trim() } : {}),
            ...(useBigQuery && bqDataset.trim() ? { bigQueryDataset: bqDataset.trim() } : {}),
            ...(useBigQuery && bqProject.trim() ? { bigQueryProject: bqProject.trim() } : {}),
          },
        }),
      });
      if (!res.ok) {
        setError(`Erro ao salvar: ${await res.text()}`);
        setSyncStatus(null);
        return;
      }
      setSyncStatus('Conexão salva. Descobrindo recursos…');
      await fetch('/api/collector/run?kind=inventory', { method: 'POST' });
      setSyncStatus('Pronto! Redirecionando…');
      setTimeout(() => router.push(`/workspaces/${workspaceSlug}` as never), 800);
    } catch (e) {
      setError((e as Error).message);
      setSyncStatus(null);
    } finally {
      setBusy(false);
    }
  }

  const steps: { n: Step; label: string }[] = [
    { n: 1, label: 'Baixar credenciais' },
    { n: 2, label: 'Subir arquivo' },
    { n: 3, label: 'Confirmar projeto' },
    { n: 4, label: 'Nome e permissões' },
    { n: 5, label: 'Salvar e sincronizar' },
  ];

  function StepIcon({ n }: { n: Step }) {
    if (step > n)
      return (
        <div className="h-6 w-6 rounded-full bg-violet-600 text-white flex items-center justify-center shrink-0">
          <Check className="h-3.5 w-3.5" />
        </div>
      );
    if (step === n)
      return (
        <div className="h-6 w-6 rounded-full bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 flex items-center justify-center shrink-0">
          <CircleDot className="h-4 w-4" />
        </div>
      );
    return (
      <div className="h-6 w-6 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-400 flex items-center justify-center shrink-0">
        <Circle className="h-4 w-4" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-8 max-w-5xl">
      {/* Left: step nav */}
      <aside className="space-y-1">
        {steps.map((s) => (
          <button
            key={s.n}
            onClick={() => {
              if (step > s.n) setStep(s.n);
            }}
            disabled={step <= s.n}
            className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
              step === s.n
                ? 'bg-violet-50 dark:bg-violet-950/40 text-zinc-900 dark:text-zinc-100 font-medium'
                : step > s.n
                  ? 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer'
                  : 'text-zinc-400 cursor-default'
            }`}
          >
            <StepIcon n={s.n} />
            <span>
              {s.n}. {s.label}
            </span>
          </button>
        ))}

        {/* Progress bar */}
        <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
          <div className="flex justify-between text-xs text-zinc-500 dark:text-zinc-400 mb-1">
            <span>Progresso</span>
            <span>{Math.round(((step - 1) / 4) * 100)}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-violet-500 transition-all duration-500"
              style={{ width: `${((step - 1) / 4) * 100}%` }}
            />
          </div>
        </div>
      </aside>

      {/* Right: active step */}
      <div className="space-y-6">
        {/* ── Step 1 ── */}
        {step === 1 && (
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm space-y-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-violet-600 mb-1">
                Passo 1 de 5
              </p>
              <h2 className="text-lg font-semibold tracking-tight">
                Baixar service account do Firebase
              </h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                Esse arquivo dá acesso de leitura pro Nexus monitorar o projeto. Você só faz isso
                uma vez por projeto Firebase.
              </p>
            </div>

            <ol className="space-y-3 text-sm text-zinc-700 dark:text-zinc-300 list-none">
              {[
                <>
                  Abra o Firebase Console e selecione o projeto:
                  <a
                    href="https://console.firebase.google.com/u/0/?utm_source=nexus"
                    target="_blank"
                    rel="noreferrer"
                    className="ml-2 inline-flex items-center gap-1 text-violet-600 hover:underline font-medium"
                  >
                    Abrir Firebase Console <ExternalLink className="h-3 w-3" />
                  </a>
                </>,
                <>
                  No topo esquerdo, clique no{' '}
                  <span className="font-mono bg-zinc-100 dark:bg-zinc-800 text-xs px-1.5 py-0.5 rounded">⚙️</span>{' '}
                  ao lado de <strong>Project Overview</strong> → <strong>Project settings</strong>
                </>,
                <>
                  Vá na aba <strong>Service accounts</strong>
                </>,
                <>
                  Clique no botão{' '}
                  <span className="bg-violet-100 dark:bg-violet-950/40 text-violet-800 dark:text-violet-200 text-xs font-semibold px-2 py-0.5 rounded">
                    Generate new private key
                  </span>
                </>,
                <>
                  Confirme — o navegador baixa um arquivo{' '}
                  <code className="bg-zinc-100 dark:bg-zinc-800 text-xs px-1.5 py-0.5 rounded font-mono">
                    .json
                  </code>
                </>,
              ].map((item, i) => (
                <li key={i} className="flex gap-3 items-start">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 text-xs font-bold mt-0.5">
                    {i + 1}
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ol>

            <div className="rounded-md bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 p-3 text-xs text-amber-800 dark:text-amber-200 flex gap-2">
              <span>⚠️</span>
              <span>
                Esse arquivo é como uma senha — não comite no git, não compartilhe em chat. O
                Nexus criptografa e armazena de forma segura.
              </span>
            </div>

            <Button
              onClick={() => setStep(2)}
              className="bg-violet-600 hover:bg-violet-700 text-white rounded-xl"
            >
              Já baixei, próximo →
            </Button>
          </div>
        )}

        {/* ── Step 2 ── */}
        {step === 2 && (
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm space-y-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-violet-600 mb-1">
                Passo 2 de 5
              </p>
              <h2 className="text-lg font-semibold tracking-tight">Soltar o arquivo aqui</h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                Arraste o JSON baixado pra cá ou clique pra escolher do computador.
              </p>
            </div>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => fileRef.current?.click()}
              className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed py-14 cursor-pointer transition-colors select-none ${
                dragOver
                  ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/40'
                  : 'border-zinc-300 dark:border-zinc-700 hover:border-violet-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'
              }`}
            >
              <Upload
                className={`h-10 w-10 transition-colors ${dragOver ? 'text-violet-500' : 'text-zinc-400'}`}
              />
              <div className="text-sm text-zinc-700 dark:text-zinc-300 font-medium">
                {dragOver ? 'Solte aqui!' : 'Arraste o .json ou clique pra escolher'}
              </div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                Apenas arquivos JSON do Firebase Admin SDK
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".json,application/json"
                onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0])}
                className="hidden"
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-md bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 p-3 text-sm text-red-800 dark:text-red-200">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <div>{error}</div>
              </div>
            )}

            <Button variant="outline" onClick={() => setStep(1)}>
              ← Voltar
            </Button>
          </div>
        )}

        {/* ── Step 3 ── */}
        {step === 3 && sa && (
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm space-y-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-violet-600 mb-1">
                Passo 3 de 5
              </p>
              <h2 className="text-lg font-semibold tracking-tight">Confirmar projeto detectado</h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                Confira se é o projeto certo antes de continuar.
              </p>
            </div>

            <dl className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-4 space-y-4 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-0.5">
                  Project ID
                </dt>
                <dd className="font-mono text-zinc-900 dark:text-zinc-100 font-medium">{sa.project_id}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-0.5">
                  Service account email
                </dt>
                <dd className="font-mono text-zinc-900 dark:text-zinc-100 break-all">{sa.client_email}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-0.5">
                  Aplicativo Nexus
                </dt>
                <dd className="text-zinc-900 dark:text-zinc-100">{workspaceName}</dd>
              </div>
            </dl>

            <div className="rounded-md bg-violet-50 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-900 p-3 text-xs text-violet-800 dark:text-violet-200">
              <strong>O Nexus vai descobrir automaticamente:</strong> projeto Firebase · sites
              Hosting · Cloud Functions · tenants Auth · Firestore · Storage buckets
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setSa(null);
                  setStep(2);
                }}
              >
                ← Trocar arquivo
              </Button>
              <Button
                onClick={() => setStep(4)}
                className="bg-violet-600 hover:bg-violet-700 text-white rounded-xl"
              >
                Está certo, próximo →
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 4 ── */}
        {step === 4 && sa && (
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm space-y-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-violet-600 mb-1">
                Passo 4 de 5
              </p>
              <h2 className="text-lg font-semibold tracking-tight">Nome e permissões</h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                Quase pronto. Dê um nome e configure rastreamento de custo se quiser.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="conn-name">Nome da conexão</Label>
              <Input
                id="conn-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Meu projeto Firebase"
              />
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Como vai aparecer na lista de conexões.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="billing">Billing Account ID (opcional)</Label>
              <Input
                id="billing"
                value={billingId}
                onChange={(e) => setBillingId(e.target.value)}
                placeholder="XXXXXX-XXXXXX-XXXXXX"
                className="font-mono"
              />
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Encontrado no GCP → Faturamento. Deixe vazio se não tiver agora — não bloqueia
                nada.
              </p>
            </div>

            <details className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 group">
              <summary className="cursor-pointer text-sm font-medium text-zinc-700 dark:text-zinc-300 px-4 py-3 select-none list-none flex items-center justify-between">
                <span>Habilitar rastreamento de custo (opcional)</span>
                <span className="text-zinc-400 text-xs group-open:hidden">▸ expandir</span>
                <span className="text-zinc-400 text-xs hidden group-open:inline">▾ recolher</span>
              </summary>
              <div className="px-4 pb-4 pt-3 space-y-4 text-sm text-zinc-700 dark:text-zinc-300 border-t border-zinc-200 dark:border-zinc-800">
                {/* What it is + skippable */}
                <div className="rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3 space-y-1.5">
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    <strong>O que é:</strong> faz o Nexus mostrar <strong>quanto este projeto gasta</strong> por mês.
                    É <strong>opcional</strong> — pode pular clicando <em>Próximo</em>; o app monitora todo o resto
                    (recursos, health, uptime) e o custo fica como “configurar custo” pra ligar depois.
                  </p>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    Pra ligar, rode o <code className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded font-mono text-[11px]">gcloud</code> abaixo
                    (dá ao service account permissão de ler o custo).{' '}
                    <strong>Simples</strong>: deixe a caixa desmarcada (Cloud Monitoring).{' '}
                    <strong>Detalhado</strong>: marque BigQuery (custo por serviço, mas exige o billing export ligado).
                  </p>
                </div>

                {/* BigQuery toggle */}
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useBigQuery}
                    onChange={(e) => setUseBigQuery(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-zinc-300 dark:border-zinc-700 text-violet-600"
                  />
                  <div>
                    <span className="font-medium text-zinc-800 dark:text-zinc-200">Usar BigQuery export (recomendado)</span>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                      Mais preciso, breakdown por serviço (Firestore, Functions, Hosting…). Requer billing export habilitado no BigQuery.
                    </p>
                  </div>
                </label>

                {useBigQuery && (
                  <div className="ml-7 space-y-3">
                    <div className="space-y-1">
                      <Label htmlFor="bq-project">BigQuery Project</Label>
                      <Input
                        id="bq-project"
                        value={bqProject}
                        onChange={(e) => setBqProject(e.target.value)}
                        placeholder={sa.project_id}
                        className="font-mono text-sm"
                      />
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">Padrão: mesmo do projeto Firebase.</p>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="bq-dataset">BigQuery Dataset</Label>
                      <Input
                        id="bq-dataset"
                        value={bqDataset}
                        onChange={(e) => setBqDataset(e.target.value)}
                        placeholder="billing_export"
                        className="font-mono text-sm"
                      />
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">Nome do dataset onde o billing export foi configurado.</p>
                    </div>
                  </div>
                )}

                {/* IAM command */}
                <div className="space-y-2">
                  <p>
                    {useBigQuery
                      ? 'Adicione os papéis abaixo ao service account:'
                      : <>O service account precisa do papel{' '}
                          <code className="bg-white dark:bg-zinc-900 text-xs px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-800 font-mono">
                            Monitoring Viewer
                          </code>{' '}no projeto.</>
                    }
                  </p>
                  <div className="relative">
                    <pre className="bg-zinc-900 text-zinc-100 text-xs rounded-md p-3 overflow-x-auto whitespace-pre-wrap break-all">
                      {useBigQuery
                        ? `gcloud projects add-iam-policy-binding ${sa.project_id} \\\n  --member="serviceAccount:${sa.client_email}" \\\n  --role="roles/bigquery.dataViewer"\n\ngcloud projects add-iam-policy-binding ${sa.project_id} \\\n  --member="serviceAccount:${sa.client_email}" \\\n  --role="roles/bigquery.jobUser"`
                        : `gcloud projects add-iam-policy-binding ${sa.project_id} \\\n  --member="serviceAccount:${sa.client_email}" \\\n  --role="roles/monitoring.viewer"`
                      }
                    </pre>
                    <button
                      onClick={copyIamCommand}
                      className="absolute top-2 right-2 text-zinc-400 hover:text-white transition-colors flex items-center gap-1"
                      title="Copiar comando"
                    >
                      {iamCopied ? (
                        <span className="text-xs text-green-400">copiado!</span>
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {useBigQuery
                    ? 'Dados aparecem em até 24h após habilitar o export. Setup no Cloud Billing Console → Billing export → BigQuery export.'
                    : 'Você também precisa habilitar o billing export → Cloud Monitoring na conta de billing.'
                  }
                </p>
              </div>
            </details>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(3)}>
                ← Voltar
              </Button>
              <Button
                onClick={() => setStep(5)}
                disabled={!name.trim()}
                className="bg-violet-600 hover:bg-violet-700 text-white rounded-xl"
              >
                Próximo →
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 5 ── */}
        {step === 5 && sa && (
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm space-y-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-violet-600 mb-1">
                Passo 5 de 5
              </p>
              <h2 className="text-lg font-semibold tracking-tight">Salvar e sincronizar</h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                Tudo pronto. Vamos validar as credenciais e descobrir os recursos automaticamente.
              </p>
            </div>

            <dl className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-4 space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500 dark:text-zinc-400 shrink-0">Nome</dt>
                <dd className="text-zinc-900 dark:text-zinc-100 font-medium text-right">{name}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500 dark:text-zinc-400 shrink-0">Projeto Firebase</dt>
                <dd className="text-zinc-900 dark:text-zinc-100 font-mono text-right">{sa.project_id}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500 dark:text-zinc-400 shrink-0">Service account</dt>
                <dd className="text-zinc-900 dark:text-zinc-100 font-mono text-right break-all text-xs">
                  {sa.client_email}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500 dark:text-zinc-400 shrink-0">Aplicativo</dt>
                <dd className="text-zinc-900 dark:text-zinc-100 text-right">{workspaceName}</dd>
              </div>
              {billingId && (
                <div className="flex justify-between gap-4">
                  <dt className="text-zinc-500 dark:text-zinc-400 shrink-0">Billing ID</dt>
                  <dd className="text-zinc-900 dark:text-zinc-100 font-mono text-right">{billingId}</dd>
                </div>
              )}
              {useBigQuery && bqDataset && (
                <>
                  <div className="flex justify-between gap-4">
                    <dt className="text-zinc-500 dark:text-zinc-400 shrink-0">BigQuery Dataset</dt>
                    <dd className="text-zinc-900 dark:text-zinc-100 font-mono text-right">{bqDataset}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-zinc-500 dark:text-zinc-400 shrink-0">BigQuery Project</dt>
                    <dd className="text-zinc-900 dark:text-zinc-100 font-mono text-right">{bqProject || sa.project_id}</dd>
                  </div>
                </>
              )}
            </dl>

            {syncStatus && (
              <div className="flex items-center gap-2 rounded-md bg-violet-50 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-900 p-3 text-sm text-violet-900 dark:text-violet-200">
                <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                {syncStatus}
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2 rounded-md bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 p-3 text-sm text-red-800 dark:text-red-200">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <div className="whitespace-pre-wrap">{error}</div>
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(4)} disabled={busy}>
                ← Voltar
              </Button>
              <Button
                onClick={save}
                disabled={busy}
                className="bg-violet-600 hover:bg-violet-700 text-white rounded-xl"
              >
                {busy ? 'Trabalhando…' : 'Salvar e sincronizar'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
