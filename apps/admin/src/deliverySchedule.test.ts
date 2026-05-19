import assert from "node:assert/strict";
import test from "node:test";
import { buildDeliveryScheduleSuggestion, formatDateTimeLocalInput } from "./deliverySchedule";

test("suggests the next full hour for same-day scheduled deliveries", () => {
  const now = new Date(2026, 4, 18, 14, 20, 30);
  assert.equal(buildDeliveryScheduleSuggestion("hoje", now), "2026-05-18T15:00");
});

test("suggests next day opening time for future scheduled deliveries", () => {
  const now = new Date(2026, 4, 18, 21, 45, 0);
  assert.equal(buildDeliveryScheduleSuggestion("futuro", now), "2026-05-19T08:00");
});

test("keeps immediate deliveries without scheduled datetime", () => {
  assert.equal(buildDeliveryScheduleSuggestion("agora", new Date(2026, 4, 18, 14, 20, 30)), "");
});

test("formats datetime-local without UTC conversion", () => {
  assert.equal(formatDateTimeLocalInput(new Date(2026, 11, 5, 8, 7, 0)), "2026-12-05T08:07");
});

test("uses selected store opening time when same-day suggestion is before opening", () => {
  const now = new Date(2026, 4, 18, 6, 20, 0);
  assert.equal(buildDeliveryScheduleSuggestion("hoje", now, buildWeekHours("08:30", "22:00")), "2026-05-18T08:30");
});

test("moves same-day suggestion to next opening when selected store is already closed", () => {
  const now = new Date(2026, 4, 18, 21, 45, 0);
  assert.equal(buildDeliveryScheduleSuggestion("hoje", now, buildWeekHours("08:00", "22:00")), "2026-05-19T08:00");
});

test("uses selected store opening time for future scheduled deliveries", () => {
  const now = new Date(2026, 4, 18, 21, 45, 0);
  assert.equal(buildDeliveryScheduleSuggestion("futuro", now, buildWeekHours("09:15", "22:00")), "2026-05-19T09:15");
});

function buildWeekHours(opensAt: string, closesAt: string) {
  return Array.from({ length: 7 }, (_, dayOfWeek) => ({
    dayOfWeek,
    opensAt,
    closesAt,
    closed: false,
  }));
}
