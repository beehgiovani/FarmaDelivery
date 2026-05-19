export type DeliveryReportPeriod = {
  date?: string;
  startsAt?: string;
  endsAt?: string;
};

export type DeliveryReportFilters = {
  status?: string;
  priority?: string;
  proof?: "com" | "sem";
  mapPoint?: "com" | "sem";
  attendant?: string;
};

export type ReportDeliveryRow = {
  id: string;
  store: string;
  status: string;
  courier: string;
  attendantName?: string | null;
  priority: string;
  createdAt: string;
  acceptedAt: string | null;
  collectedAt: string | null;
  deliveredAt: string | null;
  canceledAt: string | null;
  proofCount: number;
  hasMapPoint?: boolean;
};

export type ReportDeliveryExportRow = ReportDeliveryRow & {
  publicCode: string;
  storeDailyDate?: string | null;
  storeDailyNumber?: number | null;
  customer: string;
  phone: string;
  address: string;
  hasMapPoint?: boolean;
};

export type DeliveryReportCsvContext = {
  generatedAt: string;
  scopeLabel: string;
  periodLabel: string;
  period?: DeliveryReportPeriod;
  filters?: DeliveryReportFilters;
  exportLimit?: number;
  exportLimitReached?: boolean;
};

export function buildDeliveryReport(
  deliveries: ReportDeliveryRow[],
  period: DeliveryReportPeriod = {},
  filters: DeliveryReportFilters = {},
) {
  const reportPeriod = normalizeReportPeriod(period);
  const scopedDeliveries = filterReportDeliveries(deliveries, reportPeriod, filters);
  const byStatus = countBy(scopedDeliveries.map((delivery) => delivery.status));
  const byStore = countBy(scopedDeliveries.map((delivery) => delivery.store));
  const byCourier = countBy(
    scopedDeliveries
      .map((delivery) => delivery.courier)
      .filter((courier) => courier && courier !== "Sem motoboy"),
  );
  const byAttendant = countBy(
    scopedDeliveries
      .map((delivery) => delivery.attendantName?.trim() ?? "")
      .filter(Boolean),
  );
  const byPriority = countBy(scopedDeliveries.map((delivery) => delivery.priority));
  const delivered = scopedDeliveries.filter((delivery) => delivery.status === "ENTREGUE");
  const deliveredWithProof = delivered.filter((delivery) => delivery.proofCount > 0).length;

  return {
    date: reportPeriod && reportPeriod.startsAt === reportPeriod.endsAt ? reportPeriod.startsAt : null,
    startsAt: reportPeriod?.startsAt ?? null,
    endsAt: reportPeriod?.endsAt ?? null,
    total: scopedDeliveries.length,
    delivered: delivered.length,
    deliveredWithProof,
    deliveredWithoutProof: Math.max(delivered.length - deliveredWithProof, 0),
    issues: byStatus.get("PROBLEMA") ?? 0,
    canceled: byStatus.get("CANCELADA") ?? 0,
    activeCouriers: byCourier.size,
    byStatus: mapCounts(byStatus),
    byStore: mapCounts(byStore),
    byCourier: mapCounts(byCourier),
    byAttendant: mapCounts(byAttendant),
    byPriority: mapCounts(byPriority),
  };
}

export function buildDeliveryReportCsv(deliveries: ReportDeliveryExportRow[], context: DeliveryReportCsvContext) {
  const reportPeriod = normalizeReportPeriod(context.period ?? {});
  const scopedDeliveries = filterReportDeliveries(deliveries, reportPeriod, context.filters ?? {});
  const summary = buildDeliveryReport(scopedDeliveries);
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
  const rows = scopedDeliveries.map((delivery) => [
    delivery.id,
    delivery.publicCode,
    delivery.storeDailyDate ?? "",
    formatStoreDailyNumber(delivery.storeDailyNumber),
    delivery.store,
    delivery.customer,
    maskPhone(delivery.phone),
    delivery.address,
    delivery.hasMapPoint ? "sim" : "nao",
    delivery.status,
    delivery.attendantName ?? "",
    delivery.courier,
    delivery.deliveredAt ? delivery.courier : "",
    delivery.priority,
    delivery.proofCount > 0 ? "sim" : "nao",
    String(delivery.proofCount),
    delivery.createdAt,
    delivery.acceptedAt ?? "",
    delivery.collectedAt ?? "",
    delivery.deliveredAt ?? "",
    delivery.canceledAt ?? "",
  ]);
  const sections = [
    [
      ["contexto_exportacao"],
      ["gerado_em", context.generatedAt],
      ["escopo", context.scopeLabel],
      ["periodo", context.periodLabel],
      ["entregas_exportadas", String(scopedDeliveries.length)],
      ["limite_exportacao", context.exportLimit ? String(context.exportLimit) : ""],
      ["limite_atingido", context.exportLimitReached ? "sim" : "nao"],
      ["filtro_status", context.filters?.status ?? "todos"],
      ["filtro_prioridade", context.filters?.priority ?? "todas"],
      ["filtro_comprovante", context.filters?.proof ? proofFilterLabel(context.filters.proof) : "todos"],
      ["filtro_ponto_mapa", context.filters?.mapPoint ? mapPointFilterLabel(context.filters.mapPoint) : "todos"],
      ["filtro_balconista", context.filters?.attendant?.trim() || "todos"],
      [""],
    ],
    [
      ["resumo"],
      ["entregas", String(summary.total)],
      ["entregues", String(summary.delivered)],
      ["com_comprovante", String(summary.deliveredWithProof)],
      ["sem_comprovante", String(summary.deliveredWithoutProof)],
      ["ocorrencias", String(summary.issues)],
      ["canceladas", String(summary.canceled)],
      ["motoboys_ativos", String(summary.activeCouriers)],
      [""],
    ],
    buildDistributionSection("distribuicao_por_loja", summary.byStore),
    buildDistributionSection("distribuicao_por_balconista", summary.byAttendant),
    buildDistributionSection("distribuicao_por_motoboy", summary.byCourier),
    buildDistributionSection("distribuicao_por_status", summary.byStatus),
    buildDistributionSection("distribuicao_por_prioridade", summary.byPriority),
    [header, ...rows],
  ];
  return sections.flatMap((section) => section.map((row) => row.map(csvCell).join(","))).join("\n");
}

