import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { deliveryCardDateLabel } from "./deliveryCardDateLabels";

describe("deliveryCardDateLabel", () => {
  it("formats ISO delivery card dates in Sao Paulo timezone", () => {
    assert.equal(deliveryCardDateLabel("2026-05-15T12:30:00.000Z"), "15/05, 09:30");
  });

  it("falls back to a compact raw timestamp when parsing fails", () => {
    assert.equal(deliveryCardDateLabel("2026-05-15T12:30 sem timezone"), "2026-05-15 12:30");
  });

  it("returns an empty label for blank delivery card dates", () => {
    assert.equal(deliveryCardDateLabel("   "), "");
  });
});
