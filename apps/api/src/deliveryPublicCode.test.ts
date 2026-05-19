import assert from "node:assert/strict";
import test from "node:test";
import { buildDeliveryPublicCode, normalizeStoreCode, resolveDeliverySequenceDate } from "./deliveryPublicCode";

test("builds daily public code with store prefix, Sao Paulo date and padded number", () => {
  assert.equal(buildDeliveryPublicCode("AST", "2026-05-17", 7), "AST-20260517-007");
});

test("normalizes store code before exposing the delivery number", () => {
  assert.equal(normalizeStoreCode("Santo Antônio"), "SANTOA");
  assert.equal(normalizeStoreCode(""), "LOJA");
});

test("resolves sequence date using America/Sao_Paulo operational day", () => {
  const sequenceDate = resolveDeliverySequenceDate(new Date("2026-05-17T02:30:00.000Z"));

  assert.equal(sequenceDate.key, "2026-05-16");
  assert.equal(sequenceDate.date.toISOString(), "2026-05-16T00:00:00.000Z");
});
