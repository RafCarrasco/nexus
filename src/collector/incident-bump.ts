import { prisma } from '@/db/client';

/**
 * Record one more occurrence of an already-open incident: bump the event counter and stamp
 * lastEventAt. Called wherever the collectors detect a still-open incident instead of
 * opening a new one — turns silent dedup into a Sentry-style "N events" signal that surfaces
 * flapping/persistent problems in the feed.
 */
export async function bumpIncident(id: string, at: Date = new Date()): Promise<void> {
  await prisma.incident.update({
    where: { id },
    data: { eventCount: { increment: 1 }, lastEventAt: at },
  });
}
