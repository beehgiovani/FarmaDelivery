import assert from "node:assert/strict";
import test from "node:test";
import { formatDateOnly, formatDeliveryMutationResponse } from "./deliveryMutationResponse";

test("formats mutation responses with store daily numbering", () => {
  const response = formatDeliveryMutationResponse({
    id: "delivery-1",
    publicCode: "AST-20260517-009",
    storeDailyDate: new Date("2026-05-17T03:00:00.000Z"),
    storeDailyNumber: 9,
    status: "ACEITA_PELO_MOTOBOY",
    acceptedAt: new Date("2026-05-17T12:30:00.000Z"),
    courier: {
      user: {
        name: "Joao",
      },
    },
    events: [
      {
        id: "event-1",
        type: "ACEITA",
        notes: "Entrega aceita pelo motoboy.",
        createdAt: new Date("2026-05-17T12:30:01.000Z"),
      },
    ],
  });

  assert.equal(response.publicCode, "AST-20260517-009");
  assert.equal(response.storeDailyDate, "2026-05-17");
  assert.equal(response.storeDailyNumber, 9);
  assert.equal(response.acceptedAt, "2026-05-17T12:30:00.000Z");
  assert.deepEqual(response.event, {
    id: "event-1",
    type: "ACEITA",
    notes: "Entrega aceita pelo motoboy.",
    createdAt: "2026-05-17T12:30:01.000Z",
  });
});

test("keeps REST mutation response dates as strings", () => {
  const response = formatDeliveryMutationResponse({
    id: "delivery-1",
    publicCode: "AST-20260517-009",
    storeDailyDate: "2026-05-17",
    storeDailyNumber: 9,
    status: "COLETADA",
    collectedAt: "2026-05-17T13:00:00.000Z",
    events: [],
  });

  assert.equal(response.storeDailyDate, "2026-05-17");
  assert.equal(response.collectedAt, "2026-05-17T13:00:00.000Z");
  assert.equal(response.courier, "Sem motoboy");
  assert.equal(response.event, null);
});

test("normalizes missing store daily date to null", () => {
  assert.equal(formatDateOnly(null), null);
  assert.equal(formatDateOnly(undefined), null);
});
