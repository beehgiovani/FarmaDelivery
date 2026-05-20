import assert from "node:assert/strict";
import test from "node:test";
import {
  accessFlowForRole,
  activeStoreAccessUsers,
  buildAccessFormForFlow,
  buildCounterReferenceName,
  buildCreatedAccessCard,
  buildStoreLoginAccessForm,
  buildStoreAccessRows,
  formatStoreHours,
  generateInitialPassword,
  mergeStoreUnits,
  requiresBaseStoreForRole,
  requiresLoginCredentialsForRole,
  storeBaseLabel,
} from "./managementAccess";
import type { StoreUnit, TeamUser } from "./types";

test("groups active store login users by store", () => {
  const rows = buildStoreAccessRows(
    [makeStore("store-1", "Asturias"), makeStore("store-2", "Santa Rosa")],
    [
      makeUser({ id: "user-1", name: "Asturias", role: "GERENTE", storeId: "store-1", storeName: "Asturias" }),
      makeUser({ id: "user-2", name: "Santa Rosa", role: "GERENTE", storeId: "store-2", storeName: "Santa Rosa" }),
      makeUser({ id: "user-3", name: "Carlos", role: "MOTOBOY", storeId: "store-1", storeName: "Asturias" }),
      makeUser({ id: "user-4", name: "Duda", role: "GERENTE", active: false, storeId: "store-1", storeName: "Asturias" }),
    ],
  );

  assert.deepEqual(rows.map((row) => [row.store.name, row.users.map((user) => user.name)]), [
    ["Asturias", ["Asturias"]],
    ["Santa Rosa", ["Santa Rosa"]],
  ]);
});

test("keeps only active store access users", () => {
  const users = [
    makeUser({ id: "user-1", role: "GERENTE", active: true, storeId: "store-1" }),
    makeUser({ id: "user-2", role: "ADMIN", active: true, storeId: "store-1" }),
    makeUser({ id: "user-3", role: "GERENTE", active: false, storeId: "store-1" }),
    makeUser({ id: "user-4", role: "GERENTE", active: true }),
    makeUser({ id: "user-5", role: "BALCONISTA_CAIXA", active: true, storeId: "store-1" }),
  ];

  assert.deepEqual(activeStoreAccessUsers(users).map((user) => user.id), ["user-1"]);
});

test("requires base store for store logins and courier access", () => {
  assert.equal(requiresBaseStoreForRole("GERENTE"), true);
  assert.equal(requiresBaseStoreForRole("BALCONISTA_CAIXA"), false);
  assert.equal(requiresBaseStoreForRole("MOTOBOY"), true);
  assert.equal(requiresBaseStoreForRole("ADMIN"), false);
});

test("requires login credentials only for real access roles", () => {
  assert.equal(requiresLoginCredentialsForRole("GERENTE"), true);
  assert.equal(requiresLoginCredentialsForRole("MOTOBOY"), true);
  assert.equal(requiresLoginCredentialsForRole("ADMIN"), true);
  assert.equal(requiresLoginCredentialsForRole("BALCONISTA_CAIXA"), false);
});

test("keeps counter staff in a reference-only access flow", () => {
  const form = buildAccessFormForFlow({
    flow: "counterReference",
    current: makeAccessForm({ role: "GERENTE", storeId: "store-1", phone: "(13) 99999-0000", password: "FarmaSenha123" }),
    defaultStoreId: "store-1",
    initialPassword: "FarmaNova123",
  });

  assert.equal(accessFlowForRole("BALCONISTA_CAIXA"), "counterReference");
  assert.deepEqual(form, makeAccessForm({ role: "BALCONISTA_CAIXA", storeId: "", phone: "", password: "" }));
});

test("builds counter reference name with optional InovaFarma code", () => {
  assert.equal(buildCounterReferenceName({ code: " 1234 ", name: " Maria Caixa " }), "1234 - Maria Caixa");
  assert.equal(buildCounterReferenceName({ code: "", name: " Maria Caixa " }), "Maria Caixa");
  assert.equal(buildCounterReferenceName({ code: "1234", name: " " }), "");
});

test("prepares store login as a credentialed store access", () => {
  const store = makeStore("store-1", "Loja Operacional");

  assert.equal(accessFlowForRole("GERENTE"), "systemAccess");
  assert.deepEqual(
    buildStoreLoginAccessForm({
      current: makeAccessForm({ role: "BALCONISTA_CAIXA", name: "Maria" }),
      store,
      initialPassword: "FarmaNova123",
    }),
    makeAccessForm({ name: "Loja Operacional", role: "GERENTE", storeId: "store-1", password: "FarmaNova123" }),
  );
});

