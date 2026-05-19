import assert from "node:assert/strict";
import test from "node:test";
import { deliveryEventTimestampLabel } from "./deliveryEventTimestamps";

test("formats ISO delivery event timestamps for display", () => {
  assert.equal(deliveryEventTimestampLabel("2026-05-15T12:30:00.000Z"), "15/05, 09:30");
});

test("falls back to a compact raw timestamp when parsing fails", () => {
  assert.equal(deliveryEventTimestampLabel("2026-05-15T12:30 sem timezone"), "2026-05-15 12:30");
});
