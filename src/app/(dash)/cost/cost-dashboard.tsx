'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from 'recharts';
import { TrendingUp, TrendingDown, Minus, Info, ChevronRight } from 'lucide-react';
import { formatMoney } from '@/lib/money';
import { avatarColor } from '@/lib/avatar';

type Point = { workspaceId: string; workspaceName: string; date: string; amount: number; currency: string };
type Workspace = { id: string; name: string };
type Range = 30 | 90 | 180 | 365 | 0;
type Mode = 'stacked' | 'separated' | 'total';

const RANGE_LABELS: Record<number, string> = {
  30: '30 dias',
  90: '90 dias',
  180: '6 meses',
  365: '1 ano',
  0: 'Tudo',
};

const RANGES: Range[] = [30, 90, 180, 365, 0];

const MODE_LABELS: Record<Mode, string> = {
  stacked: 'Empilhado',
  separated: 'Separado',
  total: 'Total',
};

const MODES: Mode[] = ['stacked', 'separated', 'total'];

export function CostDashboard({
  points,
  workspaces,
  currency,
}: {
  points: Point[];
  workspaces: Workspace[];
  currency: string;
}) {
  const [range, setRange] = useState<Range>(90);
  const [mode, setMode] = useState<Mode>('stacked');

  const filtered = useMemo(() => {
    if (range === 0) return points;
    const cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() - range);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    return points.filter((p) => p.date >= cutoffStr);
  }, [points, range]);

  const series = useMemo(() => {
    const byDate = new Map<string, Record<string, number | string>>();
    for (const p of filtered) {
      const row = byDate.get(p.date) ?? { date: p.date };
      row[p.workspaceName] = (Number(row[p.workspaceName] ?? 0)) + p.amount;
      byDate.set(p.date, row);
    }
    const sorted = [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b));
    return sorted.map(([, row]) => row);
  }, [filtered]);

  const totalSeries = useMemo(() => {
    return series.map((row) => {
      const total = workspaces.reduce((s, w) => s + Number(row[w.name] ?? 0), 0);
      return { date: row.date, Total: total };
    });
  }, [series, workspaces]);

  const totalSpent = filtered.reduce((s, p) => s + p.amount, 0);
  const dayCount = new Set(filtered.map((p) => p.date)).size || 1;
  const avgDaily = totalSpent / dayCount;

  const peakDay = useMemo(() => {
    const byDay = new Map<string, number>();
    for (const p of filtered) byDay.set(p.date, (byDay.get(p.date) ?? 0) + p.amount);
    let best: { date: string; amount: number } | null = null;
    for (const [date, amount] of byDay) {
      if (!best || amount > best.amount) best = { date, amount };
    }
    return best;
  }, [filtered]);

  const topApp = useMemo(() => {
    const byApp = new Map<string, number>();
    for (const p of filtered) byApp.set(p.workspaceName, (byApp.get(p.workspaceName) ?? 0) + p.amount);
    let best: { name: string; amount: number } | null = null;
    for (const [name, amount] of byApp) {
      if (!best || amount > best.amount) best = { name, amount };
    }
    return best;
  }, [filtered]);

  const hasData = points.length > 0;

  if (!hasData) {
    return (
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-12 text-center space-y-3 shadow-sm">
        <Info className="h-10 w-10 text-zinc-300 dark:text-zinc-600 mx-auto" />
        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Sem dados de custo ainda</h3>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 max-w-md mx-auto">
          Para o gráfico aparecer, o billing export do Cloud Billing precisa estar habilitado pro
          Cloud Monitoring. É gratuito e leva 5 minutos.
        </p>
        <Link
          href={'/docs/cost-tracking' as never}
          className="inline-flex items-center gap-1 text-sm text-violet-600 dark:text-violet-400 hover:underline"
        >
          Como habilitar
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-1 shadow-sm">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                range === r
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'
              }`}
            >
              {RANGE_LABELS[r]}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 rounded-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-1 shadow-sm">
          {MODES.map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                mode === m
                  ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'
              }`}
            >
              {MODE_LABELS[m]}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm">
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={mode === 'total' ? totalSeries : series}
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            >
              <defs>
                {workspaces.map((w) => {
                  const color = avatarColor(w.name);
                  return (
                    <linearGradient key={w.id} id={`grad-${w.id}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={color} stopOpacity={0.55} />
                      <stop offset="100%" stopColor={color} stopOpacity={0.02} />
                    </linearGradient>
                  );
                })}
                <linearGradient id="grad-total" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#7C3AED" stopOpacity={0.55} />
                  <stop offset="100%" stopColor="#7C3AED" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E4E4E7" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: '#71717A' }}
                tickLine={false}
                axisLine={{ stroke: '#E4E4E7' }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#71717A' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => `$${v.toFixed(0)}`}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 8,
                  border: '1px solid #E4E4E7',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                  fontSize: 12,
                }}
                formatter={(value) => [formatMoney(Number(value ?? 0), currency), '']}
                labelStyle={{ color: '#52525B', fontSize: 11, marginBottom: 4 }}
              />
              {mode !== 'total' && (
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconType="circle" />
              )}
              {mode === 'total' && (
                <Area
                  type="monotone"
                  dataKey="Total"
                  stroke="#7C3AED"
                  strokeWidth={2}
                  fill="url(#grad-total)"
                  isAnimationActive
                  animationDuration={700}
                />
              )}
              {mode !== 'total' &&
                workspaces.map((w) => (
                  <Area
                    key={w.id}
                    type="monotone"
                    dataKey={w.name}
                    stroke={avatarColor(w.name)}
                    strokeWidth={2}
                    fill={`url(#grad-${w.id})`}
                    stackId={mode === 'stacked' ? '1' : undefined}
                    isAnimationActive
                    animationDuration={700}
                  />
                ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Total gasto" value={formatMoney(totalSpent, currency)} />
        <Kpi label="Média diária" value={formatMoney(avgDaily, currency)} />
        <Kpi
          label="Dia de pico"
          value={peakDay ? formatMoney(peakDay.amount, currency) : '—'}
          sub={peakDay?.date}
        />
        <Kpi
          label="Aplicativo top"
          value={topApp?.name ?? '—'}
          sub={topApp ? formatMoney(topApp.amount, currency) : undefined}
        />
      </div>

      {/* Per-workspace breakdown */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
        <div className="border-b border-zinc-100 dark:border-zinc-800 px-6 py-4">
          <h3 className="text-base font-semibold tracking-tight">Por aplicativo</h3>
        </div>
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {workspaces.map((w) => {
            const wPoints = filtered.filter((p) => p.workspaceId === w.id);
            const wTotal = wPoints.reduce((s, p) => s + p.amount, 0);
            const days = [...new Set(wPoints.map((p) => p.date))].sort();
            const half = Math.floor(days.length / 2);
            const cutDate = days[half] ?? '';
            const recent = wPoints
              .filter((p) => p.date >= cutDate)
              .reduce((s, p) => s + p.amount, 0);
            const older = wPoints
              .filter((p) => p.date < cutDate)
              .reduce((s, p) => s + p.amount, 0);
            const delta = older > 0 ? ((recent - older) / older) * 100 : 0;
            const color = avatarColor(w.name);

            const byDate = new Map<string, number>();
            for (const p of wPoints) byDate.set(p.date, (byDate.get(p.date) ?? 0) + p.amount);
            const sparkData = [...byDate.entries()]
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([, v]) => v);

            return (
              <li key={w.id} className="flex items-center gap-4 px-6 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800">
                <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                <Link
                  href={`/workspaces/${w.id}` as never}
                  className="flex-1 min-w-0 text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate hover:text-violet-600 dark:hover:text-violet-400"
                >
                  {w.name}
                </Link>
                <MiniSpark values={sparkData} color={color} />
                <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 w-24 text-right">
                  {formatMoney(wTotal, currency)}
                </div>
                <DeltaBadge value={delta} />
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-sm">
      <div className="text-sm text-zinc-500 dark:text-zinc-400">{label}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">{value}</div>
      {sub && <div className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">{sub}</div>}
    </div>
  );
}

function MiniSpark({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return <div className="h-6 w-24" />;
  const w = 96, h = 24;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = w / (values.length - 1);
  const pts = values.map((v, i) => `${i * step},${h - ((v - min) / range) * h}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-6 w-24 shrink-0">
      <polyline fill="none" stroke={color} strokeWidth="1.5" points={pts} />
    </svg>
  );
}

function DeltaBadge({ value }: { value: number }) {
  if (Math.abs(value) < 0.5) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400 w-16 shrink-0">
        <Minus className="h-3 w-3" /> ~0%
      </span>
    );
  }
  if (value > 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-red-600 w-16 shrink-0">
        <TrendingUp className="h-3 w-3" /> +{value.toFixed(0)}%
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-emerald-600 w-16 shrink-0">
      <TrendingDown className="h-3 w-3" /> {value.toFixed(0)}%
    </span>
  );
}
