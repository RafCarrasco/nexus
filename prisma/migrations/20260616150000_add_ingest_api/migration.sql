-- CreateTable
CREATE TABLE "IngestToken" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'default',
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "IngestToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Metric" (
    "id" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "value" DECIMAL(18,6) NOT NULL,
    "unit" TEXT NOT NULL DEFAULT '',
    "timestamp" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,
    "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Metric_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IngestToken_tokenHash_key" ON "IngestToken"("tokenHash");

-- CreateIndex
CREATE INDEX "IngestToken_connectionId_idx" ON "IngestToken"("connectionId");

-- CreateIndex
CREATE INDEX "Metric_resourceId_timestamp_idx" ON "Metric"("resourceId", "timestamp");

-- CreateIndex
CREATE INDEX "Metric_name_timestamp_idx" ON "Metric"("name", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "Metric_resourceId_name_timestamp_key" ON "Metric"("resourceId", "name", "timestamp");

-- AddForeignKey
ALTER TABLE "IngestToken" ADD CONSTRAINT "IngestToken_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "Connection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Metric" ADD CONSTRAINT "Metric_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
