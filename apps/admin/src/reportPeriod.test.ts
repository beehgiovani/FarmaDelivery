import assert from "node:assert/strict";
import test from "node:test";
import {
  activeReportPeriodPreset,
  buildReportDateRangePreset,
  deliveryMatchesReportDateRange,
  isReportDateRangeValid,
  reportDateLabel,
} from "./reportPeriod";
import type { Delivery } from "./types";

test("matches delivery report date range across operational timestamps", () => {
  const delivery = makeDelivery({
    rawCreatedAt: "2026-05-14T22:00:00.000Z",
    rawDeliveredAt: "2026-05-16T12:00:00.000Z",
  });

  assert.equal(deliveryMatchesReportDateRange(delivery, { startsAt: "2026-05-16", endsAt: "2026-05-16" }), true);
  assert.equal(deliveryMatchesReportDateRange(delivery, { startsAt: "2026-05-15", endsAt: "2026-05-17" }), true);
  assert.equal(deliveryMatchesReportDateRange(delivery, { startsAt: "2026-05-17", endsAt: "2026-05-18" }), false);
});

test("rejects inverted report date range and formats report labels", () => {
  assert.equal(deliveryMatchesReportDateRange(makeDelivery(), { startsAt: "2026-05-17", endsAt: "2026-05-16" }), false);
  assert.equal(isReportDateRangeValid({ startsAt: "2026-05-17", endsAt: "2026-05-16" }), false);
  assert.equal(isReportDateRangeValid({ startsAt: "2026-05-16", endsAt: "2026-05-17" }), true);
  assert.equal(reportDateLabel({ startsAt: "2026-05-16", endsAt: "2026-05-16" }), "2026-05-16");
  assert.equal(reportDateLabel({ startsAt: "2026-05-15", endsAt: "2026-05-16" }), "2026-05-15_a_2026-05-16");
  assert.equal(reportDateLabel({ startsAt: "", endsAt: "" }), "periodo");
});

test("builds report period presets from reference date", () => {
  const reference = new Date(2026, 4, 16);

  assert.deepEqual(buildReportDateRangePreset("hoje", reference), {
    startsAt: "2026-05-16",
    endsAt: "2026-05-16",
  });
  assert.deepEqual(buildReportDateRangePreset("7dias", reference), {
    startsAt: "2026-05-10",
    endsAt: "2026-05-16",
  });
  assert.deepEqual(buildReportDateRangePreset("mes", reference), {
    startsAt: "2026-05-01",
    endsAt: "2026-05-16",
  });
  assert.equal(activeReportPeriodPreset({ startsAt: "2026-05-10", endsAt: "2026-05-16" }, reference), "7dias");
  assert.equal(activeReportPeriodPreset({ startsAt: "2026-05-02", endsAt: "2026-05-16" }, reference), "");
});

function makeDelivery(overrides: Partial<Delivery> = {}): Delivery {
  return {
    id: "delivery",
    store: "Asturias",
    customer: "Maria",
    phone: "(13) 99999-0000",
    address: "Av dos Caicaras, 1171",
    status: "Entregue",
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