test("system access flow defaults to store login without offering counter reference as login", () => {
  assert.deepEqual(
    buildAccessFormForFlow({
      flow: "systemAccess",
      current: makeAccessForm({ role: "BALCONISTA_CAIXA", storeId: "", password: "" }),
      defaultStoreId: "store-1",
      initialPassword: "FarmaNova123",
    }),
    makeAccessForm({ role: "GERENTE", storeId: "store-1", password: "FarmaNova123" }),
  );
});

test("prepares courier access as its own credentialed flow with base store", () => {
  assert.equal(accessFlowForRole("MOTOBOY"), "courierAccess");
  assert.deepEqual(
    buildAccessFormForFlow({
      flow: "courierAccess",
      current: makeAccessForm({ role: "GERENTE", storeId: "", password: "" }),
      defaultStoreId: "store-1",
      initialPassword: "FarmaMoto123",
    }),
    makeAccessForm({ role: "MOTOBOY", storeId: "store-1", password: "FarmaMoto123" }),
  );
});

test("merges freshly created stores without duplicating stores already reloaded", () => {
  const storeCentral = makeStore("store-1", "Asturias");
  const storeSul = makeStore("store-2", "Santa Rosa");

  assert.deepEqual(mergeStoreUnits([storeCentral, storeSul], [storeSul, makeStore("store-3", "Centro")]).map((store) => store.name), [
    "Asturias",
    "Santa Rosa",
    "Centro",
  ]);
});

test("formats store operation labels and default hours", () => {
  assert.equal(storeBaseLabel("compartilhada"), "Base compartilhada");
  assert.equal(storeBaseLabel("dedicada"), "Base dedicada");
  assert.equal(formatStoreHours(makeStore("store-1", "Asturias")), "Horario pendente");
  assert.equal(
    formatStoreHours({
      ...makeStore("store-2", "Santa Rosa"),
      weeklyHours: [
        { dayOfWeek: 0, opensAt: "00:00", closesAt: "00:00", closed: true },
        { dayOfWeek: 1, opensAt: "08:00", closesAt: "22:00", closed: false },
      ],
    }),
    "08:00 as 22:00",
  );
});

test("builds created access card preferring email as login", () => {
  assert.deepEqual(
    buildCreatedAccessCard({
      name: "Ana",
      email: " ana@loja.com ",
      phone: "(13) 99999-0000",
      password: "FarmaSenha123",
      role: "GERENTE",
      storeName: "Asturias",
    }),
    {
      name: "Ana",
      login: "ana@loja.com",
      password: "FarmaSenha123",
      role: "GERENTE",
      storeName: "Asturias",
    },
  );
});

test("builds courier access card with phone login when email is absent", () => {
  assert.deepEqual(
    buildCreatedAccessCard({
      name: "Joao Motoboy",
      email: "",
      phone: "(13) 98888-7777",
      password: "FarmaMoto123",
      role: "MOTOBOY",
      storeName: "Loja Base",
    }),
    {
      name: "Joao Motoboy",
      login: "(13) 98888-7777",
      password: "FarmaMoto123",
      role: "MOTOBOY",
      storeName: "Loja Base",
    },
  );
});

test("generates initial passwords with stable prefix and requested entropy length", () => {
  const password = generateInitialPassword(() => Uint8Array.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]));

  assert.equal(password.startsWith("Farma"), true);
  assert.equal(password.length, 15);
  assert.match(password, /^Farma[A-Za-z2-9]+$/);
});

function makeStore(id: string, name: string): StoreUnit {
  return {
    id,
    name,
    code: id,
    address: `${name} endereco`,
    queue: 0,
    color: "#275397",
    baseType: "compartilhada",
  };
}

function makeUser(input: {
  id: string;
  name?: string;
  role: TeamUser["role"];
  active?: boolean;
  storeId?: string;
  storeName?: string;
}): TeamUser {
  return {
    id: input.id,
    name: input.name ?? input.id,
    role: input.role,
    active: input.active ?? true,
    phone: "(13) 99999-0000",
    email: `${input.id}@loja.com`,
    store: input.storeId
      ? {
          id: input.storeId,
          name: input.storeName ?? input.storeId,
          code: input.storeId,
        }
      : null,
    courier: null,
    createdAt: "2026-05-17T12:00:00.000Z",
  };
}

function makeAccessForm(input: Partial<ReturnType<typeof buildAccessFormForFlow> & { role: TeamUser["role"] }> = {}) {
  return {
    name: input.name ?? "",
    employeeCode: input.employeeCode ?? "",
    phone: input.phone ?? "",
    email: input.email ?? "",
    password: input.password ?? "",
    role: input.role ?? "GERENTE",
    storeId: input.storeId ?? "",
  };
}
