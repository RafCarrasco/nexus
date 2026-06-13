import { Database, HardDrive, ShieldCheck, Globe, Zap, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from './badge';

type ServiceKey = 'firestore' | 'storage' | 'rtdb' | 'auth' | 'hosting' | 'functions';

export type ServiceInventoryItem = {
  key: ServiceKey;
  label: string;
  enabled: boolean;
  headline?: string;
};

export type ProjectAuthConfig = {
  signInMethods?: string[];
  authorizedDomains?: string[];
  mfa?: string;
};

const ICONS: Record<ServiceKey, LucideIcon> = {
  firestore: Database,
  storage: HardDrive,
  rtdb: Database,
  auth: ShieldCheck,
  hosting: Globe,
  functions: Zap,
};

/**
 * "What this project uses" overview, rendered for firebase-project resources from
 * the serviceInventory captured at collection time. Presentational — no fetching.
 */
export function ServiceInventoryPanel({
  inventory,
  authConfig,
}: {
  inventory: ServiceInventoryItem[];
  authConfig?: ProjectAuthConfig | null;
}) {
  if (!inventory?.length) return null;

  const showAuth =
    authConfig && ((authConfig.signInMethods?.length ?? 0) > 0 || (authConfig.authorizedDomains?.length ?? 0) > 0);

  return (
    <section className="p-6">
      <h2 className="mb-3 text-lg font-semibold">Inventário do projeto</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {inventory.map((item) => {
          const Icon = ICONS[item.key] ?? Database;
          return (
            <div
              key={item.key}
              className={cn(
                'flex items-start gap-3 rounded-lg border dark:border-zinc-800 p-4',
                item.enabled ? 'bg-card' : 'bg-zinc-50 dark:bg-zinc-800 opacity-60',
              )}
            >
              <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', item.enabled ? 'text-violet-600' : 'text-zinc-400')} />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{item.label}</span>
                  <Badge variant={item.enabled ? 'active' : 'outline'}>{item.enabled ? 'em uso' : 'inativo'}</Badge>
                </div>
                {item.headline && <p className="mt-0.5 truncate text-sm text-zinc-500 dark:text-zinc-400">{item.headline}</p>}
              </div>
            </div>
          );
        })}
      </div>
      {showAuth && (
        <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
          Auth: {authConfig!.signInMethods?.join(', ') || '—'}
          {authConfig!.mfa ? ` · MFA ${authConfig!.mfa}` : ''}
          {authConfig!.authorizedDomains?.length ? ` · domínios: ${authConfig!.authorizedDomains.join(', ')}` : ''}
        </p>
      )}
    </section>
  );
}
