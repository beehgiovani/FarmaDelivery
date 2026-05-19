import assert from "node:assert/strict";
import test from "node:test";
import { deliveryDeadlineWindowsMinutes, getDeliverySlaState, isDeliveryOverdue } from "./deliverySla";
import type { Delivery } from "./types";

const now = new Date("2026-05-15T15:00:00.000Z").getTime();

test("defines manual deadline windows", () => {
  assert.deepEqual(deliveryDeadlineWindowsMinutes, {
    Perto: { warning: 60, critical: 90 },
    Medio: { warning: 90, critical: 120 },
    Longe: { warning: 120, critical: 180 },
  });
});

test("marks active delivery warning at the first manual deadline limit", () => {
  const delivery = makeDelivery({
    status: "Aguardando",
    deadlineTier: "Perto",
    rawCreatedAt: "2026-05-15T14:00:00.000Z",
  });

  assert.equal(getDeliverySlaState(delivery, now), "warning");
  assert.equal(isDeliveryOverdue(delivery, now), false);
});

test("marks active delivery critical after the second manual deadline limit", () => {
  const delivery = makeDelivery({
    status: "Aguardando",
    deadlineTier: "Perto",
    rawCreatedAt: "2026-05-15T13:20:00.000Z",
  });

  assert.equal(getDeliverySlaState(delivery, now), "critical");
  assert.equal(isDeliveryOverdue(delivery, now), true);
});

test("does not mark active delivery before first manual deadline limit", () => {
  const delivery = makeDelivery({
    status: "Em rota",
    deadlineTier: "Longe",
    rawCreatedAt: "2026-05-15T13:15:00.000Z",
  });

  assert.equal(getDeliverySlaState(delivery, now), "ok");
});

test("uses scheduled time as SLA base when available", () => {
  const delivery = makeDelivery({
    status: "Aguardando",
    deadlineTier: "Perto",
    rawCreatedAt: "2026-05-15T13:00:00.000Z",
    rawScheduledFor: "2026-05-15T14:50:00.000Z",
  });

  assert.equal(getDeliverySlaState(delivery, now), "ok");
});

test("ignores terminal statuses", () => {
  const delivery = makeDelivery({
    status: "Entregue",
    rawCreatedAt: "2026-05-15T10:00:00.000Z",
  });

  assert.equal(isDeliveryOverdue(delivery, now), false);
});

function makeDelivery(overrides: Partial<Delivery>): Delivery {
  return {
    id: "delivery-1",
    store: "Loja 1",
    customer: "Cliente Teste",
    phone: "(13) 99999-0000",
    address: "Rua Teste, 123",
    status: "Aguardando",
    courier: "Sem motoboy",
    createdAt: "15/05, 11:00",
    rawCreatedAt: "2026-05-15T14:00:00.000Z",
    scheduledFor: "Agora",
    priority: "Normal",
    distanceHint: "Aguardando rota",
    ...overrides,
    deadlineTier: overrides.deadlineTier ?? "Medio",
  };
}
