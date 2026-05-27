import assert from "node:assert/strict";
import test from "node:test";
import { buildOperationalAlerts } from "./operationalAlerts";
import type { Courier, Delivery } from "./types";

const now = new Date("2026-05-27T12:00:00.000Z").getTime();

test("builds alerts for waiting, late and problem deliveries", () => {
  const alerts = buildOperationalAlerts(
    [
      makeDelivery({ id: "waiting", status: "Aguardando", rawCreatedAt: "2026-05-27T11:00:00.000Z" }),
      makeDelivery({ id: "late", status: "Em rota", rawCreatedAt: "2026-05-27T09:30:00.000Z", courier: "Joao" }),
      makeDelivery({ id: "problem", status: "Problema", notes: "Acidente informado pelo motoboy" }),
    ],
    now,
  );

  assert.deepEqual(
    alerts.map((alert) => alert.id),
    ["waiting:waiting-courier", "late:late-with-courier", "problem:problem"],
  );
  assert.equal(alerts.every((alert) => alert.tone === "critical"), true);
});

test("does not alert completed or fresh waiting deliveries", () => {
  const alerts = buildOperationalAlerts(
    [
      makeDelivery({ id: "done", status: "Entregue", rawCreatedAt: "2026-05-27T08:00:00.000Z" }),
      makeDelivery({ id: "fresh", status: "Aguardando", rawCreatedAt: "2026-05-27T11:45:00.000Z" }),
    ],
    now,
  );

  assert.deepEqual(alerts, []);
});

test("alerts when active delivery courier GPS is stale", () => {
  const alerts = buildOperationalAlerts(
    [makeDelivery({ id: "route", status: "Em rota", courier: "Joao" })],
    now,
    [makeCourier({ name: "Joao", lastLocationAt: "2026-05-27T11:40:00.000Z" })],
  );

  assert.equal(alerts.some((alert) => alert.id === "route:courier-gps-stale"), true);
});

test("alerts accepted and picked deliveries waiting too long for next step", () => {
  const alerts = buildOperationalAlerts(
    [
      makeDelivery({ id: "accepted", status: "Aceita", courier: "Joao", rawCreatedAt: "2026-05-27T11:40:00.000Z" }),
      makeDelivery({ id: "picked", status: "Coletada", courier: "Joao", rawCreatedAt: "2026-05-27T11:40:00.000Z" }),
    ],
    now,
  );

  assert.equal(alerts.some((alert) => alert.id === "accepted:accepted-not-picked"), true);
  assert.equal(alerts.some((alert) => alert.id === "picked:picked-not-started"), true);
});

function makeDelivery(overrides: Partial<Delivery>): Delivery {
  return {
    id: overrides.id ?? "delivery",
    publicCode: overrides.publicCode ?? overrides.id ?? "delivery",
    store: overrides.store ?? "Loja",
    customer: overrides.customer ?? "Cliente",
    phone: "(13) 99999-0000",
    address: "Rua Teste, 123",
    status: overrides.status ?? "Aguardando",
    courier: overrides.courier ?? "",
    notes: overrides.notes ?? null,
    createdAt: "27/05/2026 09:00",
    rawCreatedAt: overrides.rawCreatedAt ?? "2026-05-27T09:00:00.000Z",
    scheduledFor: "Agora",
    rawScheduledFor: overrides.rawScheduledFor,
    priority: overrides.priority ?? "Normal",
    deadlineTier: overrides.deadlineTier ?? "Medio",
    distanceHint: "Sem distancia",
  };
}

function makeCourier(overrides: Partial<Courier>): Courier {
  return {
    id: overrides.id ?? "courier",
    name: overrides.name ?? "Joao",
    store: overrides.store ?? "Loja",
    status: overrides.status ?? "Em rota",
    deliveries: overrides.deliveries ?? 1,
    coordinates: overrides.coordinates ?? { lat: -23.96, lng: -46.33 },
    lastLocationAt: overrides.lastLocationAt,
  };
}
