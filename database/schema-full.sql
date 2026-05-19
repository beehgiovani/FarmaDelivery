-- Drogaria Santo Antonio consolidated database setup
-- Canonical Supabase SQL file.
-- Use this as the single full bootstrap/reference file.
-- Maintain this file directly when schema, seed, RLS, realtime, or table comments change.
-- The generated output is normalized for re-runs: existing types, tables,
-- indexes, constraints and policies should not fail only because they already exist.


-- ============================================================================
-- Section: base schema, enums, tables, indexes, and constraints
-- ============================================================================

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'UserRole') THEN
    CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'GERENTE', 'BALCONISTA_CAIXA', 'MOTOBOY');
  END IF;
END $$;

-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StoreBaseType') THEN
    CREATE TYPE "StoreBaseType" AS ENUM ('COMPARTILHADA', 'DEDICADA');
  END IF;
END $$;

-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DeliveryStatus') THEN
    CREATE TYPE "DeliveryStatus" AS ENUM (
        'RASCUNHO',
        'AGUARDANDO_MOTOBOY',
        'ACEITA_PELO_MOTOBOY',
        'COLETADA',
        'EM_ROTA',
        'ENTREGUE',
        'PROBLEMA',
        'CANCELADA'
    );
  END IF;
END $$;

-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DeliveryPriority') THEN
    CREATE TYPE "DeliveryPriority" AS ENUM ('NORMAL', 'URGENTE', 'RETORNO');
  END IF;
END $$;

-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DeliveryEventType') THEN
    CREATE TYPE "DeliveryEventType" AS ENUM (
        'CRIADA',
        'AGENDADA',
        'REDIRECIONADA',
        'ACEITA',
        'COLETADA',
        'ROTA_RECALCULADA',
        'OCORRENCIA_REGISTRADA',
        'ENTREGUE',
        'CANCELADA'
    );
  END IF;
END $$;

-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RouteStatus') THEN
    CREATE TYPE "RouteStatus" AS ENUM (
        'ABERTA',
        'EM_ANDAMENTO',
        'FINALIZADA',
        'CANCELADA'
    );
  END IF;
END $$;

-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RouteStopType') THEN
    CREATE TYPE "RouteStopType" AS ENUM ('COLETA', 'ENTREGA');
  END IF;
END $$;

-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RouteStopStatus') THEN
    CREATE TYPE "RouteStopStatus" AS ENUM ('PENDENTE', 'CONCLUIDA', 'PULADA', 'CANCELADA');
  END IF;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS
    "Store" (
        "id" TEXT NOT NULL,
        "code" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "address" TEXT NOT NULL,
        "latitude" DECIMAL(10, 7),
        "longitude" DECIMAL(10, 7),
        "baseType" "StoreBaseType" NOT NULL,
        "active" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "Store_pkey" PRIMARY KEY ("id")
    );

-- CreateTable
CREATE TABLE IF NOT EXISTS
    "User" (
        "id" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "phone" TEXT,
        "email" TEXT,
        "passwordHash" TEXT NOT NULL,
        "role" "UserRole" NOT NULL,
        "active" BOOLEAN NOT NULL DEFAULT true,
        "storeId" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "User_pkey" PRIMARY KEY ("id")
    );

-- CreateTable
CREATE TABLE IF NOT EXISTS
    "Courier" (
        "id" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "baseStoreName" TEXT NOT NULL,
        "available" BOOLEAN NOT NULL DEFAULT false,
        "preferredServiceArea" TEXT NOT NULL DEFAULT 'ASTURIAS',
        "currentLat" DECIMAL(10, 7),
        "currentLng" DECIMAL(10, 7),
        "lastLocationAt" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "Courier_pkey" PRIMARY KEY ("id")
    );

ALTER TABLE "Courier"
ADD COLUMN IF NOT EXISTS "preferredServiceArea" TEXT NOT NULL DEFAULT 'ASTURIAS';

