import assert from "node:assert/strict";
import test from "node:test";
import { buildAttendantReferenceOptions, buildAttendantReferenceOptionsFromNames, parseAttendantReference } from "./attendantReferences";
import type { TeamUser } from "./types";

test("parses attendant reference code and name", () => {
  assert.deepEqual(parseAttendantReference("1234 - Maria Caixa"), { code: "1234", name: "Maria Caixa" });
  assert.deepEqual(parseAttendantReference("Maria Caixa"), { code: "", name: "Maria Caixa" });
});

test("builds attendant options sorted by name and labeled with code", () => {
  const options = buildAttendantReferenceOptions([
    makeUser({ id: "user-1", name: "2000 - Bruno Balcao" }),
    makeUser({ id: "user-2", name: "1000 - Ana Caixa" }),
    makeUser({ id: "user-3", name: "Carlos Conferencia", active: false }),
    makeUser({ id: "user-4", name: "1000 - Ana Caixa" }),
    makeUser({ id: "user-5", name: "Joao Motoboy", role: "MOTOBOY" }),
  ]);

  assert.deepEqual(options, [
    { value: "1000 - Ana Caixa", label: "Ana Caixa - codigo 1000" },
    { value: "2000 - Bruno Balcao", label: "Bruno Balcao - codigo 2000" },
  ]);
});

test("builds attendant options from report names", () => {
  assert.deepEqual(buildAttendantReferenceOptionsFromNames(["3000 - Carla", "Ana", "3000 - Carla", "1000 - Bruno"]), [
    { value: "Ana", label: "Ana" },
    { value: "1000 - Bruno", label: "Bruno - codigo 1000" },
    { value: "3000 - Carla", label: "Carla - codigo 3000" },
  ]);
});

function makeUser(input: { id: string; name: string; active?: boolean; role?: TeamUser["role"] }): TeamUser {
  return {
    id: input.id,
    name: input.name,
    role: input.role ?? "BALCONISTA_CAIXA",
    active: input.active ?? true,
    phone: null,
    email: null,
    store: null,
    courier: null,
    createdAt: "2026-05-20T12:00:00.000Z",
  };
}
