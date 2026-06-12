import { prisma } from '@/db/client';
import { log } from '@/lib/logger';

/**
 * Record an audit entry for a mutating action. Best-effort: a failure here
 * (e.g. FK miss for a dev/e2e session whose user row doesn't exist) is logged
 * but must never break the user action that triggered it.
 */
export async function writeAudit(entry: {
  userId: string | undefined;
  action: string; // dotted verb, e.g. 'connection.create'
  target: string; // affected entity id or name
  payload?: unknown;
}): Promise<void> {
  if (!entry.userId) return;
  try {
    await prisma.auditLog.create({
      data: {
        userId: entry.userId,
        action: entry.action,
        target: entry.target,
        payload: (entry.payload ?? undefined) as never,
      },
    });
  } catch (e) {
    log.warn('audit write failed', { action: entry.action, err: (e as Error).message });
  }
}
