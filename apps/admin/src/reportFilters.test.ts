import assert from "node:assert/strict";
import test from "node:test";
import { countReportRows, emptyDeliveryReportFilters, filterDeliveriesForReport, hasDeliveryReportFilters } from "./reportFilters";
import type { Delivery } from "./types";

test("filters delivery report rows by status, priority, proof state and map point", () => {
  const deliveries = [
    makeDelivery({ id: "waiting-normal", status: "Aguardando", priority: "Normal", proofCount: 0 }),
    makeDelivery({ id: "delivered-urgent-proof", status: "Entregue", priority: "Urgente", proofCount: 1, coordinates: { lat: -24, lng: -46 }, attendantName: "Ana Balc\u00e3o" }),
    makeDelivery({ id: "delivered-urgent-no-proof", status: "Entregue", priority: "Urgente", proofCount: 0, attendantName: "Bruno Balcao" }),
    makeDelivery({ id: "delivered-return", status: "Entregue", priority: "Retorno", proofCount: 1 }),
  ];

  assert.deepEqual(filterDeliveriesForReport(deliveries, emptyDeliveryReportFilters).map((delivery) => delivery.id), [
    "waiting-normal",
    "delivered-urgent-proof",
    "delivered-urgent-no-proof",
    "delivered-return",
  ]);
  assert.deepEqual(
    filterDeliveriesForReport(deliveries, { status: "Entregue", priority: "Urgente", proof: "com", mapPoint: "", attendant: "" }).map((delivery) => delivery.id),
    ["delivered-urgent-proof"],
  );
  assert.deepEqual(
    filterDeliveriesForReport(deliveries, { status: "Entregue", priority: "Urgente", proof: "sem", mapPoint: "", attendant: "" }).map((delivery) => delivery.id),
    ["delivered-urgent-no-proof"],
  );
  assert.deepEqual(
    filterDeliveriesForReport(deliveries, { status: "Entregue", priority: "Urgente", proof: "", mapPoint: "com", attendant: "" }).map((delivery) => delivery.id),
    ["delivered-urgent-proof"],
  );
  assert.deepEqual(
    filterDeliveriesForReport(deliveries, { status: "Entregue", priority: "Urgente", proof: "", mapPoint: "sem", attendant: "" }).map((delivery) => delivery.id),
    ["delivered-urgent-no-proof"],
  );
  assert.deepEqual(
    filterDeliveriesForReport(deliveries, { status: "Entregue", priority: "Urgente", proof: "", mapPoint: "", attendant: "ana balcao" }).map((delivery) => delivery.id),
    ["delivered-urgent-proof"],
  );
});

test("detects active delivery report filters", () => {
  assert.equal(hasDeliveryReportFilters(emptyDeliveryReportFilters), false);
  assert.equal(hasDeliveryReportFilters({ status: "Problema", priority: "", proof: "", mapPoint: "", attendant: "" }), true);
  assert.equal(hasDeliveryReportFilters({ status: "", priority: "Retorno", proof: "", mapPoint: "", attendant: "" }), true);
  assert.equal(hasDeliveryReportFilters({ status: "", priority: "", proof: "sem", mapPoint: "", attendant: "" }), true);
  assert.equal(hasDeliveryReportFilters({ status: "", priority: "", proof: "", mapPoint: "sem", attendant: "" }), true);
  assert.equal(hasDeliveryReportFilters({ status: "", priority: "", proof: "", mapPoint: "", attendant: "Ana" }), true);
});

test("counts report rows sorted by volume and label", () => {
  assert.deepEqual(countReportRows(["Urgente", "Normal", "Urgente", "Retorno", "Normal"]), [
    { label: "Normal", count: 2 },
    { label: "Urgente", count: 2 },
    { label: "Retorno", count: 1 },
  ]);
});

function makeDelivery(overrides: Partial<Delivery> = {}): Delivery {
  return {
    id: "delivery",
    store: "Asturias",
    customer: "Maria",
    phone: "(13) 99999-0000",
    address: "Av. dos Caicaras, 1171 - Asturias",
    status: "Aguardando",
    courier: "Joao",
    createdAt: "16/05, 10:00",
    rawCreatedAt: "2026-05-16T10:00:00.000Z",
    scheduledFor: "Agora",
    priority: "Normal",
    distanceHint: "Aguardando rota",
    proofCount: 0,
    ...overrides,
    deadlineTier: overrides.deadlineTier ?? "Medio",
  };
}
