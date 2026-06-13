-- Remove the Alerts feature. Incident history is preserved: alert-raised incidents
-- keep their rows (message / severity / timestamps); they only lose the alert link.

-- Resolve any still-open alert-raised incidents first, so dropping the feature does
-- not leave orphan "open" incidents that nothing can ever resolve.
UPDATE "Incident" SET "resolvedAt" = CURRENT_TIMESTAMP
WHERE "alertRuleId" IS NOT NULL AND "resolvedAt" IS NULL;

-- Drop the Incident -> AlertRule link (FK constraint + column). Incident rows survive.
ALTER TABLE "Incident" DROP CONSTRAINT IF EXISTS "Incident_alertRuleId_fkey";
ALTER TABLE "Incident" DROP COLUMN IF EXISTS "alertRuleId";

-- Drop the AlertRule table (its FK to Workspace is dropped with it).
DROP TABLE IF EXISTS "AlertRule";