export function normalizeReportPeriod(period: DeliveryReportPeriod) {
  const startsAt = period.startsAt ?? period.date;
  const endsAt = period.endsAt ?? period.date ?? period.startsAt;
  if (!startsAt && !endsAt) return null;
  return {
    startsAt: startsAt ?? endsAt!,
    endsAt: endsAt ?? startsAt!,
  };
}

export function filterReportDeliveries<T extends ReportDeliveryRow>(
  deliveries: T[],
  period: { startsAt: string; endsAt: string } | null,
  filters: DeliveryReportFilters,
) {
  return deliveries.filter((delivery) => {
    const matchesPeriod = period ? reportDeliveryMatchesPeriod(delivery, period) : true;
    const matchesStatus = !filters.status || delivery.status === filters.status;
    const matchesPriority = !filters.priority || delivery.priority === filters.priority;
    const matchesProof =
      !filters.proof || (filters.proof === "com" ? delivery.proofCount > 0 : delivery.proofCount === 0);
    const matchesMapPoint =
      !filters.mapPoint || (filters.mapPoint === "com" ? delivery.hasMapPoint === true : delivery.hasMapPoint !== true);
    const matchesAttendant =
      !filters.attendant?.trim() || normalizeFilterText(delivery.attendantName ?? "").includes(normalizeFilterText(filters.attendant));
    return matchesPeriod && matchesStatus && matchesPriority && matchesProof && matchesMapPoint && matchesAttendant;
  });
}

export function reportDeliveryMatchesPeriod(delivery: ReportDeliveryRow, period: { startsAt: string; endsAt: string }) {
  return [delivery.createdAt, delivery.acceptedAt, delivery.collectedAt, delivery.deliveredAt, delivery.canceledAt]
    .filter(Boolean)
    .some((timestamp) => {
      const dateKey = timestamp ? toDateKey(timestamp) : "";
      return dateKey >= period.startsAt && dateKey <= period.endsAt;
    });
}

function toDateKey(timestamp: string) {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function countBy(labels: string[]) {
  const counts = new Map<string, number>();
  labels.forEach((label) => counts.set(label, (counts.get(label) ?? 0) + 1));
  return counts;
}

function mapCounts(counts: Map<string, number>) {
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function buildDistributionSection(title: string, rows: Array<{ label: string; count: number }>) {
  return [
    [title],
    ["rotulo", "quantidade"],
    ...rows.map((row) => [row.label, String(row.count)]),
    [""],
  ];
}

function maskPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length <= 4) return "****";
  const visibleEnd = digits.slice(-4);
  const visibleStart = digits.length >= 10 ? digits.slice(0, 2) : "";
  return visibleStart ? `(${visibleStart}) ****-${visibleEnd}` : `****-${visibleEnd}`;
}

export function csvCell(value: string) {
  return `"${escapeCsvFormula(value).replaceAll('"', '""')}"`;
}

export function escapeCsvFormula(value: string) {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function proofFilterLabel(value: "com" | "sem") {
  return value === "com" ? "com_comprovante" : "sem_comprovante";
}

function mapPointFilterLabel(value: "com" | "sem") {
  return value === "com" ? "no_mapa" : "sem_ponto";
}

function normalizeFilterText(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function formatStoreDailyNumber(value: number | null | undefined) {
  return value ? String(value).padStart(3, "0") : "";
}