UPDATE "Courier"
SET "preferredServiceArea" = 'ASTURIAS'
WHERE "preferredServiceArea" IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Courier_preferredServiceArea_check') THEN
    ALTER TABLE "Courier"
      ADD CONSTRAINT "Courier_preferredServiceArea_check"
      CHECK ("preferredServiceArea" IN ('ASTURIAS', 'PEREQUE'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Courier_preferredServiceArea_available_idx"
  ON "Courier"("preferredServiceArea", "available");

-- CreateTable
CREATE TABLE IF NOT EXISTS
    "Customer" (
        "id" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "phone" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
    );

-- CreateTable
CREATE TABLE IF NOT EXISTS
    "CustomerAddress" (
        "id" TEXT NOT NULL,
        "customerId" TEXT NOT NULL,
        "street" TEXT NOT NULL,
        "number" TEXT NOT NULL,
        "complement" TEXT,
        "neighborhood" TEXT,
        "reference" TEXT,
        "latitude" DECIMAL(10, 7),
        "longitude" DECIMAL(10, 7),
        "active" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "CustomerAddress_pkey" PRIMARY KEY ("id")
    );

-- CreateTable
CREATE TABLE IF NOT EXISTS
    "Delivery" (
        "id" TEXT NOT NULL,
        "publicCode" TEXT NOT NULL,
        "storeId" TEXT NOT NULL,
        "redirectedFromStoreId" TEXT,
        "customerId" TEXT NOT NULL,
        "customerAddressId" TEXT NOT NULL,
        "courierId" TEXT,
        "status" "DeliveryStatus" NOT NULL DEFAULT 'AGUARDANDO_MOTOBOY',
        "priority" "DeliveryPriority" NOT NULL DEFAULT 'NORMAL',
        "notes" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "earliestDispatchAt" TIMESTAMP(3),
        "acceptedAt" TIMESTAMP(3),
        "collectedAt" TIMESTAMP(3),
        "deliveredAt" TIMESTAMP(3),
        "canceledAt" TIMESTAMP(3),
        CONSTRAINT "Delivery_pkey" PRIMARY KEY ("id")
    );

-- CreateTable
CREATE TABLE IF NOT EXISTS
    "DeliveryEvent" (
        "id" TEXT NOT NULL,
        "deliveryId" TEXT NOT NULL,
        "type" "DeliveryEventType" NOT NULL,
        "actorUserId" TEXT,
        "notes" TEXT,
        "metadata" JSONB,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "DeliveryEvent_pkey" PRIMARY KEY ("id")
    );

-- CreateTable
CREATE TABLE IF NOT EXISTS
    "CourierRoute" (
        "id" TEXT NOT NULL,
        "courierId" TEXT NOT NULL,
        "status" "RouteStatus" NOT NULL DEFAULT 'ABERTA',
        "startedAt" TIMESTAMP(3),
        "finishedAt" TIMESTAMP(3),
        "recalculatedAt" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "CourierRoute_pkey" PRIMARY KEY ("id")
    );

-- CreateTable
CREATE TABLE IF NOT EXISTS
    "RouteStop" (
        "id" TEXT NOT NULL,
        "routeId" TEXT NOT NULL,
        "deliveryId" TEXT,
        "storeId" TEXT,
        "type" "RouteStopType" NOT NULL,
        "status" "RouteStopStatus" NOT NULL DEFAULT 'PENDENTE',
        "sequence" INTEGER NOT NULL,
        "address" TEXT NOT NULL,
        "latitude" DECIMAL(10, 7),
        "longitude" DECIMAL(10, 7),
        "earliestAt" TIMESTAMP(3),
        "completedAt" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "RouteStop_pkey" PRIMARY KEY ("id")
    );

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Store_code_key" ON "Store" ("code");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User" ("email");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Courier_userId_key" ON "Courier" ("userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Customer_phone_key" ON "Customer" ("phone");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Delivery_publicCode_key" ON "Delivery" ("publicCode");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Delivery_storeId_status_idx" ON "Delivery" ("storeId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Delivery_courierId_status_idx" ON "Delivery" ("courierId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Delivery_createdAt_idx" ON "Delivery" ("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DeliveryEvent_deliveryId_createdAt_idx" ON "DeliveryEvent" ("deliveryId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DeliveryEvent_type_createdAt_idx" ON "DeliveryEvent" ("type", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RouteStop_routeId_status_idx" ON "RouteStop" ("routeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "RouteStop_routeId_sequence_key" ON "RouteStop" ("routeId", "sequence");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'User_storeId_fkey') THEN
    ALTER TABLE "User" ADD CONSTRAINT "User_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Courier_userId_fkey') THEN
    ALTER TABLE "Courier" ADD CONSTRAINT "Courier_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CustomerAddress_customerId_fkey') THEN
    ALTER TABLE "CustomerAddress" ADD CONSTRAINT "CustomerAddress_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Delivery_storeId_fkey') THEN
    ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Delivery_customerId_fkey') THEN
    ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Delivery_customerAddressId_fkey') THEN
    ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_customerAddressId_fkey" FOREIGN KEY ("customerAddressId") REFERENCES "CustomerAddress" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Delivery_courierId_fkey') THEN
    ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_courierId_fkey" FOREIGN KEY ("courierId") REFERENCES "Courier" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DeliveryEvent_deliveryId_fkey') THEN
    ALTER TABLE "DeliveryEvent" ADD CONSTRAINT "DeliveryEvent_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "Delivery" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DeliveryEvent_actorUserId_fkey') THEN
    ALTER TABLE "DeliveryEvent" ADD CONSTRAINT "DeliveryEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CourierRoute_courierId_fkey') THEN
    ALTER TABLE "CourierRoute" ADD CONSTRAINT "CourierRoute_courierId_fkey" FOREIGN KEY ("courierId") REFERENCES "Courier" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RouteStop_routeId_fkey') THEN
    ALTER TABLE "RouteStop" ADD CONSTRAINT "RouteStop_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "CourierRoute" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RouteStop_deliveryId_fkey') THEN
    ALTER TABLE "RouteStop" ADD CONSTRAINT "RouteStop_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "Delivery" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RouteStop_storeId_fkey') THEN
    ALTER TABLE "RouteStop" ADD CONSTRAINT "RouteStop_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;


-- ============================================================================
-- Section: store weekly hours and date overrides
-- ============================================================================

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

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StoreWeeklyHours_storeId_fkey') THEN
    ALTER TABLE "StoreWeeklyHours" ADD CONSTRAINT "StoreWeeklyHours_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StoreDateOverride_storeId_fkey') THEN
    ALTER TABLE "StoreDateOverride" ADD CONSTRAINT "StoreDateOverride_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;


-- ============================================================================
-- Section: user and courier store assignments
-- ============================================================================

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
    WHEN lower(s."name") LIKE '%pereque%' THEN 'DEDICADA'::"AssignmentKind"
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


-- ============================================================================
-- Section: courier device tokens
-- ============================================================================

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


-- ============================================================================
-- Section: delivery notification event metadata
-- ============================================================================

ALTER TYPE "DeliveryEventType" ADD VALUE IF NOT EXISTS 'NOTIFICACAO_ENVIADA';


-- ============================================================================
-- Section: delivery proof storage metadata
-- ============================================================================

create extension if not exists pgcrypto;

create table if not exists public."DeliveryProof" (
  "id" text primary key default gen_random_uuid()::text,
  "deliveryId" text not null references public."Delivery"("id"),
  "actorUserId" text references public."User"("id"),
  "fileName" text not null,
  "mimeType" text not null,
  "storagePath" text not null,
  "sizeBytes" integer not null,
  "sha256" text not null,
  "createdAt" timestamp(3) without time zone not null default current_timestamp
);

create index if not exists "DeliveryProof_deliveryId_createdAt_idx"
  on public."DeliveryProof"("deliveryId", "createdAt");

create index if not exists "DeliveryProof_actorUserId_createdAt_idx"
  on public."DeliveryProof"("actorUserId", "createdAt");

alter table public."DeliveryProof" enable row level security;

alter table public."DeliveryProof" replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'DeliveryProof'
  ) then
    alter publication supabase_realtime add table public."DeliveryProof";
  end if;
end $$;


-- ============================================================================
-- Section: delivery deadline tier
-- ============================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'DeliveryDeadlineTier') then
    create type "DeliveryDeadlineTier" as enum ('PERTO', 'MEDIO', 'LONGE');
  end if;
end $$;

alter table public."Delivery"
  add column if not exists "deadlineTier" "DeliveryDeadlineTier" not null default 'MEDIO';


-- ============================================================================
-- Section: delivery daily sequence
-- ============================================================================

-- Numeracao diaria por loja para entregas.
-- Mantem codigos antigos como historico e passa a gerar novas entregas no formato LOJA-AAAAMMDD-001.

CREATE TABLE IF NOT EXISTS "DeliveryDailySequence" (
  "storeId" TEXT NOT NULL,
  "sequenceDate" DATE NOT NULL,
  "lastNumber" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeliveryDailySequence_pkey" PRIMARY KEY ("storeId", "sequenceDate")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'DeliveryDailySequence_storeId_fkey'
  ) THEN
    ALTER TABLE "DeliveryDailySequence"
      ADD CONSTRAINT "DeliveryDailySequence_storeId_fkey"
      FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "Delivery"
  ADD COLUMN IF NOT EXISTS "storeDailyDate" DATE,
  ADD COLUMN IF NOT EXISTS "storeDailyNumber" INTEGER;

WITH numbered AS (
  SELECT
    "id",
    ("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo')::date AS "sequenceDate",
    ROW_NUMBER() OVER (
      PARTITION BY "storeId", ("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo')::date
      ORDER BY "createdAt", "id"
    )::integer AS "sequenceNumber"
  FROM "Delivery"
)
UPDATE "Delivery" AS delivery
SET
  "storeDailyDate" = numbered."sequenceDate",
  "storeDailyNumber" = numbered."sequenceNumber"
FROM numbered
WHERE delivery."id" = numbered."id"
  AND (delivery."storeDailyDate" IS NULL OR delivery."storeDailyNumber" IS NULL);

INSERT INTO "DeliveryDailySequence" ("storeId", "sequenceDate", "lastNumber", "createdAt", "updatedAt")
SELECT
  "storeId",
  "storeDailyDate",
  MAX("storeDailyNumber"),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Delivery"
WHERE "storeDailyDate" IS NOT NULL
  AND "storeDailyNumber" IS NOT NULL
GROUP BY "storeId", "storeDailyDate"
ON CONFLICT ("storeId", "sequenceDate")
DO UPDATE SET
  "lastNumber" = GREATEST("DeliveryDailySequence"."lastNumber", EXCLUDED."lastNumber"),
  "updatedAt" = CURRENT_TIMESTAMP;

ALTER TABLE "Delivery"
  ALTER COLUMN "storeDailyDate" SET NOT NULL,
  ALTER COLUMN "storeDailyNumber" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "Delivery_storeId_storeDailyDate_storeDailyNumber_key"
  ON "Delivery" ("storeId", "storeDailyDate", "storeDailyNumber");

CREATE INDEX IF NOT EXISTS "Delivery_storeId_storeDailyDate_idx"
  ON "Delivery" ("storeId", "storeDailyDate");

CREATE INDEX IF NOT EXISTS "DeliveryDailySequence_sequenceDate_idx"
  ON "DeliveryDailySequence" ("sequenceDate");


-- ============================================================================
-- Section: initial production stores and admin seed
-- ============================================================================

INSERT INTO
    "Store" (
        "id",
        "code",
        "name",
        "address",
        "latitude",
        "longitude",
        "baseType",
        "active",
        "createdAt",
        "updatedAt"
    )
VALUES
    (
        gen_random_uuid (),
        'LOJA_1',
        'Asturias',
        'Av. dos Caicaras, 1171 - Asturias',
        -24.0038254,
        -46.2739040,
        'COMPARTILHADA',
        true,
        now (),
        now ()
    ),
    (
        gen_random_uuid (),
        'LOJA_2',
        'Morrinhos',
        'Rua Poeta Augusto Frederico Schimidt, 10 - Jardim Brasil, Morrinhos',
        -23.9641688,
        -46.2487743,
        'COMPARTILHADA',
        true,
        now (),
        now ()
    ),
    (
        gen_random_uuid (),
        'LOJA_3',
        'Santa Rosa',
        'Rua Jose Vaz Porto, 588 - proximo a Praca do Povo, Santa Rosa',
        -23.9971092,
        -46.2814548,
        'COMPARTILHADA',
        true,
        now (),
        now ()
    ),
    (
        gen_random_uuid (),
        'LOJA_4',
        'Santo Antonio',
        'Alameda das Tulipas, 660 - Santo Antonio',
        -23.9886659,
        -46.2719188,
        'COMPARTILHADA',
        true,
        now (),
        now ()
    ),
    (
        gen_random_uuid (),
        'LOJA_5',
        'Pereque',
        'Av. Rio Amazonas, 151 - Praia do Pereque, Pereque',
        -23.9366571,
        -46.1831768,
        'DEDICADA',
        true,
        now (),
        now ()
    ) ON CONFLICT ("code") DO
UPDATE
SET
    "name" = EXCLUDED."name",
    "address" = EXCLUDED."address",
    "latitude" = EXCLUDED."latitude",
    "longitude" = EXCLUDED."longitude",
    "baseType" = EXCLUDED."baseType",
    "active" = EXCLUDED."active",
    "updatedAt" = now ();

-- ============================================================================
-- Section: store hours seed
-- ============================================================================

WITH
  days AS (
    SELECT
      generate_series (0, 6) AS day_of_week
  ),
  stores AS (
    SELECT
      "id",
      "code",
      CASE
        WHEN "code" = 'LOJA_1' THEN '23:00'
        ELSE '22:00'
      END AS closes_at
    FROM
      "Store"
  )
INSERT INTO
  "StoreWeeklyHours" (
    "id",
    "storeId",
    "dayOfWeek",
    "opensAt",
    "closesAt",
    "closed",
    "createdAt",
    "updatedAt"
  )
SELECT
  gen_random_uuid (),
  stores."id",
  days.day_of_week,
  '08:00',
  stores.closes_at,
  false,
  now (),
  now ()
FROM
  stores
  CROSS JOIN days ON CONFLICT ("storeId", "dayOfWeek") DO
UPDATE
SET
  "opensAt" = EXCLUDED."opensAt",
  "closesAt" = EXCLUDED."closesAt",
  "closed" = EXCLUDED."closed",
  "updatedAt" = now ();

SELECT
  s."code",
  s."name",
  COUNT(h."id") AS configured_days,
  MIN(h."opensAt") AS opens_at,
  MAX(h."closesAt") AS closes_at
FROM
  "Store" s
  LEFT JOIN "StoreWeeklyHours" h ON h."storeId" = s."id"
GROUP BY
  s."code",
  s."name"
ORDER BY
  s."code";

-- ============================================================================
-- Section: row level security policies
-- ============================================================================

ALTER TABLE "Store" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "StoreWeeklyHours" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "StoreDateOverride" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "UserStoreAssignment" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "CourierStoreAssignment" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "CourierDeviceToken" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read active stores" ON "Store";

CREATE POLICY "Public can read active stores" ON "Store" FOR
SELECT
  TO anon,
  authenticated USING ("active" = true);

DROP POLICY IF EXISTS "Public can read active store weekly hours" ON "StoreWeeklyHours";

CREATE POLICY "Public can read active store weekly hours" ON "StoreWeeklyHours" FOR
SELECT
  TO anon,
  authenticated USING (
    EXISTS (
      SELECT
        1
      FROM
        "Store"
      WHERE
        "Store"."id" = "StoreWeeklyHours"."storeId"
        AND "Store"."active" = true
    )
  );

DROP POLICY IF EXISTS "Public can read active store date overrides" ON "StoreDateOverride";

CREATE POLICY "Public can read active store date overrides" ON "StoreDateOverride" FOR
SELECT
  TO anon,
  authenticated USING (
    EXISTS (
      SELECT
        1
      FROM
        "Store"
      WHERE
        "Store"."id" = "StoreDateOverride"."storeId"
        AND "Store"."active" = true
    )
  );

-- Mantemos as tabelas sensiveis sem leitura publica.
ALTER TABLE "Customer" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "CustomerAddress" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "Delivery" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "DeliveryEvent" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "DeliveryProof" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "DeliveryDailySequence" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "Courier" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "CourierRoute" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "RouteStop" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;

-- Tabelas de alocacao sao sensiveis: mostram escala, rodizio e emprestimos.
-- A API usa service role server-side e aplica escopo por token.
-- Policies autenticadas finais devem ser definidas junto do modelo RLS definitivo.

-- Tokens de dispositivo sao sensiveis e nao devem ter leitura publica.
-- O cadastro e uso ficam restritos a API server-side com service role.


-- ============================================================================
-- Section: realtime publication configuration
-- ============================================================================

-- Enable Supabase Realtime for operational tables.
-- Realtime publication alone does not grant read access.
-- RLS policies still decide which clients can receive row changes.

DO $$
DECLARE
  table_name text;
  table_names text[] := ARRAY[
    'Store',
    'StoreWeeklyHours',
    'StoreDateOverride',
    'UserStoreAssignment',
    'CourierStoreAssignment',
    'Courier',
    'Delivery',
    'DeliveryEvent',
    'DeliveryProof',
    'CourierRoute',
    'RouteStop',
    'Customer',
    'CustomerAddress'
  ];
BEGIN
  FOREACH table_name IN ARRAY table_names LOOP
    EXECUTE format('ALTER TABLE %I REPLICA IDENTITY FULL', table_name);

    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = table_name
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', table_name);
    END IF;
  END LOOP;
END $$;

-- Current public realtime access:
-- Store rows can be received by anon/authenticated users because read-only RLS policies allow public store lookup.
-- allows SELECT on active stores and their public opening hours.
--
-- Sensitive tables are published for Realtime, but RLS remains enabled and no public
-- SELECT policies exist yet. Add authenticated role policies before exposing them
-- to browser/mobile clients.


-- ============================================================================
-- Section: table documentation comments
-- ============================================================================

COMMENT ON TABLE public."Store" IS
'Drogaria Santo Antonio stores/units. Public operational catalog for active stores, origin scope, opening hours, delivery numbering and map markers. RLS is enabled; anon/authenticated can SELECT only active rows through policies.sql. Writes must go through the API/service role.';

COMMENT ON TABLE public."StoreWeeklyHours" IS
'Default weekly opening hours per store and weekday. Used by the admin delivery form to suggest scheduling and by operational store context. RLS is enabled; anon/authenticated can SELECT rows only when the parent Store is active. Writes must go through the API/service role.';

COMMENT ON TABLE public."StoreDateOverride" IS
'Date-specific opening hour exceptions for holidays, inventory, special closing or special shifts. RLS is enabled; anon/authenticated can SELECT rows only when the parent Store is active. Writes must go through the API/service role.';

COMMENT ON TABLE public."User" IS
'System users and operational references. ADMIN/GERENTE/MOTOBOY are login roles; BALCONISTA_CAIXA is used as an operational reference/autocomplete and may not have login credentials. RLS is enabled with no public SELECT policy; the API applies auth, store scope and service-role access. Never expose passwordHash.';

COMMENT ON TABLE public."Courier" IS
'Courier profile linked one-to-one to a MOTOBOY user. Stores availability, last known location, base label and preferredServiceArea chosen in PWA/Android so server-side push can route new deliveries after API restarts. RLS is enabled with no public SELECT policy; clients read/update through API endpoints that enforce role, courier ownership and store/service-area scope.';

COMMENT ON TABLE public."CourierDeviceToken" IS
'FCM/Web Push device tokens for couriers. Tokens are sensitive and are only registered/used by server-side API code for notifications. RLS is enabled with no public SELECT policy; monitor/export endpoints must expose only aggregate or sanitized device metadata, never token values.';

COMMENT ON TABLE public."UserStoreAssignment" IS
'Active and historical store assignments for users such as store logins and operational staff references. Supports base/temporary/rotation coverage and store-scope calculations. RLS is enabled with no public SELECT policy; admin screens use API/service-role routes that enforce ADMIN permission.';

COMMENT ON TABLE public."CourierStoreAssignment" IS
'Active and historical store assignments for couriers, including base, coverage, dedicated and rotation rules. Used as legacy/fallback store scope while courier apps prefer selected service area for available deliveries. RLS is enabled with no public SELECT policy; admin writes and scoped reads go through the API/service role.';

COMMENT ON TABLE public."Customer" IS
'Delivery customer identity keyed by phone. Contains personal data and supports phone lookup/reuse at the counter. RLS is enabled with no public SELECT policy; all reads/writes must go through API routes that apply login/store scope and LGPD rules.';

COMMENT ON TABLE public."CustomerAddress" IS
'Customer delivery addresses, optional coordinates, references and active flag. Feeds geocoding, maps, route planning and delivery creation. RLS is enabled with no public SELECT policy; all reads/writes must go through API routes that apply login/store scope and LGPD rules.';

COMMENT ON TABLE public."Delivery" IS
'Main operational delivery record. Stores public code, daily store number, store/customer/address/courier links, status, priority, deadline tier, payment/operational notes and lifecycle timestamps. RLS is enabled with no public SELECT policy; API enforces admin/store/courier scope, service area, availability and transition permissions.';

COMMENT ON TABLE public."DeliveryDailySequence" IS
'Per-store per-day counter used to generate storeDailyNumber and public delivery codes in LOJA-AAAAMMDD-001 format. Composite primary key is storeId plus sequenceDate. RLS is enabled with no public SELECT policy; only API/service-role code should increment or reconcile counters.';

COMMENT ON TABLE public."DeliveryProof" IS
'Optional photographic proof metadata for deliveries. Binary files live in configured local/API storage; this table stores filename, MIME, storage path, size, hash and actor. RLS is enabled with no public SELECT policy; API validates image signatures, size, ownership/scope and authenticated downloads.';

COMMENT ON TABLE public."DeliveryEvent" IS
'Append-only operational audit trail for deliveries: creation, scheduling, redirects, transitions, route recalculation, problems, cancellation and notification audit. Metadata is JSONB and actorUserId should be present for authenticated operational fallback events. RLS is enabled with no public SELECT policy; event history is exposed through scoped API routes.';

COMMENT ON TABLE public."CourierRoute" IS
'Persisted courier route header for active and historical route planning. Groups ordered RouteStop rows for a courier and tracks route status, start, finish and recalculation timestamps. RLS is enabled with no public SELECT policy; API exposes only routes allowed by admin/store/courier scope.';

COMMENT ON TABLE public."RouteStop" IS
'Ordered stops inside a CourierRoute, linked to delivery and/or store when available. Stores stop type, status, sequence, address, coordinates, scheduled time and completion time for admin, PWA and Android route views. RLS is enabled with no public SELECT policy; API filters stops by visible store scope and courier ownership.';

