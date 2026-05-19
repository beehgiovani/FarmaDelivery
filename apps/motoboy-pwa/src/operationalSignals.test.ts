import assert from "node:assert/strict";
import test from "node:test";
import {
  canTrackOpenAppLocation,
  shouldSendTrackedLocation,
  summarizeOperationalChanges,
  summarizeOperationalChangesForAvailability,
} from "./operationalSignals";
import type { Delivery } from "./types";

test("does not notify on initial delivery load", () => {
  assert.equal(summarizeOperationalChanges([], [delivery({ id: "delivery-1" })]), null);
});

test("notifies when a delivery becomes available", () => {
  const previous = [delivery({ id: "delivery-1", status: "RASCUNHO" })];
  const next = [delivery({ id: "delivery-1", status: "AGUARDANDO_MOTOBOY", publicCode: "AST-20260517-009", storeDailyNumber: 9 })];

  assert.deepEqual(summarizeOperationalChanges(previous, next), {
    title: "Nova entrega disponivel",
    body: "N. dia 009 - Cliente Teste",
  });
});

test("does not notify new available deliveries while courier is unavailable", () => {
  const previous = [delivery({ id: "delivery-1", status: "RASCUNHO" })];
  const next = [delivery({ id: "delivery-1", status: "AGUARDANDO_MOTOBOY", publicCode: "FD-001" })];

  assert.equal(summarizeOperationalChangesForAvailability(previous, next, false), null);
});

test("notifies when an active delivery changes status", () => {
  const previous = [delivery({ id: "delivery-1", status: "EM_ROTA" })];
  const next = [delivery({ id: "delivery-1", status: "CANCELADA", publicCode: "AST-20260517-009", storeDailyNumber: 9 })];

  assert.deepEqual(summarizeOperationalChanges(previous, next), {
    title: "Entrega atualizada",
    body: "N. dia 009 agora esta como Cancelada.",
  });
});

test("throttles tracked location when time and displacement are small", () => {
  const lastLocation = {
    latitude: -23.961,
    longitude: -46.333,
    sentAt: 1000,
  };

  assert.equal(shouldSendTrackedLocation(lastLocation, -23.96101, -46.33301, 2000), false);
});

test("sends tracked location after interval or meaningful displacement", () => {
  const lastLocation = {
    latitude: -23.961,
    longitude: -46.333,
    sentAt: 1000,
  };

  assert.equal(shouldSendTrackedLocation(lastLocation, -23.96101, -46.33301, 32000), true);
  assert.equal(shouldSendTrackedLocation(lastLocation, -23.962, -46.333, 2000), true);
});

test("only allows open-app tracking while courier is available", () => {
  assert.equal(
    canTrackOpenAppLocation({
      hasSession: true,
      hasCourier: true,
      trackingEnabled: true,
      available: true,
    }),
    true,
  );

  assert.equal(
    canTrackOpenAppLocation({
      hasSession: true,
      hasCourier: true,
      trackingEnabled: true,
      available: false,
    }),
    false,
  );
});

function delivery(overrides: Partial<Delivery> = {}): Delivery {
  return {
    id: "delivery-1",
    publicCode: "FD-001",
    store: "Loja 1",
    customer: "Cliente Teste",
    phone: "13999999999",
    address: "Rua Teste, 123",
    status: "AGUARDANDO_MOTOBOY",
    courier: "",
    createdAt: "2026-05-15T12:00:00.000Z",
    acceptedAt: null,
    collectedAt: null,
    deliveredAt: null,
    canceledAt: null,
    earliestDispatchAt: null,
    priority: "NORMAL",
    coordinates: null,
    ...overrides,
  };
}
