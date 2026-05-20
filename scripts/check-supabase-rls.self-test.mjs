import assert from "node:assert/strict";
import { analyzeSupabaseRls } from "./check-supabase-rls.mjs";

const safeSql = `
CREATE TABLE IF NOT EXISTS public."Store" ("id" uuid);
ALTER TABLE public."Store" ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public."Store" IS 'Catalogo publico.';
CREATE POLICY "public stores" ON public."Store" FOR SELECT TO anon USING (true);

CREATE TABLE public."Delivery" ("id" uuid);
ALTER TABLE public."Delivery" ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public."Delivery" IS 'Entrega operacional sensivel.';
CREATE POLICY "delivery authenticated" ON public."Delivery" FOR SELECT TO authenticated USING (true);
`;

const safeReport = analyzeSupabaseRls(safeSql);
assert.deepEqual(safeReport.missingRls, []);
assert.deepEqual(safeReport.missingComments, []);
assert.deepEqual(safeReport.publicPoliciesOnSensitiveTables, []);
assert.equal(safeReport.tables, 2);
assert.equal(safeReport.rlsEnabled, 2);

const unsafeSql = `
CREATE TABLE public."_prisma_migrations" ("id" text);
CREATE TABLE public."Customer" ("id" uuid);
CREATE POLICY "customer anon" ON public."Customer" FOR SELECT TO anon USING (true);
CREATE TABLE public."DeliveryProof" ("id" uuid);
ALTER TABLE public."DeliveryProof" ENABLE ROW LEVEL SECURITY;
`;

const unsafeReport = analyzeSupabaseRls(unsafeSql);
assert.deepEqual(unsafeReport.missingRls, ["Customer"]);
assert.deepEqual(unsafeReport.missingComments, ["Customer", "DeliveryProof"]);
assert.deepEqual(unsafeReport.publicPoliciesOnSensitiveTables, [{ name: "customer anon", table: "Customer" }]);
assert.equal(unsafeReport.tables, 2);

process.stdout.write(
  `${JSON.stringify(
    {
      mode: "supabase-rls-check-self-test",
      ok: true,
      scenarios: 2,
    },
    null,
    2,
  )}\n`,
);
