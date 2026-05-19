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
