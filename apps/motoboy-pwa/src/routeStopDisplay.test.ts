import assert from "node:assert/strict";
import test from "node:test";
import { routeStopDetails, routeStopTitle } from "./routeStopDisplay";
import type { CourierRoute } from "./types";

test("uses delivery public code as route stop title when available", () => {
  assert.equal(routeStopTitle(stop({ publicCode: "FD-123" })), "FD-123");
});

test("uses store daily number as route stop title when available", () => {
  assert.equal(routeStopTitle(stop({ publicCode: "AST-20260517-009", storeDailyNumber: 9 })), "N. dia 009");
});

test("falls back to route stop type when delivery context is unavailable", () => {
  assert.equal(routeStopTitle(stop(null)), "Entrega");
});

test("shows customer and delivery status as route stop details", () => {
  assert.equal(routeStopDetails(stop({ customer: "Maria", status: "EM_ROTA" })), "Maria - Em rota");
});

test("keeps full public code in route stop details when title uses daily number", () => {
  assert.equal(
    routeStopDetails(stop({ publicCode: "AST-20260517-009", storeDailyNumber: 9, customer: "Maria", status: "EM_ROTA" })),
    "AST-20260517-009 - Maria - Em rota",
  );
});

test("falls back to delivery status when customer is blank", () => {
  assert.equal(routeStopDetails(stop({ customer: "  ", status: "AGUARDANDO_MOTOBOY" })), "Disponivel");
});

test("omits route stop details when delivery context is unavailable", () => {
  assert.equal(routeStopDetails(stop(null)), null);
});

function stop(
  delivery: Partial<NonNullable<CourierRoute["stops"][number]["delivery"]>> | null,
): CourierRoute["stops"][number] {
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
          publicCode: delivery.publicCode ?? "FD-001",
          storeDailyNumber: delivery.storeDailyNumber ?? null,
          customer: delivery.customer ?? "Cliente Teste",
          status: delivery.status ?? "AGUARDANDO_MOTOBOY",
        }
      : null,
  };
}
