import assert from "node:assert/strict";
import test from "node:test";
import { buildOperationsMapDeliverySummary } from "./operationsMapSummary";

test("summarizes map deliveries when all filtered deliveries have coordinates", () => {
  assert.equal(buildOperationsMapDeliverySummary({ total: 4, located: 4 }), "4 entregas no filtro - 4 no mapa");
});

test("summarizes map deliveries with missing coordinates", () => {
  assert.equal(buildOperationsMapDeliverySummary({ total: 5, located: 3 }), "5 entregas no filtro - 3 no mapa - 2 sem ponto");
});

test("keeps map delivery summary safe for inconsistent counts", () => {
  assert.equal(buildOperationsMapDeliverySummary({ total: 2, located: 8 }), "2 entregas no filtro - 2 no mapa");
  assert.equal(buildOperationsMapDeliverySummary({ total: -1, located: -3 }), "0 entregas no filtro - 0 no mapa");
});
