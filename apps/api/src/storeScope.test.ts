import assert from "node:assert/strict";
import test from "node:test";
import { storeScopeRestFilter, storeScopeWhere } from "./routes/stores";

test("builds store scope for store logins", () => {
  const session = { role: "GERENTE", storeId: "store-1" };

  assert.deepEqual(storeScopeWhere(session, ["store-1", "store-2"]), {
    id: { in: ["store-1", "store-2"] },
  });
  assert.equal(storeScopeRestFilter(session, ["store-1", "store-2"]), "&id=in.(store-1,store-2)");
});

test("uses no-store sentinel for store logins without active store scope", () => {
  const session = { role: "GERENTE", storeId: null };

  assert.deepEqual(storeScopeWhere(session, []), {
    id: { in: [] },
  });
  assert.equal(storeScopeRestFilter(session, []), "&id=eq.__no_store_scope__");
});

test("builds store scope for couriers and unrestricted admins", () => {
  assert.deepEqual(storeScopeWhere({ role: "MOTOBOY", storeId: "store-5" }, null), { id: "store-5" });
  assert.equal(storeScopeRestFilter({ role: "MOTOBOY", storeId: "store-5" }, null), "&id=eq.store-5");
  assert.equal(storeScopeWhere({ role: "ADMIN" }, null), undefined);
  assert.equal(storeScopeRestFilter({ role: "ADMIN" }, null), "");
});

test("keeps single-store login scope readable", () => {
  assert.deepEqual(storeScopeWhere({ role: "GERENTE", storeId: "store-1" }, ["store-1"]), {
    id: { in: ["store-1"] },
  });
  assert.equal(storeScopeRestFilter({ role: "GERENTE", storeId: "store-1" }, ["store-1"]), "&id=eq.store-1");
});
