import { signIn } from '@/auth/config';
import { Button } from '@/ui/components/button';
import { Input } from '@/ui/components/input';
import { Label } from '@/ui/components/label';

const devLoginEnabled = process.env.NEXUS_DEV_LOGIN === '1';
const requireDevPassword = !!process.env.NEXUS_DEV_PASSWORD;

function NexusMark() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" className="text-zinc-900">
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

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-zinc-50 via-white to-zinc-100 px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-xl space-y-6">
          <div className="flex items-center gap-3">
            <NexusMark />
            <div>
              <div className="text-2xl font-semibold tracking-tight">Nexus</div>
              <div className="text-sm text-zinc-500">Internal observability for Procurement Garage.</div>
            </div>
          </div>

          <form
            action={async () => {
              'use server';
              await signIn('microsoft-entra-id', { redirectTo: '/' });
            }}
          >
            <Button type="submit" className="w-full gap-2">
              <MicrosoftLogo />
              Continue with Microsoft
            </Button>
          </form>

          {devLoginEnabled && (
            <>
              <div className="flex items-center gap-3">
                <div className="flex-1 border-t border-zinc-200" />
                <span className="text-xs uppercase tracking-wider text-zinc-400">or</span>
                <div className="flex-1 border-t border-zinc-200" />
              </div>

              <form
                action={async (formData: FormData) => {
                  'use server';
                  await signIn('dev-email', {
                    email: String(formData.get('email') ?? ''),
                    password: String(formData.get('password') ?? ''),
                    redirectTo: '/',
                  });
                }}
                className="space-y-3"
              >
                <div className="space-y-1">
                  <Label htmlFor="email">Work email</Label>
                  <Input id="email" name="email" type="email" required placeholder="you@pgconsulting-group.com" />
                </div>
                {requireDevPassword && (
                  <div className="space-y-1">
                    <Label htmlFor="password">Temporary password</Label>
                    <Input id="password" name="password" type="password" required placeholder="••••••••" />
                  </div>
                )}
                <Button type="submit" variant="outline" className="w-full">
                  Sign in with email
                </Button>
                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md p-2">
                  Temporary access while the Microsoft Entra ID app registration is pending.
                </p>
              </form>
            </>
          )}
        </div>
        <p className="text-xs text-zinc-400 text-center">© 2026 Procurement Garage</p>
      </div>
    </main>
  );
}
