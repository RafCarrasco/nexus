import { signIn } from '@/auth/config';

const devLoginEnabled = process.env.NEXUS_DEV_LOGIN === '1';

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="rounded-2xl border bg-white p-8 shadow-sm w-full max-w-sm space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Nexus</h1>
          <p className="text-sm text-zinc-500">Sign in with your Procurement Garage account.</p>
        </div>

        <form
          action={async () => {
            'use server';
            await signIn('microsoft-entra-id', { redirectTo: '/' });
          }}
        >
          <button
            type="submit"
            className="w-full rounded-xl bg-zinc-900 px-4 py-2 text-white hover:bg-zinc-700"
          >
            Continue with Microsoft
          </button>
        </form>

        {devLoginEnabled && (
          <>
            <div className="text-xs text-zinc-400 text-center">— or —</div>
            <form
              action={async (formData: FormData) => {
                'use server';
                await signIn('dev-email', {
                  email: String(formData.get('email') ?? ''),
                  redirectTo: '/',
                });
              }}
              className="space-y-3"
            >
              <input
                type="email"
                name="email"
                required
                placeholder="you@procurementgarage.com"
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
              <button
                type="submit"
                className="w-full rounded-xl border border-zinc-900 px-4 py-2 text-zinc-900 hover:bg-zinc-100 text-sm"
              >
                Sign in (dev)
              </button>
              <p className="text-xs text-amber-700">
                Temporary dev login — replace with SSO after Azure AD app is registered.
              </p>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
