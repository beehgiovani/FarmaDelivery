import type { NotificationSummary } from "./types";
import { csvCell } from "./csv";

export type NotificationEventFilter = "todos" | "problemas";

export type NotificationCsvContext = {
  generatedAt: string;
  loadedEvents: number;
  visibleEvents: number;
  filter: NotificationEventFilter;
  store?: string;
  type?: string;
  startsAt?: string;
  endsAt?: string;
};

export function hasNotificationProblem(event: NotificationSummary["recentEvents"][number]) {
  return event.failed > 0 || event.couriersWithoutTokens > 0 || event.inactiveTokens > 0;
}

export function filterNotificationEvents(
  events: NotificationSummary["recentEvents"],
  filter: NotificationEventFilter,
  store = "",
  dateRange: { startsAt?: string; endsAt?: string } = {},
  type = "",
) {
  if (!isNotificationDateRangeValid(dateRange)) return [];

  return events.filter((event) => {
    const matchesStore = !store || event.store === store;
    const matchesStatus = filter === "todos" || hasNotificationProblem(event);
    const matchesDateRange = isNotificationEventInDateRange(event.createdAt, dateRange);
    const matchesType = !type || event.notificationType === type;
    return matchesStore && matchesStatus && matchesDateRange && matchesType;
  });
}

export function isNotificationDateRangeValid(dateRange: { startsAt?: string; endsAt?: string }) {
  if (!dateRange.startsAt || !dateRange.endsAt) return true;
  const start = new Date(`${dateRange.startsAt}T00:00:00`).getTime();
  const end = new Date(`${dateRange.endsAt}T23:59:59`).getTime();
  return Number.isFinite(start) && Number.isFinite(end) && start <= end;
}

export function isNotificationEventInDateRange(
  createdAt: string,
  dateRange: { startsAt?: string; endsAt?: string },
) {
  if (!dateRange.startsAt && !dateRange.endsAt) return true;

  const eventTime = new Date(createdAt).getTime();
  if (!Number.isFinite(eventTime)) return false;

  const start = dateRange.startsAt ? new Date(`${dateRange.startsAt}T00:00:00`).getTime() : Number.NEGATIVE_INFINITY;
  const end = dateRange.endsAt ? new Date(`${dateRange.endsAt}T23:59:59`).getTime() : Number.POSITIVE_INFINITY;
  return eventTime >= start && eventTime <= end;
}

export function buildNotificationEventsCsv(summary: NotificationSummary, context?: NotificationCsvContext) {
  const eventHeader = [
    "id",
    "entrega_id",
    "codigo_entrega",
    "loja",
    "tipo",
    "enviadas",
    "falhas",
    "tokens_inativados",
    "motoboys_alvo",
    "motoboys_sem_token",
    "criado_em",
  ];
  const eventRows = summary.recentEvents.map((event) => [
    event.id,
    event.deliveryId,
    event.publicCode,
    event.store,
    event.notificationType,
    String(event.sent),
    String(event.failed),
    String(event.inactiveTokens),
    String(event.targetCouriers),
    String(event.couriersWithoutTokens),
    event.createdAt,
  ]);
  const platformHeader = ["plataforma", "tokens_ativos", "tokens_inativos", "tokens_total"];
  const platformRows = summary.tokenPlatforms.map((row) => [
    row.platform,
    String(row.active),
    String(row.inactive),
    String(row.total),
  ]);
  const deviceHeader = ["dispositivo_id", "motoboy_id", "motoboy", "base", "plataforma", "ativo", "ultimo_contato", "atualizado_em"];
  const deviceRows = summary.tokenDevices.map((row) => [
    row.id,
    row.courierId,
    row.courierName,
    row.baseStoreName,
    row.platform,
    row.active ? "sim" : "nao",
    row.lastSeenAt ?? "",
    row.updatedAt ?? "",
  ]);
  const sections = [
    ...(context ? buildContextSection(context) : []),
    [eventHeader, ...eventRows],
    [["tokens_por_plataforma"]],
    [platformHeader, ...platformRows],
    [["dispositivos_por_motoboy"]],
    [deviceHeader, ...deviceRows],
  ];
  return sections.flatMap((section) => section.map((row) => row.map(csvCell).join(","))).join("\n");
}

function buildContextSection(context: NotificationCsvContext) {
  return [
    [
      ["contexto_exportacao"],
      ["gerado_em", context.generatedAt],
      ["eventos_carregados", String(context.loadedEvents)],
      ["eventos_visiveis", String(context.visibleEvents)],
      ["filtro", context.filter],
      ["loja", context.store || "todas"],
      ["tipo", context.type || "todos"],
      ["data_inicial", context.startsAt || ""],
      ["data_final", context.endsAt || ""],
      [""],
    ],
  ];
}
