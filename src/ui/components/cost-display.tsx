import Link from 'next/link';
import { Info } from 'lucide-react';
import { formatMoney } from '@/lib/money';

type Props = {
  amount: number;
  currency?: string;
  /** No CostSnapshot recorded yet (provider supports cost, setup pending). */
  notConfigured?: boolean;
  /** Provider does not expose cost via API at all. */
  notSupported?: boolean;
  size?: 'sm' | 'md' | 'lg';
};

export function CostDisplay({
  amount,
  currency = 'USD',
  notConfigured,
  notSupported,
  size = 'md',
}: Props) {
  const cls =
    size === 'lg'
      ? 'text-3xl font-semibold'
      : size === 'md'
        ? 'text-base font-semibold'
        : 'text-sm font-medium';

  if (notSupported && amount === 0) {
    return (
      <div className="flex items-center gap-1.5">
        <span className={`${cls} text-zinc-400`}>—</span>
        <span
          className="text-xs text-zinc-400 inline-flex items-center gap-0.5"
          title="Este provedor não expõe custo via API pública"
        >
          <Info className="h-3 w-3" />
          não disponível
        </span>
      </div>
    );
  }

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

/** Which providers expose cost via API (even if setup is needed). */
const COST_SUPPORTING_PROVIDERS = new Set(['firebase', 'supabase', 'fake']);

export function providerSupportsCost(type: string): boolean {
  return COST_SUPPORTING_PROVIDERS.has(type);
}
