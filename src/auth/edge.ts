/**
 * Edge-compatible auth — no Node-only modules (PrismaAdapter / @prisma/client).
 * Used ONLY by middleware.ts which runs in the Edge runtime.
 */
import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';

export const { auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  callbacks: {
    authorized: () => true, // route-level guard done in middleware manually
  },
});
