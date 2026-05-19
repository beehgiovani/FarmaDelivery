import assert from "node:assert/strict";
import test from "node:test";
import { buildReportMapSummary } from "./reportMapSummary";

test("summarizes deliveries with and without map point for reports", () => {
  assert.deepEqual(
    buildReportMapSummary([
      { coordinates: { lat: -24.003825377135037, lng: -46.27390399967142 } },
      { coordinates: undefined },
      { coordinates: { lat: -23.997109238797034, lng: -46.281454771363265 } },
    ]),
    {
      withMapPoint: 2,
      withoutMapPoint: 1,
    },
  );
});

test("summarizes empty report map state safely", () => {
  assert.deepEqual(buildReportMapSummary([]), {
    withMapPoint: 0,
    withoutMapPoint: 0,
  });
});
