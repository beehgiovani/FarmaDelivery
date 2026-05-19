import assert from "node:assert/strict";
import test from "node:test";
import { deliverySections } from "./deliverySections";
import type { Delivery } from "./types";

test("groups only waiting deliveries as available", () => {
  const sections = deliverySections([
    delivery("waiting", "AGUARDANDO_MOTOBOY"),
    delivery("accepted", "ACEITA_PELO_MOTOBOY"),
  ]);

  assert.deepEqual(sections.available.map((item) => item.id), ["waiting"]);
});

test("groups only operational in-progress deliveries as active", () => {
  const sections = deliverySections([
    delivery("accepted", "ACEITA_PELO_MOTOBOY"),
    delivery("collected", "COLETADA"),
    delivery("route", "EM_ROTA"),
    delivery("problem", "PROBLEMA"),
    delivery("delivered", "ENTREGUE"),
    delivery("canceled", "CANCELADA"),
    delivery("draft", "RASCUNHO"),
  ]);

  assert.deepEqual(sections.active.map((item) => item.id), ["accepted", "collected", "route", "problem"]);
});

function delivery(id: string, status: Delivery["status"]): Delivery {
  return {
    id,
    publicCode: `FD-${id}`,
    store: "Drogaria Santo Antonio",
    customer: "Cliente Teste",
    phone: "11999999999",
    address: "Rua Teste, 123",
    status,
    courier: "",
    createdAt: "2026-05-15T00:00:00.000Z",
    acceptedAt: null,
    collectedAt: null,
    deliveredAt: null,
    canceledAt: null,
    earliestDispatchAt: null,
    priority: "NORMAL",
    coordinates: null,
  };
}
