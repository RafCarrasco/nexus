import Link from 'next/link';
import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';

const accentMap = {
  default: 'text-zinc-900',
  danger: 'text-red-600',
  warning: 'text-amber-600',
} as const;

const cardClass =
  'block rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-violet-300 hover:shadow';

interface StatCardProps {
  label: string;
  value: ReactNode;
  href?: string;
  trend?: number[];
  accent?: keyof typeof accentMap;
}

export function StatCard({
  label,
  value,
  href,
  trend,
  accent = 'default',
}: StatCardProps) {
  const valueClass = accentMap[accent];

  const inner = (
    <>
      <div className="flex items-start justify-between">
        <div className="text-sm font-medium text-zinc-600">{label}</div>
        {href && <ChevronRight className="h-4 w-4 text-zinc-400" />}
      </div>
      <div className={`mt-3 text-3xl font-semibold tracking-tight ${valueClass}`}>{value}</div>
      {trend && trend.length > 1 && <Sparkline values={trend} />}
    </>
  );

  if (href) {
    return (
      <Link href={href as never} className={cardClass}>
        {inner}
      </Link>
    );
  }

  return <div className={cardClass}>{inner}</div>;
}

function Sparkline({ values }: { values: number[] }) {
  const w = 120;
  const h = 28;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = w / Math.max(values.length - 1, 1);
  const pts = values.map((v, i) => `${i * step},${h - ((v - min) / range) * h}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-3 h-7 w-full overflow-visible">
      <polyline fill="none" stroke="#7C3AED" strokeWidth="1.5" points={pts} />
    </svg>
  );
}
