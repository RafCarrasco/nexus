import { AuthError } from 'next-auth';
import { redirect } from 'next/navigation';
import { signIn } from '@/auth/config';
import { allowedDomains } from '@/auth/utils';
import { Button } from '@/ui/components/button';
import { Input } from '@/ui/components/input';
import { Label } from '@/ui/components/label';

// Force runtime rendering so process.env is read per-request from the
// running container, not baked at build time.
export const dynamic = 'force-dynamic';

function NexusMark() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" className="text-violet-600" aria-hidden>
      <circle cx="11" cy="16" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="21" cy="16" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="16" cy="16" r="3" fill="currentColor" />
    </svg>
  );
}

function MicrosoftLogo() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <rect x="0" y="0" width="7" height="7" fill="#F25022" />
      <rect x="9" y="0" width="7" height="7" fill="#7FBA00" />
      <rect x="0" y="9" width="7" height="7" fill="#00A4EF" />
      <rect x="9" y="9" width="7" height="7" fill="#FFB900" />
    </svg>
  );
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  // Evaluated per-request thanks to `export const dynamic = 'force-dynamic'`.
  const { error } = await searchParams;
  const devLoginEnabled = process.env.NEXUS_DEV_LOGIN === '1';
  const requireDevPassword = !!process.env.NEXUS_DEV_PASSWORD;
  const domains = allowedDomains();
  const domain = domains[0];
  const domainsText = domains.join(' ou ');
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 shadow-sm space-y-6">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <NexusMark />
            <div>
              <div className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">Nexus</div>
              <div className="text-sm text-zinc-500 dark:text-zinc-400">Plataforma interna de observabilidade</div>
            </div>
          </div>

          {devLoginEnabled ? (
            /* Dev login — only when NEXUS_DEV_LOGIN=1 */
            <form
              action={async (formData: FormData) => {
                'use server';
                try {
                  await signIn('dev-email', {
                    email: String(formData.get('email') ?? ''),
                    password: String(formData.get('password') ?? ''),
                    redirectTo: '/',
                  });
                } catch (e) {
                  // A failed sign-in throws AuthError — show a message instead of
                  // crashing the page. Re-throw NEXT_REDIRECT (the success redirect).
                  if (e instanceof AuthError) redirect('/login?error=1');
                  throw e;
                }
              }}
              className="space-y-4"
            >
              {error && (
                <p className="rounded-lg border border-rose-200/60 bg-rose-50/60 p-3 text-xs text-rose-700">
                  Email ou senha inválidos. Use seu email PG (@{domainsText.replace(/ ou /g, ' ou @')}) autorizado.
                </p>
              )}
              <div className="space-y-1">
                <Label htmlFor="email">Email corporativo</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  placeholder={`you@${domain}`}
                  className="border-zinc-200 rounded-md focus:border-violet-500 focus:ring-2 focus:ring-violet-100 focus:ring-offset-0"
                />
              </div>
              {requireDevPassword && (
                <div className="space-y-1">
                  <Label htmlFor="password">Senha temporária</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    required
                    placeholder="••••••••"
                    className="border-zinc-200 rounded-md focus:border-violet-500 focus:ring-2 focus:ring-violet-100 focus:ring-offset-0"
                  />
                </div>
              )}
              <Button
                type="submit"
                className="w-full bg-violet-600 hover:bg-violet-700 text-white rounded-xl py-2.5 font-medium"
              >
                Entrar com email
              </Button>
              <p className="text-xs text-amber-700 bg-amber-50/60 border border-amber-200/60 rounded-lg p-3">
                Acesso temporário enquanto o app do Microsoft Entra ID está sendo registrado.
              </p>
            </form>
          ) : (
            /* Production — Microsoft Entra ID only */
            <form
              action={async () => {
                'use server';
                await signIn('microsoft-entra-id', { redirectTo: '/' });
              }}
            >
              <Button type="submit" className="w-full gap-2">
                <MicrosoftLogo />
                Continuar com Microsoft
              </Button>
              <p className="mt-3 text-center text-xs text-zinc-400 dark:text-zinc-500">
                Acesso restrito à PG · {domainsText}
              </p>
            </form>
          )}
        </div>

        <p className="mt-6 text-xs text-zinc-400 dark:text-zinc-500 text-center">
          © 2026 Procurement Garage · Nexus
        </p>
      </div>
    </main>
  );
}
