import { signIn } from '@/auth/config';

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center">
      <form
        action={async () => {
          'use server';
          await signIn('microsoft-entra-id', { redirectTo: '/' });
        }}
        className="rounded-2xl border bg-white p-8 shadow-sm w-full max-w-sm space-y-4"
      >
        <h1 className="text-2xl font-semibold">Nexus</h1>
        <p className="text-sm text-zinc-500">Sign in with your Procurement Garage account.</p>
        <button
          type="submit"
          className="w-full rounded-xl bg-zinc-900 px-4 py-2 text-white hover:bg-zinc-700"
        >
          Continue with Microsoft
        </button>
      </form>
    </main>
  );
}
