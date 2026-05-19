import type { AssignmentKind, AssignmentSummary, TeamRole } from "./types";
import { csvCell } from "./csv";

export type AssignmentStatusFilter = "" | "ativa" | "encerrada";
export type AssignmentTargetFilter = "" | "usuario" | "motoboy";

export type AssignmentHistoryFilters = {
  storeId: string;
  personId: string;
  startsAt: string;
  endsAt: string;
  kind: "" | AssignmentKind;
  status: AssignmentStatusFilter;
  targetType: AssignmentTargetFilter;
};

export type VisibleAssignment =
  | {
      type: "usuario";
      assignment: AssignmentSummary["users"][number];
    }
  | {
      type: "motoboy";
      assignment: AssignmentSummary["couriers"][number];
    };

export type AssignmentCsvContext = {
  generatedAt: string;
  loadedAssignments: number;
  visibleAssignments: number;
  filters: AssignmentHistoryFilters;
};

export const emptyAssignmentHistoryFilters: AssignmentHistoryFilters = {
  storeId: "",
  personId: "",
  startsAt: "",
  endsAt: "",
  kind: "",
  status: "",
  targetType: "",
};

/** Aplica todos os filtros locais do historico sem misturar usuario e motoboy na mesma regra. */
export function matchesAssignmentFilters(
  visibleAssignment: VisibleAssignment,
  filters: AssignmentHistoryFilters,
) {
  if (!isAssignmentDateRangeValid(filters)) return false;

  const { assignment, type } = visibleAssignment;
  if (filters.targetType && type !== filters.targetType) return false;
  if (filters.status === "ativa" && !assignment.active) return false;
  if (filters.status === "encerrada" && assignment.active) return false;
  if (filters.kind && assignment.kind !== filters.kind) return false;
  if (filters.storeId && assignment.store.id !== filters.storeId) return false;

  if (filters.personId) {
    const personId = type === "usuario" ? assignment.user.id : assignment.courier.id;
    if (personId !== filters.personId) return false;
  }

  return overlapsDateRange(assignment.startsAt, assignment.endsAt, filters.startsAt, filters.endsAt);
}

/** Junta alocacoes de usuarios e motoboys em uma lista unica ja filtrada para a tela. */
export function getVisibleAssignments(assignments: AssignmentSummary, filters: AssignmentHistoryFilters) {
  if (!isAssignmentDateRangeValid(filters)) return [];

  return [
    ...assignments.users.map((assignment) => ({ type: "usuario" as const, assignment })),
    ...assignments.couriers.map((assignment) => ({ type: "motoboy" as const, assignment })),
  ].filter((assignment) => matchesAssignmentFilters(assignment, filters));
}

export function isAssignmentDateRangeValid(filters: Pick<AssignmentHistoryFilters, "startsAt" | "endsAt">) {
  if (!filters.startsAt || !filters.endsAt) return true;
  const filterStart = startOfDay(filters.startsAt).getTime();
  const filterEnd = endOfDay(filters.endsAt).getTime();
  return Number.isFinite(filterStart) && Number.isFinite(filterEnd) && filterStart <= filterEnd;
}

/** Monta o CSV auditavel do historico de alocacoes sem expor senha, token ou dado sensivel desnecessario. */
export function buildAssignmentsCsv(assignments: VisibleAssignment[], context?: AssignmentCsvContext) {
  const header = ["id", "tipo", "pessoa", "funcao_base", "loja", "regra", "status", "inicio", "fim", "motivo"];
  const rows = assignments.map(({ type, assignment }) => {
    const person = type === "usuario" ? assignment.user : assignment.courier;
    const baseRole = type === "usuario" ? roleLabel(assignment.user.role) : "Motoboy";
    return [
      assignment.id,
      type,
      person.name,
      baseRole,
      assignment.store.name,
      assignmentLabel(assignment.kind),
      assignment.active ? "ativa" : "encerrada",
      assignment.startsAt,
      assignment.endsAt ?? "",
      assignment.reason ?? "",
    ];
  });
  const sections = [
    ...(context ? buildContextSection(context) : []),
    [header, ...rows],
  ];
  return sections.flatMap((section) => section.map((row) => row.map(csvCell).join(","))).join("\n");
}

/** Traduz a regra da alocacao para o texto usado no painel e no CSV. */
export function assignmentLabel(kind: AssignmentKind) {
  const labels: Record<AssignmentKind, string> = {
    BASE: "Base",
    TEMPORARIA: "Temporaria",
    COBERTURA: "Cobertura",
    DEDICADA: "Dedicada",
    RODIZIO: "Rodizio",
  };
  return labels[kind];
}

/** Mantem o cargo base legivel no CSV de historico. */
function roleLabel(role: TeamRole) {
  const labels: Record<TeamRole, string> = {
    ADMIN: "Admin",
  GERENTE: "Acesso da loja",
  BALCONISTA_CAIXA: "Balconista / caixa (referencia)",
    MOTOBOY: "Motoboy",
  };
  return labels[role];
}

/** Considera sobreposicao de datas para achar alocacoes que tocaram o periodo filtrado. */
function overlapsDateRange(assignmentStartsAt: string, assignmentEndsAt: string | null | undefined, filterStartsAt: string, filterEndsAt: string) {
  if (!filterStartsAt && !filterEndsAt) return true;

  const assignmentStart = new Date(assignmentStartsAt).getTime();
  const assignmentEnd = assignmentEndsAt ? new Date(assignmentEndsAt).getTime() : assignmentStart;
  const filterStart = filterStartsAt ? startOfDay(filterStartsAt).getTime() : Number.NEGATIVE_INFINITY;
  const filterEnd = filterEndsAt ? endOfDay(filterEndsAt).getTime() : Number.POSITIVE_INFINITY;

  if (!Number.isFinite(assignmentStart) || !Number.isFinite(assignmentEnd)) return false;
  return assignmentStart <= filterEnd && assignmentEnd >= filterStart;
}

/** Adiciona metadados da exportacao para sabermos quais filtros geraram o arquivo. */
function buildContextSection(context: AssignmentCsvContext) {
  return [
    [
      ["contexto_exportacao"],
      ["gerado_em", context.generatedAt],
      ["alocacoes_carregadas", String(context.loadedAssignments)],
      ["alocacoes_visiveis", String(context.visibleAssignments)],
      ["tipo", context.filters.targetType || "todos"],
      ["status", context.filters.status || "todos"],
      ["regra", context.filters.kind || "todas"],
      ["loja_id", context.filters.storeId || "todas"],
      ["pessoa_id", context.filters.personId || "todas"],
      ["data_inicial", context.filters.startsAt || ""],
      ["data_final", context.filters.endsAt || ""],
      [""],
    ],
  ];
}

/** Marca o inicio do dia local para comparar filtros de data do painel. */
function startOfDay(value: string) {
  return new Date(`${value}T00:00:00`);
}

/** Marca o fim do dia local para incluir registros do dia inteiro no filtro. */
function endOfDay(value: string) {
  return new Date(`${value}T23:59:59`);
}
