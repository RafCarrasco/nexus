import Link from 'next/link';
import { Info } from 'lucide-react';
import { formatMoney } from '@/lib/money';

type Props = {
  amount: number;
  currency?: string;
  /** When no CostSnapshot has ever been recorded for this scope. */
  notConfigured?: boolean;
  size?: 'sm' | 'md' | 'lg';
};

export function CostDisplay({ amount, currency = 'USD', notConfigured, size = 'md' }: Props) {
  const cls =
    size === 'lg'
      ? 'text-3xl font-semibold'
      : size === 'md'
        ? 'text-base font-semibold'
        : 'text-sm font-medium';

  if (notConfigured && amount === 0) {
    return (
      <div className="flex items-center gap-1.5">
        <span className={`${cls} text-zinc-400`}>—</span>
        <Link
          href={'/docs/cost-tracking' as never}
          className="text-xs text-violet-600 hover:underline inline-flex items-center gap-0.5"
          title="Custo não configurado — ver como habilitar"
        >
          <Info className="h-3 w-3" />
          não configurado
        </Link>
      </div>
    );
  }

  return <span className={cls}>{formatMoney(amount, currency)}</span>;
}
