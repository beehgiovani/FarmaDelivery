-- Adds operational assignments for borrowed store staff and rotating couriers.
-- User.storeId and Courier.baseStoreName remain as simple/default references.
-- These tables hold the auditable assignment history used for temporary coverage.

DO $$
BEGIN
  CREATE TYPE "AssignmentKind" AS ENUM (
    'BASE',
    'TEMPORARIA',
    'COBERTURA',
    'DEDICADA',
    'RODIZIO'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "UserStoreAssignment" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "kind" "AssignmentKind" NOT NULL DEFAULT 'BASE',
  "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endsAt" TIMESTAMP(3),
  "active" BOOLEAN NOT NULL DEFAULT true,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserStoreAssignment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "UserStoreAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "UserStoreAssignment_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "CourierStoreAssignment" (
  "id" TEXT NOT NULL,
  "courierId" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "kind" "AssignmentKind" NOT NULL DEFAULT 'COBERTURA',
  "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endsAt" TIMESTAMP(3),
  "active" BOOLEAN NOT NULL DEFAULT true,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CourierStoreAssignment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CourierStoreAssignment_courierId_fkey" FOREIGN KEY ("courierId") REFERENCES "Courier"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CourierStoreAssignment_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "UserStoreAssignment_userId_active_startsAt_endsAt_idx"
  ON "UserStoreAssignment"("userId", "active", "startsAt", "endsAt");

CREATE INDEX IF NOT EXISTS "UserStoreAssignment_storeId_active_idx"
  ON "UserStoreAssignment"("storeId", "active");

CREATE INDEX IF NOT EXISTS "CourierStoreAssignment_courierId_active_startsAt_endsAt_idx"
  ON "CourierStoreAssignment"("courierId", "active", "startsAt", "endsAt");

CREATE INDEX IF NOT EXISTS "CourierStoreAssignment_storeId_active_idx"
  ON "CourierStoreAssignment"("storeId", "active");

INSERT INTO "UserStoreAssignment" (
  "id",
  "userId",
  "storeId",
  "kind",
  "reason",
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  u."id",
  u."storeId",
  'BASE',
  'Vinculo inicial importado de User.storeId',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "User" u
WHERE u."storeId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "UserStoreAssignment" usa
    WHERE usa."userId" = u."id"
      AND usa."storeId" = u."storeId"
      AND usa."kind" = 'BASE'
  );

INSERT INTO "CourierStoreAssignment" (
  "id",
  "courierId",
  "storeId",
  "kind",
  "reason",
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  c."id",
  s."id",
  CASE
    WHEN lower(s."name") LIKE '%pereque%' OR lower(s."name") LIKE '%perequ%' THEN 'DEDICADA'::"AssignmentKind"
    ELSE 'COBERTURA'::"AssignmentKind"
  END,
  'Vinculo inicial importado de Courier.baseStoreName',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Courier" c
JOIN "Store" s ON lower(s."name") = lower(c."baseStoreName")
WHERE NOT EXISTS (
  SELECT 1
  FROM "CourierStoreAssignment" csa
  WHERE csa."courierId" = c."id"
    AND csa."storeId" = s."id"
);

ALTER TABLE "UserStoreAssignment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CourierStoreAssignment" ENABLE ROW LEVEL SECURITY;
