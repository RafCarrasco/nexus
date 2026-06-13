-- Singleton config for the in-app AI chat assistant. The encrypted `config` Bytes
-- holds { apiKey } (AES-256-GCM, same vault as NotificationChannel). One row, id = 'singleton'.
CREATE TABLE "AiConfig" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'anthropic',
    "model" TEXT,
    "config" BYTEA NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiConfig_pkey" PRIMARY KEY ("id")
);
