import assert from "node:assert/strict";
import test from "node:test";
import {
  courierListScopeRestFilter,
  courierListScopeWhere,
  safeDeviceTokenLogError,
  userListScopeRestFilter,
  userListScopeWhere,
} from "./routes/users";

const now = new Date("2026-05-16T12:00:00.000Z");

test("builds user list scope for store logins with active store assignments", () => {
  assert.deepEqual(userListScopeWhere({ role: "GERENTE" }, ["store-1", "store-2"]), {
    OR: [{ storeId: { in: ["store-1", "store-2"] } }, { role: "MOTOBOY" }, { role: "BALCONISTA_CAIXA" }],
  });
  assert.equal(
    userListScopeRestFilter({ role: "GERENTE" }, ["store-1", "store-2"]),
    "&or=(storeId.in.(store-1,store-2),role.eq.MOTOBOY,role.eq.BALCONISTA_CAIXA)",
  );
});

test("uses a no-user sentinel for store logins without active store scope", () => {
  assert.deepEqual(userListScopeWhere({ role: "GERENTE" }, []), {
    id: { in: [] },
  });
  assert.equal(userListScopeRestFilter({ role: "GERENTE" }, []), "&id=eq.__no_user_scope__");
});

test("does not scope unrestricted user list viewers", () => {
  assert.equal(userListScopeWhere({ role: "ADMIN" }, null), undefined);
  assert.equal(userListScopeRestFilter({ role: "ADMIN" }, null), "");
});

test("scopes store login viewers while keeping global attendants available for autocomplete", () => {
  assert.deepEqual(userListScopeWhere({ role: "GERENTE" }, ["store-1"]), {
    OR: [{ storeId: { in: ["store-1"] } }, { role: "MOTOBOY" }, { role: "BALCONISTA_CAIXA" }],
  });
  assert.equal(
    userListScopeRestFilter({ role: "GERENTE" }, ["store-1"]),
    "&or=(storeId.eq.store-1,role.eq.MOTOBOY,role.eq.BALCONISTA_CAIXA)",
  );
});

test("builds courier list scope for store logins with active store assignments", () => {
  assert.deepEqual(courierListScopeWhere({ role: "GERENTE" }, ["store-1", "store-2"], now), {
    storeAssignments: {
      some: {
        storeId: { in: ["store-1", "store-2"] },
        active: true,
        startsAt: { lte: now },
        OR: [{ endsAt: null }, { endsAt: { gte: now } }],
      },
    },
  });
  assert.deepEqual(courierListScopeRestFilter({ role: "GERENTE" }, ["store-1", "store-2"], now), {
    select: ",CourierStoreAssignment!inner(storeId)",
    filter:
      "&CourierStoreAssignment.storeId=in.(store-1,store-2)" +
      "&CourierStoreAssignment.active=eq.true" +
      "&CourierStoreAssignment.startsAt=lte.2026-05-16T12:00:00.000Z" +
      "&CourierStoreAssignment.or=(endsAt.is.null,endsAt.gte.2026-05-16T12:00:00.000Z)",
  });
});

test("keeps counter attendants as references instead of scoped login viewers", () => {
  assert.equal(userListScopeWhere({ role: "BALCONISTA_CAIXA" }, ["store-1"]), undefined);
  assert.equal(userListScopeRestFilter({ role: "BALCONISTA_CAIXA" }, ["store-1"]), "");
  assert.equal(courierListScopeWhere({ role: "BALCONISTA_CAIXA" }, ["store-1"], now), undefined);
  assert.deepEqual(courierListScopeRestFilter({ role: "BALCONISTA_CAIXA" }, ["store-1"], now), {
    select: "",
    filter: "",
  });
});

test("scopes courier list to the own courier for motoboys", () => {
  assert.deepEqual(courierListScopeWhere({ role: "MOTOBOY", courierId: "courier-1" }, null, now), {
    id: "courier-1",
  });
  assert.deepEqual(courierListScopeRestFilter({ role: "MOTOBOY", courierId: "courier-1" }, null, now), {
    select: "",
    filter: "&id=eq.courier-1",
  });
});

test("uses a no-courier sentinel for store logins without active store scope", () => {
  assert.deepEqual(courierListScopeWhere({ role: "GERENTE" }, [], now), {
    id: { in: [] },
  });
  assert.deepEqual(courierListScopeRestFilter({ role: "GERENTE" }, [], now), {
    select: "",
    filter: "&id=eq.__no_courier_scope__",
  });
});

test("sanitizes courier device token registration errors before logging", () => {
  const rawToken = "fcm-token-that-must-not-appear-in-logs";
  const safe = safeDeviceTokenLogError({
    name: "SupabaseRestError",
    code: "PGRST000",
    status: 400,
    message: `request failed for token ${rawToken}`,
    query: `token=eq.${rawToken}`,
    body: {
      token: rawToken,
    },
    stack: `Error: ${rawToken}`,
  });

  const serialized = JSON.stringify(safe);
  assert.equal(serialized.includes(rawToken), false);
  assert.equal(serialized.includes("message"), false);
  assert.equal(serialized.includes("query"), false);
  assert.equal(serialized.includes("body"), false);
  assert.equal(serialized.includes("stack"), false);
  assert.deepEqual(safe, {
    name: "SupabaseRestError",
    code: "PGRST000",
    status: 400,
  });
});
