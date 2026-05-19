SELECT
  schemaname,
  tablename,
  pubname
FROM
  pg_publication_tables
WHERE
  pubname = 'supabase_realtime'
ORDER BY
  schemaname,
  tablename;

SELECT
  relname AS table_name,
  relreplident AS replica_identity
FROM
  pg_class
WHERE
  relname IN (
    'Store',
    'StoreWeeklyHours',
    'StoreDateOverride',
    'Courier',
    'Delivery',
    'DeliveryEvent',
    'CourierRoute',
    'RouteStop',
    'Customer',
    'CustomerAddress'
  )
ORDER BY
  relname;