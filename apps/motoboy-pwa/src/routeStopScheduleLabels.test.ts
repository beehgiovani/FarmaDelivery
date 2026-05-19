import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { routeStopScheduleLabel } from "./routeStopScheduleLabels";

describe("routeStopScheduleLabel", () => {
  it("formats ISO route stop schedule timestamps for display", () => {
    assert.equal(routeStopScheduleLabel("2026-05-15T12:30:00.000Z"), "A partir de 15/05, 09:30");
  });

  it("falls back to a compact raw timestamp when parsing fails", () => {
    assert.equal(routeStopScheduleLabel("2026-05-15T12:30 sem timezone"), "A partir de 2026-05-15 12:30");
  });

  it("returns null for blank route stop schedule timestamps", () => {
    assert.equal(routeStopScheduleLabel("   "), null);
    assert.equal(routeStopScheduleLabel(null), null);
  });
});
