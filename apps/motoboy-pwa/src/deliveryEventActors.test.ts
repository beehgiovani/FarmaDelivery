import assert from "node:assert/strict";
import test from "node:test";
import { deliveryEventActorLabel } from "./deliveryEventActors";

test("uses the event actor name when present", () => {
  assert.equal(
    deliveryEventActorLabel({
      actor: {
        id: "user-1",
        name: "Balconista Teste",
        role: "BALCONISTA_CAIXA",
      },
    }),
    "Balconista Teste",
  );
});

test("trims event actor names", () => {
  assert.equal(
    deliveryEventActorLabel({
      actor: {
        id: "user-1",
        name: "  Motoboy Teste  ",
        role: "MOTOBOY",
      },
    }),
    "Motoboy Teste",
  );
});

test("returns null when the event has no actor name", () => {
  assert.equal(deliveryEventActorLabel({ actor: null }), null);
  assert.equal(
    deliveryEventActorLabel({
      actor: {
        id: "user-1",
        name: "   ",
        role: "ADMIN",
      },
    }),
    null,
  );
});
