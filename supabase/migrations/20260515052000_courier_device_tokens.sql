CREATE TABLE IF NOT EXISTS "CourierDeviceToken" (
  "id" TEXT NOT NULL,
  "courierId" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "platform" TEXT NOT NULL DEFAULT 'android',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CourierDeviceToken_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CourierDeviceToken_courierId_fkey" FOREIGN KEY ("courierId") REFERENCES "Courier"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "CourierDeviceToken_token_key" ON "CourierDeviceToken"("token");

CREATE INDEX IF NOT EXISTS "CourierDeviceToken_courierId_active_idx" ON "CourierDeviceToken"("courierId", "active");

ALTER TABLE "CourierDeviceToken" ENABLE ROW LEVEL SECURITY;
