import { NextResponse } from 'next/server';
import { auth, authOrE2E } from '@/auth/config';

/** Shape of the role-bearing session user we cast to across guards. */
export type SessionUser = { id?: string; role?: string };

/** Writer = anyone allowed to mutate non-admin resources. */
const WRITER_ROLES = ['admin', 'member'] as const;

/** Minimal session shape we read from — avoids NextAuth's overloaded `auth` type. */
type AuthSession = { user?: unknown } | null;

function sessionUser(session: AuthSession): SessionUser | undefined {
  return session?.user as SessionUser | undefined;
}

// --- Server-action guards -------------------------------------------------
// These throw 'forbidden'; the action runtime surfaces it as an error. Use
// inside `'use server'` action files only (they call auth() with no request).

/** admin|member. Throws 'forbidden' otherwise. */
export async function requireWriter(): Promise<SessionUser> {
  const user = sessionUser(await auth());
  if (user?.role !== 'admin' && user?.role !== 'member') throw new Error('forbidden');
  return user;
}

/** admin only. Throws 'forbidden' otherwise. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = sessionUser(await auth());
  if (user?.role !== 'admin') throw new Error('forbidden');
  return user;
}

/**
 * admin|member AND a present user id. Throws 'forbidden' otherwise.
 * For actions that key data on the owning user (e.g. saved filters) — the
 * id is always taken from the session, never the form (IDOR guard).
 */
export async function requireUser(): Promise<{ id: string; role: string }> {
  const user = sessionUser(await auth());
  if (user?.role !== 'admin' && user?.role !== 'member') throw new Error('forbidden');
  if (!user?.id) throw new Error('forbidden');
  return user as { id: string; role: string };
}

// --- API-route guard ------------------------------------------------------
// Returns a 403 Response instead of throwing, so route handlers can early-return
// it. Honours the E2E bypass via authOrE2E. Discriminated union: check `.response`.

type ApiGate = { user: SessionUser; response?: undefined } | { user?: undefined; response: NextResponse };

/** assertApiRole(req, ['admin']) → {user} if allowed, else {response: 403}. */
export async function assertApiRole(req: Request, roles: readonly string[] = WRITER_ROLES): Promise<ApiGate> {
  const user = sessionUser(await authOrE2E(req));
  if (!user || !roles.includes(user.role ?? '')) {
    return { response: new NextResponse('forbidden', { status: 403 }) };
  }
  return { user };
}
