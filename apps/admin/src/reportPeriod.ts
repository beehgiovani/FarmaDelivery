import type { Delivery } from "./types";

export type ReportDateRange = {
  startsAt: string;
  endsAt: string;
};

export type ReportPeriodPreset = "hoje" | "7dias" | "mes";

export const reportPeriodPresets: Array<{ value: ReportPeriodPreset; label: string }> = [
  { value: "hoje", label: "Hoje" },
  { value: "7dias", label: "7 dias" },
  { value: "mes", label: "Mes" },
];

/** Confere se alguma data operacional da entrega cai dentro do periodo do relatorio. */
export function deliveryMatchesReportDateRange(delivery: Delivery, range: ReportDateRange) {
  if (!range.startsAt && !range.endsAt) return true;
  const startsAt = range.startsAt || range.endsAt;
  const endsAt = range.endsAt || range.startsAt;
  if (startsAt > endsAt) return false;

  return deliveryDateKeys(delivery).some((dateKey) => dateKey >= startsAt && dateKey <= endsAt);
}

/** Evita consulta/exportacao com data inicial maior que data final. */
export function isReportDateRangeValid(range: ReportDateRange) {
  if (!range.startsAt || !range.endsAt) return true;
  return range.startsAt <= range.endsAt;
}

/** Gera atalhos de periodo usados no painel sem depender do horario atual da maquina nos testes. */
export function buildReportDateRangePreset(preset: ReportPeriodPreset, referenceDate = new Date()): ReportDateRange {
  const end = startOfLocalDay(referenceDate);
  if (preset === "hoje") {
    const today = toDateInputValue(end);
    return { startsAt: today, endsAt: today };
  }

  if (preset === "mes") {
    return {
      startsAt: toDateInputValue(new Date(end.getFullYear(), end.getMonth(), 1)),
      endsAt: toDateInputValue(end),
    };
  }

  return {
    startsAt: toDateInputValue(addDays(end, -6)),
    endsAt: toDateInputValue(end),
  };
}

/** Cria um trecho estavel para nome de arquivo e contexto de exportacao. */
export function reportDateLabel(range: ReportDateRange) {
  if (range.startsAt && range.endsAt && range.startsAt !== range.endsAt) {
    return `${range.startsAt}_a_${range.endsAt}`;
  }
  return range.startsAt || range.endsAt || "periodo";
}

/** Identifica qual atalho esta ativo para manter o filtro visual sincronizado. */
export function activeReportPeriodPreset(range: ReportDateRange, referenceDate = new Date()): ReportPeriodPreset | "" {
  return reportPeriodPresets.find((preset) => {
    const presetRange = buildReportDateRangePreset(preset.value, referenceDate);
    return presetRange.startsAt === range.startsAt && presetRange.endsAt === range.endsAt;
  })?.value ?? "";
}

/** Coleta todas as datas operacionais que podem colocar a entrega dentro do relatorio. */
function deliveryDateKeys(delivery: Delivery) {
  return [
    delivery.rawCreatedAt,
    delivery.rawDispatchedAt,
    delivery.rawCollectedAt,
    delivery.rawDeliveredAt,
    delivery.rawCanceledAt,
  ]
    .filter(Boolean)
    .map((timestamp) => toDateKey(timestamp!))
    .filter(Boolean);
}

/** Converte timestamp em chave yyyy-mm-dd local para comparar com input date. */
function toDateKey(timestamp: string) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Converte Date local no formato aceito pelo input type=date. */
function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Trava a referencia no inicio do dia local para os atalhos ficarem previsiveis. */
function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Soma dias preservando a base local usada nos atalhos do relatorio. */
function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}
