import NextAuth from 'next-auth';
import MicrosoftEntraID from 'next-auth/providers/microsoft-entra-id';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from '@/db/client';
import { isAllowedEmail } from '@/auth/utils';
import { e2eSession } from './e2e-bypass';

export { isAllowedEmail };

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    MicrosoftEntraID({
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID!,
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET!,
      issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER,
    }),
  ],
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
