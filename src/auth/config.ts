import NextAuth from 'next-auth';
import MicrosoftEntraID from 'next-auth/providers/microsoft-entra-id';
import Credentials from 'next-auth/providers/credentials';
import type { Provider } from '@auth/core/providers';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from '@/db/client';
import { isAllowedEmail, isDevAllowedEmail, checkDevPassword } from '@/auth/utils';
import { e2eSession } from './e2e-bypass';

export { isAllowedEmail };

const providers: Provider[] = [
  MicrosoftEntraID({
    clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID!,
    clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET!,
    issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER,
    // Link the Microsoft sign-in to a pre-existing user with the same email
    // (e.g. one created earlier via the dev login) instead of erroring with
    // OAuthAccountNotLinked. Safe here: the only OAuth provider is PG's own
    // single-tenant Entra (trusted, verified corporate emails) and signIn is
    // already domain-restricted to PG via isAllowedEmail.
    allowDangerousEmailAccountLinking: true,
  }),
];

if (process.env.NEXUS_DEV_LOGIN === '1') {
  providers.push(
    Credentials({
      id: 'dev-email',
      name: 'Dev email',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(creds) {
        const email = String(creds?.email ?? '').toLowerCase().trim();
        if (!email) return null;
        if (!isDevAllowedEmail(email)) return null;
        if (!checkDevPassword(creds?.password as string | undefined)) return null;
        const user = await prisma.user.upsert({
          where: { email },
          create: { email, name: email.split('@')[0], role: 'member' },
          update: {},
        });
        return { id: user.id, email: user.email, name: user.name ?? null };
      },
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers,
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  callbacks: {
    async signIn({ user }) {
      if (!isAllowedEmail(user.email)) return false;
      return true;
    },
    async jwt({ token, user }) {
      if (user?.email) {
        const dbUser = await prisma.user.upsert({
          where: { email: user.email },
          create: { email: user.email, name: user.name ?? null, image: user.image ?? null, role: 'member' },
          update: { name: user.name ?? null, image: user.image ?? null },
        });
        if (dbUser.role !== 'admin') {
          const total = await prisma.user.count();
          if (total === 1) {
            await prisma.user.update({ where: { id: dbUser.id }, data: { role: 'admin' } });
            token.role = 'admin';
          } else {
            token.role = dbUser.role;
          }
        } else {
          token.role = 'admin';
        }
        token.uid = dbUser.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.uid as string;
        (session.user as { role?: string }).role = token.role as string;
      }
      return session;
    },
  },
});

/**
 * For API routes that may run under Playwright. Returns the bypass admin
 * session when NEXUS_E2E=1 and the request carries the bypass header.
 */
export async function authOrE2E(req?: Request) {
  if (req) {
    const e2e = e2eSession(req);
    if (e2e) return e2e;
  }
  return auth();
}
