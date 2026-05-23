import { prisma } from '@/db/client';

/**
 * Postgres advisory lock per connection. Returns true if acquired,
 * false if another worker already holds it.
 */
export async function tryConnectionLock(connectionId: string): Promise<boolean> {
  const [{ locked }] = await prisma.$queryRaw<{ locked: boolean }[]>`
    SELECT pg_try_advisory_lock(hashtextextended(${connectionId}, 0)) AS locked
  `;
  return locked;
}

export async function releaseConnectionLock(connectionId: string): Promise<void> {
  await prisma.$executeRaw`
    SELECT pg_advisory_unlock(hashtextextended(${connectionId}, 0))
  `;
}
