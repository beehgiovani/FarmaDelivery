import assert from "node:assert/strict";
import test from "node:test";
import { motoboyOperationalStatus } from "./motoboyOperationalStatus";

test("shows paused status when courier is unavailable", () => {
  const status = motoboyOperationalStatus({ available: false, trackingEnabled: true });

  assert.equal(status.tone, "paused");
  assert.equal(status.title, "Corridas paradas");
});

test("shows available status when courier can accept deliveries", () => {
  const status = motoboyOperationalStatus({ available: true, trackingEnabled: false });

  assert.equal(status.tone, "ready");
  assert.equal(status.title, "Recebendo corridas");
});

test("shows automatic GPS status when open-app tracking is active", () => {
  const status = motoboyOperationalStatus({ available: true, trackingEnabled: true });

  assert.equal(status.tone, "active");
  assert.equal(status.title, "Recebendo corridas");
});
