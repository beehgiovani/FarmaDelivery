import assert from "node:assert/strict";
import test from "node:test";
import { deliveryCompletionInput } from "./deliveryCompletion";

test("builds delivery completion payload without requiring proof image", () => {
  assert.deepEqual(
    deliveryCompletionInput({
      deliveryId: "delivery-1",
      notes: " Recebido por Maria ",
    }),
    {
      deliveryId: "delivery-1",
      notes: "Recebido por Maria",
    },
  );
});

test("includes proof id only when an optional proof image was uploaded", () => {
  assert.deepEqual(
    deliveryCompletionInput({
      deliveryId: "delivery-1",
      notes: "Recebido por Maria",
      proofId: " proof-1 ",
    }),
    {
      deliveryId: "delivery-1",
      notes: "Recebido por Maria",
      proofId: "proof-1",
    },
  );
});

test("omits blank optional proof id", () => {
  assert.deepEqual(
    deliveryCompletionInput({
      deliveryId: "delivery-1",
      notes: "Recebido por Maria",
      proofId: "   ",
    }),
    {
      deliveryId: "delivery-1",
      notes: "Recebido por Maria",
    },
  );
});
