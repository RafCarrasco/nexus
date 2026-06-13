-- CreateTable
CREATE TABLE "NotificationChannel" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "config" BYTEA NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnOpen" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnResolve" BOOLEAN NOT NULL DEFAULT true,
    "lastError" TEXT,
    "lastFiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationChannel_pkey" PRIMARY KEY ("id")
);
