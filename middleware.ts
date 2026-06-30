import { auth } from '@/auth/edge';
import { e2eSession } from '@/auth/e2e-bypass';

export default auth((req) => {
  if (e2eSession(req as unknown as Request)) return;
  const isAuth = !!req.auth;
  const url = req.nextUrl;
  const isPublic =
    url.pathname.startsWith('/login') ||
    url.pathname.startsWith('/api/auth') ||
    // Ingest endpoints authenticate by their own bearer/URL token in the handler — the
    // session middleware must let them through, else token POSTs 307 to /login and webhook
    // senders (Sentry, n8n) just see a redirect. Covers /api/ingest and /api/ingest/sentry.
    url.pathname.startsWith('/api/ingest') ||
    // Public per-workspace status pages (no login) for client-facing status.
    url.pathname.startsWith('/status') ||
    // Exact match, not prefix: a future /api/health-* route must not inherit public access.
    url.pathname === '/api/health';
  if (!isAuth && !isPublic) {
    const dest = new URL('/login', url);
    dest.searchParams.set('callbackUrl', url.pathname + url.search);
    return Response.redirect(dest);
  }
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
