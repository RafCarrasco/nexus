import { NextResponse, type NextRequest } from 'next/server';
import { e2eSession } from '@/auth/e2e-bypass';

/**
 * Edge gate for PAGE routes. The previous next-auth `auth()` middleware wrapper was observed
 * NOT redirecting unauthenticated requests in prod (pages rendered to anonymous clients), so
 * this is a plain, guaranteed-to-run middleware: anything that isn't an API route, the login
 * page, or a public status page requires a session cookie — otherwise it's redirected at the
 * edge BEFORE any page renders (so no data leaks in the body). The cookie is only a presence
 * check; the authoritative JWT validation still happens server-side in (dash)/layout.tsx and
 * the API guards, which reject forged/expired sessions.
 *
 * API routes self-authenticate (token for /api/ingest, session 401 for the rest, public
 * /api/health and /api/auth), so they are intentionally skipped here.
 */
function isPublicPath(pathname: string): boolean {
  return (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/status')
  );
}

function hasSessionCookie(req: NextRequest): boolean {
  // Auth.js session cookie: `authjs.session-token`, `__Secure-authjs.session-token`, and
  // chunked `.0/.1` variants on large JWTs. Match the stable substring to cover all forms.
  return req.cookies.getAll().some((c) => c.name.includes('authjs.session-token') && !!c.value);
}

export default function middleware(req: NextRequest) {
  const url = req.nextUrl;
  if (isPublicPath(url.pathname)) return NextResponse.next();
  if (e2eSession(req as unknown as Request)) return NextResponse.next();
  if (hasSessionCookie(req)) return NextResponse.next();

  const dest = new URL('/login', url);
  dest.searchParams.set('callbackUrl', url.pathname + url.search);
  return NextResponse.redirect(dest);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
