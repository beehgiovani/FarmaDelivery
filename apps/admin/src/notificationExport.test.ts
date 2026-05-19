import assert from "node:assert/strict";
import test from "node:test";
import {
  buildNotificationEventsCsv,
  filterNotificationEvents,
  hasNotificationProblem,
  isNotificationDateRangeValid,
  isNotificationEventInDateRange,
} from "./notificationExport";
import type { NotificationSummary } from "./types";

test("exports notification audit csv without device tokens", () => {
  const summary = makeSummary({
    tokenPlatforms: [
      {
        platform: "android",
        active: 3,
        inactive: 1,
        total: 4,
      },
    ],
    tokenDevices: [
      {
        id: "device-1",
        courierId: "courier-1",
        courierName: "Carlos Motoboy",
        baseStoreName: "Asturias",
        platform: "android",
        active: true,
        lastSeenAt: "2026-05-16T10:00:00.000Z",
        updatedAt: "2026-05-16T10:05:00.000Z",
      },
    ],
    recentEvents: [
      {
        id: "event-1",
        deliveryId: "delivery-1",
        publicCode: "FD-001",
        store: "Asturias",
        notificationType: "NEW_DELIVERY_AVAILABLE",
        sent: 3,
        failed: 1,
        inactiveTokens: 1,
        targetCouriers: 4,
        couriersWithoutTokens: 2,
        createdAt: "2026-05-16T10:00:00.000Z",
      },
    ],
  });

  const csv = buildNotificationEventsCsv(summary);

  assert.match(csv, /"codigo_entrega"/);
  assert.match(csv, /"FD-001"/);
  assert.match(csv, /"motoboys_sem_token"/);
  assert.match(csv, /"tokens_por_plataforma"/);
  assert.match(csv, /"android","3","1","4"/);
  assert.match(csv, /"dispositivos_por_motoboy"/);
  assert.match(csv, /"device-1","courier-1","Carlos Motoboy","Asturias","android","sim"/);
  assert.doesNotMatch(csv.toLowerCase(), /token_dispositivo|device_token|fcm|registration/);
});

test("exports notification audit csv with filter context", () => {
  const summary = makeSummary({
    recentEvents: [
      makeEvent({
        id: "filtered-event",
        publicCode: "FD-009",
      }),
    ],
  });

  const csv = buildNotificationEventsCsv(summary, {
    generatedAt: "2026-05-16T12:00:00.000Z",
    loadedEvents: 10,
    visibleEvents: 1,
    filter: "problemas",
    store: "Asturias",
    type: "NEW_DELIVERY_AVAILABLE",
    startsAt: "2026-05-16",
    endsAt: "2026-05-16",
  });

  assert.match(csv, /"contexto_exportacao"/);
  assert.match(csv, /"gerado_em","2026-05-16T12:00:00.000Z"/);
  assert.match(csv, /"eventos_carregados","10"/);
  assert.match(csv, /"eventos_visiveis","1"/);
  assert.match(csv, /"filtro","problemas"/);
  assert.match(csv, /"loja","Asturias"/);
  assert.match(csv, /"tipo","NEW_DELIVERY_AVAILABLE"/);
  assert.match(csv, /"data_inicial","2026-05-16"/);
});

test("escapes notification audit csv cells", () => {
  const summary = makeSummary({
    recentEvents: [
      {
        id: "event-1",
        deliveryId: "delivery-1",
        publicCode: 'FD-"001"',
        store: 'Asturias, "principal"',
        notificationType: "NEW_DELIVERY_AVAILABLE",
        sent: 1,
        failed: 0,
        inactiveTokens: 0,
        targetCouriers: 1,
        couriersWithoutTokens: 0,
        createdAt: "2026-05-16T10:00:00.000Z",
      },
    ],
  });

  const csv = buildNotificationEventsCsv(summary);

  assert.match(csv, /"FD-""001"""/);
  assert.match(csv, /"Asturias, ""principal"""/);
});

test("escapes spreadsheet formulas in notification audit csv", () => {
  const summary = makeSummary({
    tokenDevices: [
      {
        id: "=device",
        courierId: "+courier",
        courierName: "@Carlos",
        baseStoreName: "-Asturias",
        platform: "android",
        active: true,
        lastSeenAt: "2026-05-16T10:00:00.000Z",
        updatedAt: "2026-05-16T10:05:00.000Z",
      },
    ],
    recentEvents: [
      makeEvent({
        id: "=event",
        publicCode: "+FD-001",
        store: "@Asturias",
      }),
    ],
  });

  const csv = buildNotificationEventsCsv(summary);

  assert.match(csv, /"'=event"/);
  assert.match(csv, /"'\+FD-001","'@Asturias"/);
  assert.match(csv, /"'=device","'\+courier","'@Carlos","'-Asturias"/);
});

