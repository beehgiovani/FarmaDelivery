import assert from "node:assert/strict";
import test from "node:test";
import { deliveryScopeRestFilter, deliveryScopeWhere, storeMatchesCourierServiceArea } from "./accessScope";

const courierId = "courier-1";

test("limits unavailable courier delivery scope to already assigned deliveries", () => {
  const session = { role: "MOTOBOY", courierId };

  assert.deepEqual(deliveryScopeWhere(session, null, ["store-1"], false), {
    courierId,
  });
  assert.equal(deliveryScopeRestFilter(session, null, ["store-1"], false), `&courierId=eq.${courierId}`);
});

test("includes waiting deliveries from active courier store scope only when courier is available", () => {
  const session = { role: "MOTOBOY", courierId };

  assert.deepEqual(deliveryScopeWhere(session, null, ["store-1", "store-2"], true), {
    OR: [
      { courierId },
      {
        status: "AGUARDANDO_MOTOBOY",
        storeId: { in: ["store-1", "store-2"] },
      },
    ],
  });
  assert.equal(
    deliveryScopeRestFilter(session, null, ["store-1", "store-2"], true),
    `&or=(courierId.eq.${courierId},and(status.eq.AGUARDANDO_MOTOBOY,storeId.in.(store-1,store-2)))`,
  );
});

test("uses no-store scope sentinel for store logins without active stores", () => {
  const session = { role: "GERENTE", storeId: "store-1" };

  assert.deepEqual(deliveryScopeWhere(session, [], null, true), {
    storeId: { in: [] },
  });
  assert.equal(deliveryScopeRestFilter(session, [], null, true), "&storeId=eq.__no_store_scope__");
});

test("scopes store logins to their active store list", () => {
  const session = { role: "GERENTE", storeId: "store-1" };

  assert.deepEqual(deliveryScopeWhere(session, ["store-1"], null, true), {
    storeId: { in: ["store-1"] },
  });
  assert.equal(deliveryScopeRestFilter(session, ["store-1"], null, true), "&storeId=eq.store-1");
});

test("maps courier service areas by store name", () => {
  assert.equal(storeMatchesCourierServiceArea("Loja Pereque", "PEREQUE"), true);
  assert.equal(storeMatchesCourierServiceArea("Loja Pereque", "ASTURIAS"), false);
  assert.equal(storeMatchesCourierServiceArea("Asturias", "ASTURIAS"), true);
  assert.equal(storeMatchesCourierServiceArea("Loja Centro", "ASTURIAS"), true);
});
