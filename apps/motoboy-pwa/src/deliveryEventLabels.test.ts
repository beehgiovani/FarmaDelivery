import assert from "node:assert/strict";
import test from "node:test";
import { deliveryEventTypeLabel } from "./deliveryEventLabels";

test("maps known delivery event types to readable labels", () => {
  assert.equal(deliveryEventTypeLabel("SAIU_PARA_ENTREGA"), "Saiu para entrega");
  assert.equal(deliveryEventTypeLabel("ROTA_RECALCULADA"), "Rota recalculada");
  assert.equal(deliveryEventTypeLabel("NOTIFICACAO_ENVIADA"), "Notificacao enviada");
});

test("formats unknown delivery event types without exposing raw underscores", () => {
  assert.equal(deliveryEventTypeLabel("EVENTO_NOVO"), "Evento novo");
});

test("uses a safe fallback for blank delivery event types", () => {
  assert.equal(deliveryEventTypeLabel("   "), "Evento");
});
