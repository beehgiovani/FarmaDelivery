import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { deliveryPriorityLabel } from "./deliveryPriorityLabels";

describe("deliveryPriorityLabel", () => {
  it("maps known delivery priorities to readable labels", () => {
    assert.equal(deliveryPriorityLabel("NORMAL"), "Normal");
    assert.equal(deliveryPriorityLabel("URGENTE"), "Urgente");
    assert.equal(deliveryPriorityLabel("RETORNO"), "Retorno");
  });

  it("formats unknown delivery priorities without raw underscores", () => {
    assert.equal(deliveryPriorityLabel("MUITO_URGENTE"), "Muito urgente");
  });

  it("uses a safe fallback for blank delivery priorities", () => {
    assert.equal(deliveryPriorityLabel("   "), "Prioridade desconhecida");
  });
});
