-- UptimeCheck: store last measured latency for quick display.
ALTER TABLE "UptimeCheck" ADD COLUMN "lastLatencyMs" INTEGER;

-- Per-tick uptime sample (latency + outcome time-series).
CREATE TABLE "UptimeSample" (
    "id" TEXT NOT NULL,
    "uptimeCheckId" TEXT NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "status" INTEGER,
    "latencyMs" INTEGER,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UptimeSample_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "UptimeSample_uptimeCheckId_at_idx" ON "UptimeSample"("uptimeCheckId", "at");
ALTER TABLE "UptimeSample" ADD CONSTRAINT "UptimeSample_uptimeCheckId_fkey"
    FOREIGN KEY ("uptimeCheckId") REFERENCES "UptimeCheck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- User-defined numeric thresholds on ingested metrics.
CREATE TABLE "MetricThreshold" (
    "id" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "metricName" TEXT NOT NULL,
    "operator" TEXT NOT NULL,
    "threshold" DECIMAL(18,6) NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'warn',
    "lookbackSec" INTEGER NOT NULL DEFAULT 3600,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastValue" DECIMAL(18,6),
    "lastEvalAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MetricThreshold_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MetricThreshold_resourceId_metricName_idx" ON "MetricThreshold"("resourceId", "metricName");
ALTER TABLE "MetricThreshold" ADD CONSTRAINT "MetricThreshold_resourceId_fkey"
    FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Single-row collector liveness heartbeat.
CREATE TABLE "CollectorHeartbeat" (
    "id" TEXT NOT NULL,
    "lastRunAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "connectionCount" INTEGER NOT NULL DEFAULT 0,
    "durationMs" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CollectorHeartbeat_pkey" PRIMARY KEY ("id")
);
