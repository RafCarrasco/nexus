import type { ReactNode } from 'react';
import { Nav } from '@/ui/components/nav';
import { auth, signOut } from '@/auth/config';

export default async function DashLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  const email = session?.user?.email ?? '';
  return (
    <div className="grid min-h-screen grid-cols-[240px_1fr]">
      <aside className="border-r bg-white">
        <div className="px-4 py-5 text-base font-semibold">Nexus</div>
        <Nav />
        <form
          className="px-4 py-3 text-xs text-zinc-500"
          action={async () => {
            'use server';
            await signOut({ redirectTo: '/login' });
          }}
        >
          <div className="mb-2 truncate">{email}</div>
          <button type="submit" className="underline hover:text-zinc-900">Sign out</button>
        </form>
      </aside>
      <section className="flex flex-col">{children}</section>
    </div>
  );
}
