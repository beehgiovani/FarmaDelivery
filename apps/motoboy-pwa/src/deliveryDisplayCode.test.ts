import assert from "node:assert/strict";
import test from "node:test";
import { deliveryDailyNumberLabel, deliveryPrimaryCodeLabel } from "./deliveryDisplayCode";

test("formats store daily number with leading zeros", () => {
  assert.equal(deliveryDailyNumberLabel({ publicCode: "AST-20260517-009", storeDailyNumber: 9 }), "N. dia 009");
});

test("uses daily number as primary label when available", () => {
  assert.equal(deliveryPrimaryCodeLabel({ publicCode: "AST-20260517-009", storeDailyNumber: 9 }), "N. dia 009");
});

test("falls back to public code for older deliveries without daily number", () => {
  assert.equal(deliveryDailyNumberLabel({ publicCode: "ENT-000001" }), null);
  assert.equal(deliveryPrimaryCodeLabel({ publicCode: "ENT-000001" }), "ENT-000001");
});
