import assert from "node:assert/strict";
import test from "node:test";
import { courierGpsHealth, gpsHealthSummary } from "./gpsHealth";

const now = new Date("2026-05-27T12:00:00.000Z").getTime();

test("labels current recent stale and missing GPS states", () => {
  assert.deepEqual(courierGpsHealth("2026-05-27T11:59:00.000Z", now), {
    tone: "fresh",
    label: "GPS agora",
    ageMinutes: 1,
  });
  assert.equal(courierGpsHealth("2026-05-27T11:54:00.000Z", now).label, "GPS ha 6 min");
  assert.equal(courierGpsHealth("2026-05-27T11:40:00.000Z", now).label, "GPS atrasado ha 20 min");
  assert.deepEqual(courierGpsHealth(null, now), {
    tone: "missing",
    label: "Sem GPS",
    ageMinutes: null,
  });
});

test("summarizes GPS health for the live panel", () => {
  assert.deepEqual(
    gpsHealthSummary(
      [
        { lastLocationAt: "2026-05-27T11:59:00.000Z" },
        { lastLocationAt: "2026-05-27T11:55:00.000Z" },
        { lastLocationAt: "2026-05-27T11:30:00.000Z" },
        { lastLocationAt: null },
      ],
      now,
    ),
    { fresh: 1, recent: 1, stale: 1, missing: 1 },
  );
});
