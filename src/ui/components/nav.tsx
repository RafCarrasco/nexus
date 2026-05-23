import Link from 'next/link';
import { Home, Plug, Boxes, AlertTriangle, Settings } from 'lucide-react';

const items = [
  { href: '/',             label: 'Overview',    Icon: Home },
  { href: '/connections',  label: 'Connections', Icon: Plug },
  { href: '/resources',    label: 'Resources',   Icon: Boxes },
  { href: '/incidents',    label: 'Incidents',   Icon: AlertTriangle },
  { href: '/settings/clients', label: 'Settings', Icon: Settings },
] as const;

export function Nav() {
  return (
    <nav className="flex flex-col gap-1 p-4">
      {items.map(({ href, label, Icon }) => (
        <Link
          key={href}
          href={href as never}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100"
        >
          <Icon className="h-4 w-4" />
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}
