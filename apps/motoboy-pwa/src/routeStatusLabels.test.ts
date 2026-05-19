import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { routeStatusLabel } from "./routeStatusLabels";

describe("routeStatusLabel", () => {
  it("maps known route statuses to readable labels", () => {
    assert.equal(routeStatusLabel("ABERTA"), "Aberta");
    assert.equal(routeStatusLabel("EM_ANDAMENTO"), "Em andamento");
    assert.equal(routeStatusLabel("FINALIZADA"), "Finalizada");
    assert.equal(routeStatusLabel("CANCELADA"), "Cancelada");
  });

  it("formats unknown route statuses without raw underscores", () => {
    assert.equal(routeStatusLabel("PAUSADA_TEMPORARIA"), "Pausada temporaria");
  });

  it("uses a safe fallback for blank route statuses", () => {
    assert.equal(routeStatusLabel("   "), "Status desconhecido");
  });
});
