import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { routeStopTypeLabel } from "./routeStopTypeLabels";

describe("routeStopTypeLabel", () => {
  it("maps known route stop types to readable labels", () => {
    assert.equal(routeStopTypeLabel("COLETA"), "Coleta");
    assert.equal(routeStopTypeLabel("ENTREGA"), "Entrega");
  });

  it("formats unknown route stop types without raw underscores", () => {
    assert.equal(routeStopTypeLabel("RETIRADA_EXTRA"), "Retirada extra");
  });

  it("uses a safe fallback for blank route stop types", () => {
    assert.equal(routeStopTypeLabel("   "), "Parada");
  });
});
