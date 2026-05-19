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