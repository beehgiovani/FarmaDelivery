import assert from "node:assert/strict";
import test from "node:test";
import { requireOperationalActorId } from "./routes/deliveries";

test("requires an actor for authenticated operational fallback events", () => {
  assert.equal(requireOperationalActorId("user-1"), "user-1");
  assert.throws(
    () => requireOperationalActorId(undefined),
    /Operational delivery events require actorUserId/,
  );
});
