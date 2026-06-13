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
  // In the compact card (sm) show just the info icon + native tooltip on hover.
  const iconOnly = size === 'sm';

  if (notSupported && amount === 0) {
    const title = 'Este provedor não expõe custo via API pública';
    return iconOnly ? (
      <span className="inline-flex text-zinc-400" title={title} aria-label="Custo não disponível">
        <Info className="h-4 w-4" />
      </span>
    ) : (
      <span
        className={`inline-flex items-center gap-1 whitespace-nowrap ${emptyText} text-zinc-400`}
        title={title}
      >
        <Info className="h-3 w-3 shrink-0" />
        não disponível
      </span>
    );
  }

  if (notConfigured && amount === 0) {
    const title = 'Custo ainda não configurado — clique para configurar';
    return iconOnly ? (
      <Link
        href={'/docs/cost-tracking' as never}
        className="inline-flex text-violet-600 hover:text-violet-700"
        title={title}
        aria-label="Configurar custo"
      >
        <Info className="h-4 w-4" />
      </Link>
    ) : (
      <Link
        href={'/docs/cost-tracking' as never}
        className={`inline-flex items-center gap-1 whitespace-nowrap ${emptyText} text-violet-600 hover:underline`}
        title={title}
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
