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

  const emptyText = size === 'lg' ? 'text-sm' : 'text-xs';

  if (notSupported && amount === 0) {
    return (
      <span
        className={`inline-flex items-center gap-1 whitespace-nowrap ${emptyText} text-zinc-400`}
        title="Este provedor não expõe custo via API pública"
      >
        <Info className="h-3 w-3 shrink-0" />
        não disponível
      </span>
    );
  }

  if (notConfigured && amount === 0) {
    return (
      <Link
        href={'/docs/cost-tracking' as never}
        className={`inline-flex items-center gap-1 whitespace-nowrap ${emptyText} text-violet-600 hover:underline`}
        title="Custo ainda não configurado — clique para ver como habilitar"
      >
        <Info className="h-3 w-3 shrink-0" />
        configurar custo
      </Link>
    );
  }

  return <span className={cls}>{formatMoney(amount, currency)}</span>;
}

/** Which providers expose cost via API (even if setup is needed). */
const COST_SUPPORTING_PROVIDERS = new Set(['firebase', 'supabase', 'fake']);

export function providerSupportsCost(type: string): boolean {
  return COST_SUPPORTING_PROVIDERS.has(type);
}
