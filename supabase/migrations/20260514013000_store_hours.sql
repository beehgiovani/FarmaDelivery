CREATE TABLE
    IF NOT EXISTS "StoreWeeklyHours" (
        "id" TEXT NOT NULL,
        "storeId" TEXT NOT NULL,
        "dayOfWeek" INTEGER NOT NULL,
        "opensAt" TEXT NOT NULL,
        "closesAt" TEXT NOT NULL,
        "closed" BOOLEAN NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "StoreWeeklyHours_pkey" PRIMARY KEY ("id")
    );

CREATE TABLE
    IF NOT EXISTS "StoreDateOverride" (
        "id" TEXT NOT NULL,
        "storeId" TEXT NOT NULL,
        "date" DATE NOT NULL,
        "opensAt" TEXT,
        "closesAt" TEXT,
        "closed" BOOLEAN NOT NULL DEFAULT false,
        "reason" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "StoreDateOverride_pkey" PRIMARY KEY ("id")
    );

CREATE UNIQUE INDEX IF NOT EXISTS "StoreWeeklyHours_storeId_dayOfWeek_key" ON "StoreWeeklyHours" ("storeId", "dayOfWeek");

CREATE INDEX IF NOT EXISTS "StoreWeeklyHours_storeId_idx" ON "StoreWeeklyHours" ("storeId");

CREATE UNIQUE INDEX IF NOT EXISTS "StoreDateOverride_storeId_date_key" ON "StoreDateOverride" ("storeId", "date");

CREATE INDEX IF NOT EXISTS "StoreDateOverride_date_idx" ON "StoreDateOverride" ("date");

ALTER TABLE "StoreWeeklyHours"
DROP CONSTRAINT IF EXISTS "StoreWeeklyHours_storeId_fkey";

ALTER TABLE "StoreWeeklyHours" ADD CONSTRAINT "StoreWeeklyHours_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StoreDateOverride"
DROP CONSTRAINT IF EXISTS "StoreDateOverride_storeId_fkey";

ALTER TABLE "StoreDateOverride" ADD CONSTRAINT "StoreDateOverride_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;