test("detects notification problem events", () => {
  assert.equal(hasNotificationProblem(makeEvent({ failed: 1 })), true);
  assert.equal(hasNotificationProblem(makeEvent({ inactiveTokens: 1 })), true);
  assert.equal(hasNotificationProblem(makeEvent({ couriersWithoutTokens: 1 })), true);
  assert.equal(hasNotificationProblem(makeEvent()), false);
});

test("filters notification events by problem state", () => {
  const ok = makeEvent({ id: "ok" });
  const failed = makeEvent({ id: "failed", failed: 1 });
  const noToken = makeEvent({ id: "no-token", couriersWithoutTokens: 1 });
  const events = [ok, failed, noToken];

  assert.deepEqual(filterNotificationEvents(events, "todos"), events);
  assert.deepEqual(
    filterNotificationEvents(events, "problemas").map((event) => event.id),
    ["failed", "no-token"],
  );
});

test("filters notification events by store and problem state together", () => {
  const centralOk = makeEvent({ id: "central-ok", store: "Asturias" });
  const centralFailed = makeEvent({ id: "central-failed", store: "Asturias", failed: 1 });
  const perequeFailed = makeEvent({ id: "pereque-failed", store: "Loja Pereque", failed: 1 });
  const events = [centralOk, centralFailed, perequeFailed];

  assert.deepEqual(
    filterNotificationEvents(events, "todos", "Asturias").map((event) => event.id),
    ["central-ok", "central-failed"],
  );
  assert.deepEqual(
    filterNotificationEvents(events, "problemas", "Asturias").map((event) => event.id),
    ["central-failed"],
  );
});

test("filters notification events by date range", () => {
  const oldEvent = makeEvent({ id: "old", createdAt: "2026-05-14T23:59:59.000Z" });
  const firstDay = makeEvent({ id: "first-day", createdAt: "2026-05-15T10:00:00.000Z" });
  const secondDay = makeEvent({ id: "second-day", createdAt: "2026-05-16T10:00:00.000Z" });
  const events = [oldEvent, firstDay, secondDay];

  assert.deepEqual(
    filterNotificationEvents(events, "todos", "", { startsAt: "2026-05-15", endsAt: "2026-05-15" }).map((event) => event.id),
    ["first-day"],
  );
  assert.equal(isNotificationEventInDateRange("data-invalida", { startsAt: "2026-05-15" }), false);
});

test("rejects inverted notification date range before filtering", () => {
  const events = [makeEvent({ id: "event-1", createdAt: "2026-05-16T10:00:00.000Z" })];
  const invertedRange = { startsAt: "2026-05-17", endsAt: "2026-05-16" };

  assert.equal(isNotificationDateRangeValid(invertedRange), false);
  assert.deepEqual(filterNotificationEvents(events, "todos", "", invertedRange), []);
});

test("filters notification events by type", () => {
  const newDelivery = makeEvent({ id: "new-delivery", notificationType: "NEW_DELIVERY_AVAILABLE" });
  const canceled = makeEvent({ id: "canceled", notificationType: "DELIVERY_CANCELED" });
  const events = [newDelivery, canceled];

  assert.deepEqual(
    filterNotificationEvents(events, "todos", "", {}, "DELIVERY_CANCELED").map((event) => event.id),
    ["canceled"],
  );
});

function makeSummary(overrides: Partial<NotificationSummary>): NotificationSummary {
  return {
    configured: true,
    scheduledWorkerEnabled: true,
    scheduledIntervalMs: 60_000,
    activeTokens: 1,
    inactiveTokens: 0,
    tokenPlatforms: [],
    tokenDevices: [],
    recentTotals: {
      sent: 0,
      failed: 0,
      inactiveTokens: 0,
      targetCouriers: 0,
      couriersWithoutTokens: 0,
    },
    recentEvents: [],
    ...overrides,
  };
}

function makeEvent(
  overrides: Partial<NotificationSummary["recentEvents"][number]> = {},
): NotificationSummary["recentEvents"][number] {
  return {
    id: "event-1",
    deliveryId: "delivery-1",
    publicCode: "FD-001",
    store: "Asturias",
    notificationType: "NEW_DELIVERY_AVAILABLE",
    sent: 1,
    failed: 0,
    inactiveTokens: 0,
    targetCouriers: 1,
    couriersWithoutTokens: 0,
    createdAt: "2026-05-16T10:00:00.000Z",
    ...overrides,
  };
}
