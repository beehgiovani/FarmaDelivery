import assert from "node:assert/strict";
import test from "node:test";
import {
  buildNotificationSummary,
  buildTokenDeviceSummary,
  buildTokenPlatformSummary,
  parseNotificationEventLimit,
} from "./routes/notifications";

test("aggregates notification summary from recent audited events", () => {
  withScheduledNotificationEnv(undefined, undefined, () => {
    const summary = buildNotificationSummary(4, 2, [
      {
        id: "event-1",
        deliveryId: "delivery-1",
        metadata: {
          notificationType: "NEW_DELIVERY_AVAILABLE",
          sent: 3,
          failed: 1,
          inactiveTokens: 1,
          targetCouriers: 4,
          couriersWithoutTokens: 2,
        },
        createdAt: new Date("2026-05-16T10:00:00.000Z"),
        delivery: {
          publicCode: "FD-001",
          store: {
            name: "Asturias",
          },
        },
      },
      {
        id: "event-2",
        deliveryId: "delivery-2",
        metadata: {
          sent: 1,
          failed: 0,
          targetCouriers: 1,
        },
        createdAt: "2026-05-16T11:00:00.000Z",
        Delivery: {
          publicCode: "FD-002",
          Store: {
            name: "Santa Rosa",
          },
        },
      },
    ]);

    assert.equal(summary.activeTokens, 4);
    assert.equal(summary.inactiveTokens, 2);
    assert.equal(summary.scheduledWorkerEnabled, true);
    assert.equal(summary.scheduledIntervalMs, 60_000);
    assert.deepEqual(summary.recentTotals, {
      sent: 4,
      failed: 1,
      inactiveTokens: 1,
      targetCouriers: 5,
      couriersWithoutTokens: 2,
    });
    assert.equal(summary.recentEvents[0].publicCode, "FD-001");
    assert.equal(summary.recentEvents[0].store, "Asturias");
    assert.equal(summary.recentEvents[0].createdAt, "2026-05-16T10:00:00.000Z");
    assert.equal(summary.recentEvents[1].notificationType, "NOTIFICACAO_ENVIADA");
    assert.equal(summary.recentEvents[1].store, "Santa Rosa");
  });
});

test("normalizes malformed notification metadata and clamps scheduler interval", () => {
  withScheduledNotificationEnv("false", "1000", () => {
    const summary = buildNotificationSummary(0, 0, [
      {
        id: "event-1",
        deliveryId: "delivery-1",
        metadata: "metadata-malformado",
        createdAt: "2026-05-16T12:00:00.000Z",
      },
      {
        id: "event-2",
        deliveryId: "delivery-2",
        metadata: ["nao", "objeto"],
        createdAt: "2026-05-16T13:00:00.000Z",
      },
    ]);

    assert.equal(summary.scheduledWorkerEnabled, false);
    assert.equal(summary.scheduledIntervalMs, 15_000);
    assert.deepEqual(summary.recentTotals, {
      sent: 0,
      failed: 0,
      inactiveTokens: 0,
      targetCouriers: 0,
      couriersWithoutTokens: 0,
    });
    assert.equal(summary.recentEvents[0].notificationType, "NOTIFICACAO_ENVIADA");
  });
});

test("normalizes invalid notification metric values to zero", () => {
  const summary = buildNotificationSummary(0, 0, [
    {
      id: "event-1",
      deliveryId: "delivery-1",
      metadata: {
        sent: "invalid",
        failed: Number.NaN,
        inactiveTokens: -1,
        targetCouriers: "2",
        couriersWithoutTokens: undefined,
      },
      createdAt: "2026-05-16T12:00:00.000Z",
    },
  ]);

  assert.deepEqual(summary.recentTotals, {
    sent: 0,
    failed: 0,
    inactiveTokens: 0,
    targetCouriers: 2,
    couriersWithoutTokens: 0,
  });
  assert.deepEqual(
    {
      sent: summary.recentEvents[0].sent,
      failed: summary.recentEvents[0].failed,
      inactiveTokens: summary.recentEvents[0].inactiveTokens,
      targetCouriers: summary.recentEvents[0].targetCouriers,
      couriersWithoutTokens: summary.recentEvents[0].couriersWithoutTokens,
    },
    summary.recentTotals,
  );
});

test("parses notification event limit with safe bounds", () => {
  assert.equal(parseNotificationEventLimit(undefined), 10);
  assert.equal(parseNotificationEventLimit("25"), 25);
  assert.equal(parseNotificationEventLimit("0"), 1);
  assert.equal(parseNotificationEventLimit("-10"), 1);
  assert.equal(parseNotificationEventLimit("999"), 100);
  assert.equal(parseNotificationEventLimit("invalid"), 10);
});

test("summarizes courier device tokens by platform without exposing token values", () => {
  const rows = buildTokenPlatformSummary([
    { platform: "android", active: true, count: 3 },
    { platform: "android", active: false, count: 1 },
    { platform: "web", active: true, count: 2 },
    { platform: "", active: true, count: 1 },
  ]);

  assert.deepEqual(rows, [
    { platform: "android", active: 3, inactive: 1, total: 4 },
    { platform: "web", active: 2, inactive: 0, total: 2 },
    { platform: "desconhecida", active: 1, inactive: 0, total: 1 },
  ]);
});

test("summarizes courier notification devices without exposing token values", () => {
  const rows = buildTokenDeviceSummary([
    {
      id: "device-1",
      courierId: "courier-1",
      platform: "android",
      active: true,
      lastSeenAt: new Date("2026-05-16T14:00:00.000Z"),
      updatedAt: "2026-05-16T14:05:00.000Z",
      courier: {
        baseStoreName: "Asturias",
        user: {
          name: "Carlos Motoboy",
        },
      },
    },
    {
      id: "device-2",
      courierId: "courier-2",
      platform: "",
      active: false,
      lastSeenAt: null,
      updatedAt: null,
    },
  ]);

  assert.deepEqual(rows, [
    {
      id: "device-1",
      courierId: "courier-1",
      courierName: "Carlos Motoboy",
      baseStoreName: "Asturias",
      platform: "android",
      active: true,
      lastSeenAt: "2026-05-16T14:00:00.000Z",
      updatedAt: "2026-05-16T14:05:00.000Z",
    },
    {
      id: "device-2",
      courierId: "courier-2",
      courierName: "Motoboy nao informado",
      baseStoreName: "",
      platform: "desconhecida",
      active: false,
      lastSeenAt: null,
      updatedAt: null,
    },
  ]);

  assert.equal(JSON.stringify(rows).includes("token"), false);
});

function withScheduledNotificationEnv(worker: string | undefined, interval: string | undefined, run: () => void) {
  const previousWorker = process.env.SCHEDULED_DELIVERY_NOTIFICATION_WORKER;
  const previousInterval = process.env.SCHEDULED_DELIVERY_NOTIFICATION_INTERVAL_MS;

  setOrDeleteEnv("SCHEDULED_DELIVERY_NOTIFICATION_WORKER", worker);
  setOrDeleteEnv("SCHEDULED_DELIVERY_NOTIFICATION_INTERVAL_MS", interval);

  try {
    run();
  } finally {
    setOrDeleteEnv("SCHEDULED_DELIVERY_NOTIFICATION_WORKER", previousWorker);
    setOrDeleteEnv("SCHEDULED_DELIVERY_NOTIFICATION_INTERVAL_MS", previousInterval);
  }
}

function setOrDeleteEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}
