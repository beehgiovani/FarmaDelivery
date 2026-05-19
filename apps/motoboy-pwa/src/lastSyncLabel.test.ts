import assert from "node:assert/strict";
import test from "node:test";
import { lastSyncLabel } from "./lastSyncLabel";

test("shows a first update message before data sync", () => {
  assert.equal(lastSyncLabel(null), "Aguardando primeira atualizacao.");
});

test("shows current update message for recent sync", () => {
  const now = new Date("2026-05-18T15:00:30.000Z");
  const syncedAt = new Date("2026-05-18T15:00:00.000Z");

  assert.equal(lastSyncLabel(syncedAt, now), "Atualizado agora.");
});

test("formats the last sync time in Sao Paulo timezone", () => {
  const now = new Date("2026-05-18T15:10:00.000Z");
  const syncedAt = new Date("2026-05-18T14:00:00.000Z");

  assert.equal(lastSyncLabel(syncedAt, now), "Ultima atualizacao as 11:00.");
});
