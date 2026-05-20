import type { Delivery, DeliveryPriority, DeliveryStatus, ReportCountRow } from "./types";

export type DeliveryProofFilter = "" | "com" | "sem";
export type DeliveryMapPointFilter = "" | "com" | "sem";

export type DeliveryReportFilters = {
  status: DeliveryStatus | "";
  priority: DeliveryPriority | "";
  proof: DeliveryProofFilter;
  mapPoint: DeliveryMapPointFilter;
  attendant: string;
  courier: string;
};

export const emptyDeliveryReportFilters: DeliveryReportFilters = {
  status: "",
  priority: "",
  proof: "",
  mapPoint: "",
  attendant: "",
  courier: "",
};

/** Indica se o relatorio esta com filtro comparativo aplicado. */
export function hasDeliveryReportFilters(filters: DeliveryReportFilters) {
  return Boolean(filters.status || filters.priority || filters.proof || filters.mapPoint || filters.attendant.trim() || filters.courier.trim());
}

/** Aplica filtros locais no relatorio ja carregado, inclusive entregas com ou sem comprovante. */
export function filterDeliveriesForReport(deliveries: Delivery[], filters: DeliveryReportFilters) {
  return deliveries.filter((delivery) => {
    const matchesStatus = !filters.status || delivery.status === filters.status;
    const matchesPriority = !filters.priority || delivery.priority === filters.priority;
    const proofCount = delivery.proofCount ?? 0;
    const matchesProof = !filters.proof || (filters.proof === "com" ? proofCount > 0 : proofCount === 0);
    const matchesMapPoint = !filters.mapPoint || (filters.mapPoint === "com" ? Boolean(delivery.coordinates) : !delivery.coordinates);
    const matchesAttendant =
      !filters.attendant.trim() || normalizeFilterText(delivery.attendantName ?? "").includes(normalizeFilterText(filters.attendant));
    const matchesCourier =
      !filters.courier.trim() || normalizeFilterText(delivery.courier).includes(normalizeFilterText(filters.courier));
    return matchesStatus && matchesPriority && matchesProof && matchesMapPoint && matchesAttendant && matchesCourier;
  });
}

function normalizeFilterText(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Conta e ordena linhas agregadas para graficos/tabelas de distribuicao. */
export function countReportRows(labels: string[]): ReportCountRow[] {
  const counts = new Map<string, number>();
  labels.forEach((label) => counts.set(label, (counts.get(label) ?? 0) + 1));
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}
