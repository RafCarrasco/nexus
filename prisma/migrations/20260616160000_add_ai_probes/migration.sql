-- CreateTable
CREATE TABLE "AiProbe" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'POST',
    "headers" JSONB,
    "bodyTemplate" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "responsePath" TEXT,
    "validationMode" TEXT NOT NULL DEFAULT 'rule',
    "validationRule" TEXT,
    "intervalSec" INTEGER NOT NULL DEFAULT 300,
    "failThreshold" INTEGER NOT NULL DEFAULT 2,
    "workspaceId" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "consecutiveFails" INTEGER NOT NULL DEFAULT 0,
    "lastStatus" TEXT,
    "lastError" TEXT,
    "lastResult" JSONB,
    "lastCheckedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiProbe_pkey" PRIMARY KEY ("id")
);

-- AlterTable: incidents may now belong to an AI probe instead of a resource/uptime check
ALTER TABLE "Incident" ADD COLUMN "aiProbeId" TEXT;

-- AddForeignKey
ALTER TABLE "AiProbe" ADD CONSTRAINT "AiProbe_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_aiProbeId_fkey" FOREIGN KEY ("aiProbeId") REFERENCES "AiProbe"("id") ON DELETE CASCADE ON UPDATE CASCADE;
