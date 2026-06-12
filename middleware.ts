import { auth } from '@/auth/edge';
import { e2eSession } from '@/auth/e2e-bypass';

export default auth((req) => {
  if (e2eSession(req as unknown as Request)) return;
  const isAuth = !!req.auth;
  const url = req.nextUrl;
  const isPublic =
    url.pathname.startsWith('/login') ||
    url.pathname.startsWith('/api/auth') ||
    url.pathname.startsWith('/api/health');
  if (!isAuth && !isPublic) {
    const dest = new URL('/login', url);
    dest.searchParams.set('callbackUrl', url.pathname + url.search);
    return Response.redirect(dest);
  }
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
