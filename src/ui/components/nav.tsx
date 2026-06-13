'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, LayoutGrid, AlertTriangle, TrendingUp, History, Activity, Bell, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

const mainItems = [
  { href: '/',           label: 'Visão geral', Icon: Home },
  { href: '/workspaces', label: 'Aplicativos', Icon: LayoutGrid },
  { href: '/cost',       label: 'Custo',       Icon: TrendingUp },
  { href: '/incidents',  label: 'Incidentes',  Icon: AlertTriangle },
  { href: '/uptime',     label: 'Uptime',      Icon: Activity },
] as const;

const settingsItems = [
  { href: '/settings/channels', label: 'Notificações',  Icon: Bell },
  { href: '/settings/ai',       label: 'IA',            Icon: Sparkles },
  { href: '/settings/audit',    label: 'Auditoria',     Icon: History },
] as const;

type NavItemProps = { href: string; label: string; Icon: React.ElementType; active: boolean };

function NavItem({ href, label, Icon, active }: NavItemProps) {
  return (
    <Link
      href={href as never}
      title={label}
      className={cn(
        'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
        active
          ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-medium'
          : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100',
      )}
    >
      <Icon
        className={cn(
          'h-4 w-4 shrink-0',
          active ? 'text-violet-600 dark:text-violet-400' : 'text-zinc-400 dark:text-zinc-500',
        )}
      />
      <span>{label}</span>
    </Link>
  );
}

export function Nav() {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  }

  return (
    <nav className="flex flex-col gap-0.5">
      {mainItems.map(({ href, label, Icon }) => (
        <NavItem key={href} href={href} label={label} Icon={Icon} active={isActive(href)} />
      ))}
      <div className="my-2 border-t border-zinc-100 dark:border-zinc-800" />
      {settingsItems.map(({ href, label, Icon }) => (
        <NavItem key={href} href={href} label={label} Icon={Icon} active={isActive(href)} />
      ))}
    </nav>
  );
}
