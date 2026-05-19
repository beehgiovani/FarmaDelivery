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
