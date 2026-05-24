'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, LayoutGrid, Plug, Boxes, AlertTriangle, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

const items = [
  { href: '/',                   label: 'Visão geral',  Icon: Home },
  { href: '/workspaces',         label: 'Aplicativos',  Icon: LayoutGrid },
  { href: '/connections',        label: 'Conexões',     Icon: Plug },
  { href: '/resources',          label: 'Recursos',     Icon: Boxes },
  { href: '/incidents',          label: 'Incidentes',   Icon: AlertTriangle },
  { href: '/settings/clients',   label: 'Configurações', Icon: Settings },
] as const;

export function Nav() {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  }

  return (
    <nav className="flex flex-col gap-0.5">
      {items.map(({ href, label, Icon }) => {
        const active = isActive(href);
        return (
          <Link
            key={href}
            href={href as never}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
              active
                ? 'bg-zinc-100 text-zinc-900 font-medium'
                : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900',
            )}
          >
            <Icon
              className={cn(
                'h-4 w-4 shrink-0',
                active ? 'text-violet-600' : 'text-zinc-400',
              )}
            />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
