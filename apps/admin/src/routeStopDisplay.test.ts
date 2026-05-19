import assert from "node:assert/strict";
import test from "node:test";
import { routeStopDetail, routeStopMapLabel, routeStopTitle } from "./routeStopDisplay";
import type { CourierRouteStop } from "./types";

test("uses delivery customer as route stop title when available", () => {
  assert.equal(routeStopTitle(stop({ customer: "Maria" })), "Maria");
});

test("falls back to route stop type as title when delivery context is unavailable", () => {
  assert.equal(routeStopTitle(stop(null)), "Entrega");
});

test("builds route stop detail with public code delivery status and stop status", () => {
  assert.equal(routeStopDetail(stop({ publicCode: "ENT-000001", status: "EM_ROTA" })), "ENT-000001 - Em rota - Pendente");
});

test("builds route stop map label with public code and customer", () => {
  assert.equal(routeStopMapLabel(stop({ publicCode: "ENT-000001", customer: "Maria" })), "ENT-000001 - Maria");
});

test("falls back route stop map label safely", () => {
  assert.equal(routeStopMapLabel(stop(null)), "Entrega");
});

function stop(delivery: Partial<NonNullable<CourierRouteStop["delivery"]>> | null): CourierRouteStop {
  return {
    id: "stop-1",
    sequence: 1,
    type: "ENTREGA",
    status: "PENDENTE",
    address: "Rua Teste",
    latitude: null,
    longitude: null,
    earliestAt: null,
    completedAt: null,
    delivery: delivery
      ? {
          id: "delivery-1",
          publicCode: delivery.publicCode ?? "ENT-000001",
          customer: delivery.customer ?? "Cliente Teste",
          status: delivery.status ?? "AGUARDANDO_MOTOBOY",
        }
      : null,
  };
}
