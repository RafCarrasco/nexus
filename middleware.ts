import { auth } from '@/auth/edge';

export default auth((req) => {
  const isAuth = !!req.auth;
  const url = req.nextUrl;
  const isPublic =
    url.pathname.startsWith('/login') || url.pathname.startsWith('/api/auth');
  if (!isAuth && !isPublic) {
    const dest = new URL('/login', url);
    dest.searchParams.set('callbackUrl', url.pathname + url.search);
    return Response.redirect(dest);
  }
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
