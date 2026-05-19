-- FarmaDelivery consolidated database setup
-- Generated from current SQL files in /supabase
-- Use this as a full bootstrap/reference file.
-- Incremental migration files remain the source of chronological change history.
-- Regenerate with: npm run db:sql:full


-- ============================================================================
-- Source: supabase/migrations/20260514011500_init_farmadelivery.sql
-- ============================================================================

﻿-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'GERENTE', 'BALCONISTA_CAIXA', 'MOTOBOY');

-- CreateEnum
CREATE TYPE "StoreBaseType" AS ENUM ('COMPARTILHADA', 'DEDICADA');

-- CreateEnum
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

-- CreateEnum
CREATE TYPE "DeliveryPriority" AS ENUM ('NORMAL', 'URGENTE', 'RETORNO');

-- CreateEnum
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

-- CreateEnum
CREATE TYPE "RouteStatus" AS ENUM (
    'ABERTA',
    'EM_ANDAMENTO',
    'FINALIZADA',
    'CANCELADA'
);

-- CreateEnum
CREATE TYPE "RouteStopType" AS ENUM ('COLETA', 'ENTREGA');

-- CreateEnum
CREATE TYPE "RouteStopStatus" AS ENUM ('PENDENTE', 'CONCLUIDA', 'PULADA', 'CANCELADA');

-- CreateTable
CREATE TABLE
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
CREATE TABLE
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
CREATE TABLE
    "Courier" (
        "id" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "baseStoreName" TEXT NOT NULL,
        "available" BOOLEAN NOT NULL DEFAULT false,
        "currentLat" DECIMAL(10, 7),
        "currentLng" DECIMAL(10, 7),
        "lastLocationAt" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "Courier_pkey" PRIMARY KEY ("id")
    );

-- CreateTable
CREATE TABLE
    "Customer" (
        "id" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "phone" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
    );

-- CreateTable
CREATE TABLE
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
CREATE TABLE
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
CREATE TABLE
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
CREATE TABLE
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
CREATE TABLE
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
CREATE UNIQUE INDEX "Store_code_key" ON "Store" ("code");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User" ("email");

-- CreateIndex
CREATE UNIQUE INDEX "Courier_userId_key" ON "Courier" ("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_phone_key" ON "Customer" ("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Delivery_publicCode_key" ON "Delivery" ("publicCode");

-- CreateIndex
CREATE INDEX "Delivery_storeId_status_idx" ON "Delivery" ("storeId", "status");

-- CreateIndex
CREATE INDEX "Delivery_courierId_status_idx" ON "Delivery" ("courierId", "status");

-- CreateIndex
CREATE INDEX "Delivery_createdAt_idx" ON "Delivery" ("createdAt");

-- CreateIndex
CREATE INDEX "DeliveryEvent_deliveryId_createdAt_idx" ON "DeliveryEvent" ("deliveryId", "createdAt");

-- CreateIndex
CREATE INDEX "DeliveryEvent_type_createdAt_idx" ON "DeliveryEvent" ("type", "createdAt");

-- CreateIndex
CREATE INDEX "RouteStop_routeId_status_idx" ON "RouteStop" ("routeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "RouteStop_routeId_sequence_key" ON "RouteStop" ("routeId", "sequence");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Courier" ADD CONSTRAINT "Courier_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerAddress" ADD CONSTRAINT "CustomerAddress_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_customerAddressId_fkey" FOREIGN KEY ("customerAddressId") REFERENCES "CustomerAddress" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_courierId_fkey" FOREIGN KEY ("courierId") REFERENCES "Courier" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryEvent" ADD CONSTRAINT "DeliveryEvent_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "Delivery" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryEvent" ADD CONSTRAINT "DeliveryEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourierRoute" ADD CONSTRAINT "CourierRoute_courierId_fkey" FOREIGN KEY ("courierId") REFERENCES "Courier" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RouteStop" ADD CONSTRAINT "RouteStop_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "CourierRoute" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RouteStop" ADD CONSTRAINT "RouteStop_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "Delivery" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RouteStop" ADD CONSTRAINT "RouteStop_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================================
-- Source: supabase/migrations/20260514013000_store_hours.sql
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

ALTER TABLE "StoreWeeklyHours"
DROP CONSTRAINT IF EXISTS "StoreWeeklyHours_storeId_fkey";

ALTER TABLE "StoreWeeklyHours" ADD CONSTRAINT "StoreWeeklyHours_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StoreDateOverride"
DROP CONSTRAINT IF EXISTS "StoreDateOverride_storeId_fkey";

ALTER TABLE "StoreDateOverride" ADD CONSTRAINT "StoreDateOverride_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================================
-- Source: supabase/migrations/20260515041000_assignments.sql
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


-- ============================================================================
-- Source: supabase/migrations/20260515052000_courier_device_tokens.sql
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
-- Source: supabase/migrations/20260515054000_delivery_notification_event.sql
-- ============================================================================

ALTER TYPE "DeliveryEventType" ADD VALUE IF NOT EXISTS 'NOTIFICACAO_ENVIADA';


-- ============================================================================
-- Source: supabase/migrations/20260515193000_delivery_proofs.sql
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
-- Source: supabase/migrations/20260517120000_delivery_deadline_tier.sql
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
-- Source: supabase/migrations/20260517143000_delivery_daily_sequence.sql
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
-- Source: supabase/seed.sql
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
-- Source: supabase/store-hours-seed.sql
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
-- Source: supabase/policies.sql
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
-- Source: supabase/realtime.sql
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
-- Store rows can be received by anon/authenticated users because supabase/policies.sql
-- allows SELECT on active stores and their public opening hours.
--
-- Sensitive tables are published for Realtime, but RLS remains enabled and no public
-- SELECT policies exist yet. Add authenticated role policies before exposing them
-- to browser/mobile clients.
