'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight } from 'lucide-react';

const LABELS: Record<string, string> = {
  connections: 'Connections',
  resources: 'Resources',
  incidents: 'Incidents',
  settings: 'Settings',
  clients: 'Clients',
  allocations: 'Allocations',
  new: 'New',
};

function segmentLabel(seg: string): string {
  return LABELS[seg] ?? seg.charAt(0).toUpperCase() + seg.slice(1);
}

export function Breadcrumb() {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);

  const crumbs: { label: string; href: string }[] = [
    { label: 'Nexus', href: '/' },
  ];

  let accumulated = '';
  for (const seg of segments) {
    accumulated += `/${seg}`;
    crumbs.push({ label: segmentLabel(seg), href: accumulated });
  }

  if (crumbs.length === 1) {
    crumbs.push({ label: 'Overview', href: '/' });
  }

  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex items-center gap-1 text-xs text-zinc-500">
        {crumbs.map((crumb, i) => (
          <li key={`${crumb.href}-${i}`} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="h-3 w-3 text-zinc-400 shrink-0" />}
            {i < crumbs.length - 1 ? (
              <Link href={crumb.href as never} className="hover:text-zinc-900 transition-colors">
                {crumb.label}
              </Link>
            ) : (
              <span className="text-zinc-900 font-medium">{crumb.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
