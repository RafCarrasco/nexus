import type { ReactNode } from 'react';
import Link from 'next/link';
import { Nav } from '@/ui/components/nav';
import { Breadcrumb } from '@/ui/components/breadcrumb';
import { auth, signOut } from '@/auth/config';
import { ChatWidget } from '@/ui/components/chat-widget';
import { CommandPalette } from '@/ui/components/command-palette';
import { PaletteHint } from '@/ui/components/palette-hint';
import { ThemeProvider } from '@/ui/components/theme-provider';
import { ThemeToggle } from '@/ui/components/theme-toggle';
import { ToastProvider } from '@/ui/components/toast';

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
    <ThemeProvider>
      <ToastProvider>
      <div className="flex min-h-screen bg-zinc-50 dark:bg-zinc-950">
        {/* Sidebar */}
        <aside className="w-60 shrink-0 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 flex flex-col px-3 py-5">
          {/* Logo */}
          <div className="flex items-center gap-2 px-3 mb-6">
            <NexusMark />
            <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">Nexus</span>
          </div>

          {/* Navigation */}
          <Nav />

          {/* Divider between main nav and settings */}
          <div className="my-2 border-t border-zinc-100 dark:border-zinc-800" />

          {/* User footer */}
          <div className="mt-auto pt-4 border-t border-zinc-100 dark:border-zinc-800 px-3">
            <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate mb-1">{email}</div>
            <Link
              href={'/docs/cost-tracking' as never}
              className="text-xs text-violet-600 dark:text-violet-400 hover:underline block mb-2"
            >
              Sobre rastreamento de custo
            </Link>
            <div className="mb-2">
              <ThemeToggle />
            </div>
            <form
              action={async () => {
                'use server';
                await signOut({ redirectTo: '/login' });
              }}
            >
              <button
                type="submit"
                className="text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 underline underline-offset-2 transition-colors"
              >
                Sair
              </button>
            </form>
          </div>
        </aside>

        {/* Main column */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top breadcrumb bar */}
          <div className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-8 py-3 flex items-center justify-between">
            <Breadcrumb />
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-xs text-zinc-500">
                <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" title="Sistema online" />
                Online
              </span>
              <PaletteHint />
            </div>
          </div>

          {/* Page content */}
          <main className="flex-1 p-8">{children}</main>
        </div>

        <ChatWidget />
        <CommandPalette />
      </div>
      </ToastProvider>
    </ThemeProvider>
  );
}
