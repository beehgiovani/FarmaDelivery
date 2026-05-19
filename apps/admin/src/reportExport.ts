import { countReportRows } from "./reportFilters";
import { csvCell } from "./csv";
import type { Delivery, DeliveryReportSummary } from "./types";

export type DeliveryReportCsvContext = {
  generatedAt: string;
  dateLabel: string;
  scopeLabel: string;
  loadedDeliveries: number;
  visibleDeliveries?: number;
  exportLimit?: number;
  exportLimitReached?: boolean;
  statusFilter?: string;
  priorityFilter?: string;
  proofFilter?: string;
  mapPointFilter?: string;
  attendantFilter?: string;
  summary?: DeliveryReportSummary | null;
};

export function buildDeliveriesCsv(deliveries: Delivery[], context: DeliveryReportCsvContext) {
  const header = [
    "id",
    "codigo",
    "data_numero_loja",
    "numero_dia_loja",
    "loja",
    "cliente",
    "telefone_mascarado",
    "endereco",
    "ponto_mapa",
    "status",
    "balconista_lancamento",
    "motoboy",
    "entregue_por",
    "prioridade",
    "comprovante",
    "qtd_comprovantes",
    "criado_em",
    "aceito_em",
    "coletado_em",
    "entregue_em",
    "cancelado_em",
  ];
  const rows = deliveries.map((delivery) => [
    delivery.id,
    delivery.publicCode ?? delivery.id,
    delivery.storeDailyDate ?? "",
    formatStoreDailyNumber(delivery.storeDailyNumber),
    delivery.store,
    delivery.customer,
    maskPhone(delivery.phone),
    delivery.address,
    delivery.coordinates ? "sim" : "nao",
    delivery.status,
    delivery.attendantName ?? "",
    delivery.courier,
    delivery.rawDeliveredAt ? delivery.courier : "",
    delivery.priority,
    (delivery.proofCount ?? 0) > 0 ? "sim" : "nao",
    String(delivery.proofCount ?? 0),
    delivery.rawCreatedAt,
    delivery.rawDispatchedAt ?? "",
    delivery.rawCollectedAt ?? "",
    delivery.rawDeliveredAt ?? "",
    delivery.rawCanceledAt ?? "",
  ]);

  const sections = [
    buildContextSection(context),
    buildSummarySection(deliveries, context.summary),
    ...buildDistributionSections(deliveries, context.summary),
    [header, ...rows],
  ];
  return sections.flatMap((section) => section.map((row) => row.map(csvCell).join(","))).join("\n");
}

export function deliveryReportFileName(scopeLabel: string, dateLabel: string) {
  return `farmadelivery-${slug(scopeLabel)}-${dateLabel || "periodo"}.csv`;
}

export function maskPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length <= 4) return "****";
  const visibleEnd = digits.slice(-4);
  const visibleStart = digits.length >= 10 ? digits.slice(0, 2) : "";
  return visibleStart ? `(${visibleStart}) ****-${visibleEnd}` : `****-${visibleEnd}`;
}

export function slug(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function buildContextSection(context: DeliveryReportCsvContext) {
  return [
    ["contexto_exportacao"],
    ["gerado_em", context.generatedAt],
    ["escopo", context.scopeLabel],
    ["periodo", context.dateLabel || "periodo"],
    ["entregas_carregadas", String(context.loadedDeliveries)],
    ["entregas_visiveis", String(context.visibleDeliveries ?? context.loadedDeliveries)],
    ["limite_exportacao", context.exportLimit ? String(context.exportLimit) : ""],
    ["limite_atingido", context.exportLimitReached ? "sim" : "nao"],
    ["filtro_status", context.statusFilter || "todos"],
    ["filtro_prioridade", context.priorityFilter || "todas"],
    ["filtro_comprovante", proofFilterLabel(context.proofFilter)],
    ["filtro_ponto_mapa", mapPointFilterLabel(context.mapPointFilter)],
    ["filtro_balconista", context.attendantFilter?.trim() || "todos"],
    [""],
  ];
}

function proofFilterLabel(value?: string) {
  const labels: Record<string, string> = {
    com: "com_comprovante",
    sem: "sem_comprovante",
  };
  return value ? labels[value] ?? value : "todos";
}

function mapPointFilterLabel(value?: string) {
  const labels: Record<string, string> = {
    com: "no_mapa",
    sem: "sem_ponto",
  };
  return value ? labels[value] ?? value : "todos";
}

function buildSummarySection(deliveries: Delivery[], summary?: DeliveryReportSummary | null) {
  const deliveredWithProof =
    summary?.deliveredWithProof ?? deliveries.filter((delivery) => delivery.status === "Entregue" && (delivery.proofCount ?? 0) > 0).length;
  const deliveredWithoutProof =
    summary?.deliveredWithoutProof ??
    deliveries.filter((delivery) => delivery.status === "Entregue" && (delivery.proofCount ?? 0) === 0).length;

  return [
    ["resumo"],
    ["entregas", String(summary?.total ?? deliveries.length)],
    ["entregues", String(summary?.delivered ?? deliveries.filter((delivery) => delivery.status === "Entregue").length)],
    ["com_comprovante", String(deliveredWithProof)],
    ["sem_comprovante", String(deliveredWithoutProof)],
    ["ocorrencias", String(summary?.issues ?? deliveries.filter((delivery) => delivery.status === "Problema").length)],
    ["canceladas", String(summary?.canceled ?? deliveries.filter((delivery) => delivery.status === "Cancelada").length)],
    ["motoboys_ativos", String(summary?.activeCouriers ?? countActiveCouriers(deliveries))],
    [""],
  ];
}

function buildDistributionSections(deliveries: Delivery[], summary?: DeliveryReportSummary | null) {
  return [
    buildDistributionSection("distribuicao_por_loja", summary?.byStore.length ? summary.byStore : countReportRows(deliveries.map((delivery) => delivery.store))),
    buildDistributionSection(
      "distribuicao_por_balconista",
      summary?.byAttendant?.length
        ? summary.byAttendant
        : countReportRows(
            deliveries
              .map((delivery) => delivery.attendantName?.trim() ?? "")
              .filter(Boolean),
          ),
    ),
    buildDistributionSection(
      "distribuicao_por_motoboy",
      summary?.byCourier.length
        ? summary.byCourier
        : countReportRows(
            deliveries
              .map((delivery) => delivery.courier)
              .filter((courier) => courier && courier !== "Sem motoboy"),
          ),
    ),
    buildDistributionSection("distribuicao_por_status", summary?.byStatus.length ? summary.byStatus : countReportRows(deliveries.map((delivery) => delivery.status))),
    buildDistributionSection("distribuicao_por_prioridade", summary?.byPriority.length ? summary.byPriority : countReportRows(deliveries.map((delivery) => delivery.priority))),
  ];
}

function buildDistributionSection(title: string, rows: Array<{ label: string; count: number }>) {
  return [
    [title],
    ["rotulo", "quantidade"],
    ...rows.map((row) => [row.label, String(row.count)]),
    [""],
  ];
}

function countActiveCouriers(deliveries: Delivery[]) {
  return new Set(
    deliveries.map((delivery) => delivery.courier).filter((courier) => courier && courier !== "Sem motoboy"),
  ).size;
}

function formatStoreDailyNumber(value: number | null | undefined) {
  return value ? String(value).padStart(3, "0") : "";
}
