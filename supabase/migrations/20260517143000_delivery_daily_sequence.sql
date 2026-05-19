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
