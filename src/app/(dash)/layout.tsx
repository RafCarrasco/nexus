import type { ReactNode } from 'react';
import Link from 'next/link';
import { Nav } from '@/ui/components/nav';
import { Breadcrumb } from '@/ui/components/breadcrumb';
import { auth, signOut } from '@/auth/config';
import { ChatWidget } from '@/ui/components/chat-widget';

function NexusMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 32 32" className="text-violet-600 shrink-0" aria-hidden>
      <circle cx="11" cy="16" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="21" cy="16" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="16" cy="16" r="3" fill="currentColor" />
    </svg>
  );
}

export default async function DashLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  const email = session?.user?.email ?? '';

  return (
    <div className="flex min-h-screen bg-zinc-50">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 bg-white border-r border-zinc-200 flex flex-col px-3 py-5">
        {/* Logo */}
        <div className="flex items-center gap-2 px-3 mb-6">
          <NexusMark />
          <span className="font-semibold text-sm text-zinc-900">Nexus</span>
        </div>

        {/* Navigation */}
        <Nav />

        {/* User footer */}
        <div className="mt-auto pt-4 border-t border-zinc-100 px-3">
          <div className="text-xs text-zinc-500 truncate mb-1">{email}</div>
          <Link
            href={'/docs/cost-tracking' as never}
            className="text-xs text-violet-600 hover:underline block mb-2"
          >
            Sobre rastreamento de custo
          </Link>
          <form
            action={async () => {
              'use server';
              await signOut({ redirectTo: '/login' });
            }}
          >
            <button
              type="submit"
              className="text-xs text-zinc-500 hover:text-zinc-900 underline underline-offset-2 transition-colors"
            >
              Sair
            </button>
          </form>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top breadcrumb bar */}
        <div className="border-b border-zinc-200 bg-white px-8 py-3">
          <Breadcrumb />
        </div>

        {/* Page content */}
        <main className="flex-1 p-8">
          {children}
        </main>
      </div>

      <ChatWidget />
    </div>
  );
}
