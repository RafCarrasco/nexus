-- Sentry-style occurrence tracking: count repeat occurrences of an open incident and
-- track when it last fired, instead of silently deduping. Backfill lastEventAt = openedAt.
ALTER TABLE "Incident" ADD COLUMN "eventCount" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Incident" ADD COLUMN "lastEventAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
UPDATE "Incident" SET "lastEventAt" = "openedAt";
