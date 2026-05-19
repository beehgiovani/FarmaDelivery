import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { deliveryStatusLabel } from "./deliveryStatusLabels";

describe("deliveryStatusLabel", () => {
  it("maps known delivery statuses to readable labels", () => {
    assert.equal(deliveryStatusLabel("AGUARDANDO_MOTOBOY"), "Disponivel");
    assert.equal(deliveryStatusLabel("ACEITA_PELO_MOTOBOY"), "Aceita");
    assert.equal(deliveryStatusLabel("EM_ROTA"), "Em rota");
  });

  it("formats unknown delivery statuses without raw underscores", () => {
    assert.equal(deliveryStatusLabel("NOVO_STATUS"), "Novo status");
  });

  it("uses a safe fallback for blank delivery statuses", () => {
    assert.equal(deliveryStatusLabel("   "), "Status desconhecido");
  });
});
