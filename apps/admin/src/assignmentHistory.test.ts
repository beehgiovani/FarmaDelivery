import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAssignmentsCsv,
  emptyAssignmentHistoryFilters,
  getVisibleAssignments,
  isAssignmentDateRangeValid,
  matchesAssignmentFilters,
  type VisibleAssignment,
} from "./assignmentHistory";
import type { AssignmentSummary } from "./types";

test("filters assignment history by target type, status and kind", () => {
  const assignments = makeSummary();

  assert.deepEqual(
    getVisibleAssignments(assignments, {
      ...emptyAssignmentHistoryFilters,
      targetType: "motoboy",
      status: "encerrada",
      kind: "RODIZIO",
    }).map(({ assignment }) => assignment.id),
    ["courier-ended"],
  );
});

test("filters assignment history by store, person and overlapping period", () => {
  const assignments = makeSummary();

  assert.deepEqual(
    getVisibleAssignments(assignments, {
      ...emptyAssignmentHistoryFilters,
      storeId: "store-2",
      personId: "courier-1",
      startsAt: "2026-05-15",
      endsAt: "2026-05-17",
    }).map(({ assignment }) => assignment.id),
    ["courier-active", "courier-ended"],
  );
  assert.equal(matchesAssignmentFilters(makeVisibleUser({ startsAt: "data-invalida" }), emptyAssignmentHistoryFilters), true);
  assert.equal(matchesAssignmentFilters(makeVisibleUser({ startsAt: "data-invalida" }), { ...emptyAssignmentHistoryFilters, startsAt: "2026-05-15" }), false);
});

test("rejects inverted assignment history date range before filtering", () => {
  const filters = {
    ...emptyAssignmentHistoryFilters,
    startsAt: "2026-05-17",
    endsAt: "2026-05-16",
  };

  assert.equal(isAssignmentDateRangeValid(filters), false);
  assert.deepEqual(getVisibleAssignments(makeSummary(), filters), []);
  assert.equal(matchesAssignmentFilters(makeVisibleUser(), filters), false);
});

test("exports assignment history csv with context and without passwords or tokens", () => {
  const assignments = getVisibleAssignments(makeSummary(), {
    ...emptyAssignmentHistoryFilters,
    status: "encerrada",
  });

  const csv = buildAssignmentsCsv(assignments, {
    generatedAt: "2026-05-16T13:00:00.000Z",
    loadedAssignments: 3,
    visibleAssignments: assignments.length,
    filters: {
      ...emptyAssignmentHistoryFilters,
      status: "encerrada",
      targetType: "motoboy",
      kind: "RODIZIO",
    },
  });

  assert.match(csv, /"contexto_exportacao"/);
  assert.match(csv, /"alocacoes_carregadas","3"/);
  assert.match(csv, /"alocacoes_visiveis","1"/);
  assert.match(csv, /"status","encerrada"/);
  assert.match(csv, /"tipo","motoboy"/);
  assert.match(csv, /"regra","RODIZIO"/);
  assert.match(csv, /"courier-ended","motoboy","Carlos"/);
  assert.doesNotMatch(csv.toLowerCase(), /senha|password|token/);
});

test("escapes spreadsheet formulas in assignment csv", () => {
  const csv = buildAssignmentsCsv(
    [
      makeVisibleUser({
        id: "=assignment",
        reason: "+cobertura",
        user: {
          id: "user-1",
          name: "@Ana",
          role: "BALCONISTA_CAIXA",
        },
        store: {
          id: "store-1",
          name: "-Asturias",
          code: "LOJA_1",
        },
      }),
    ],
    {
      generatedAt: "2026-05-16T13:00:00.000Z",
      loadedAssignments: 1,
      visibleAssignments: 1,
      filters: emptyAssignmentHistoryFilters,
    },
  );

  assert.match(csv, /"'=assignment","usuario","'@Ana"/);
  assert.match(csv, /"'-Asturias"/);
  assert.match(csv, /"'\+cobertura"/);
});

function makeSummary(): AssignmentSummary {
  return {
    users: [
      makeUserAssignment({
        id: "user-active",
        active: true,
        kind: "TEMPORARIA",
        store: { id: "store-1", name: "Asturias", code: "LOJA_1" },
      }),
    ],
    couriers: [
      makeCourierAssignment({
        id: "courier-active",
        active: true,
        kind: "COBERTURA",
        store: { id: "store-2", name: "Santa Rosa", code: "LOJA_3" },
      }),
      makeCourierAssignment({
        id: "courier-ended",
        active: false,
        kind: "RODIZIO",
        store: { id: "store-2", name: "Santa Rosa", code: "LOJA_3" },
        startsAt: "2026-05-14T10:00:00.000Z",
        endsAt: "2026-05-15T18:00:00.000Z",
      }),
    ],
  };
}

function makeVisibleUser(overrides: Partial<AssignmentSummary["users"][number]> = {}): VisibleAssignment {
  return {
    type: "usuario",
    assignment: makeUserAssignment(overrides),
  };
}

function makeUserAssignment(
  overrides: Partial<AssignmentSummary["users"][number]> = {},
): AssignmentSummary["users"][number] {
  return {
    id: "user-assignment",
    kind: "TEMPORARIA",
    startsAt: "2026-05-16T10:00:00.000Z",
    endsAt: null,
    active: true,
    reason: null,
    user: {
      id: "user-1",
      name: "Ana",
      role: "BALCONISTA_CAIXA",
    },
    store: {
      id: "store-1",
      name: "Asturias",
      code: "LOJA_1",
    },
    ...overrides,
  };
}

function makeCourierAssignment(
  overrides: Partial<AssignmentSummary["couriers"][number]> = {},
): AssignmentSummary["couriers"][number] {
  return {
    id: "courier-assignment",
    kind: "COBERTURA",
    startsAt: "2026-05-16T10:00:00.000Z",
    endsAt: null,
    active: true,
    reason: "cobertura operacional",
    courier: {
      id: "courier-1",
      name: "Carlos",
      phone: "(13) 99999-0000",
      baseStoreName: "Asturias",
    },
    store: {
      id: "store-2",
      name: "Santa Rosa",
      code: "LOJA_3",
    },
    ...overrides,
  };
}
