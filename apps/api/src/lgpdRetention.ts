import { createHash } from "node:crypto";
import { csvCell } from "./deliveryReport";

export const lgpdRetentionPolicy = {
  deliveryRetentionMonths: 24,
  proofBinaryRetentionDays: 180,
  customerInactiveMonths: 24,
  courierLocationInactiveHours: 24,
  deviceTokenInactiveDays: 90,
  detailedLogRetentionDays: 90,
  aggregateEventRetentionMonths: 12,
} as const;

const terminalDeliveryStatuses = new Set(["ENTREGUE", "CANCELADA"]);
const openDeliveryStatuses = new Set(["RASCUNHO", "AGUARDANDO_MOTOBOY", "ACEITA_PELO_MOTOBOY", "COLETADA", "EM_ROTA", "PROBLEMA"]);

export type LgpdRetentionAction = "keep" | "anonymize" | "delete_binary" | "clear_location" | "deactivate";

export type LgpdRetentionDecision = {
  action: LgpdRetentionAction;
  reason: string;
  cutoff?: string;
};

export type DeliveryRetentionInput = {
  id: string;
  status: string;
  createdAt: string | Date;
  deliveredAt?: string | Date | null;
  canceledAt?: string | Date | null;
  hasOpenSupport?: boolean;
};

export type DeliveryProofRetentionInput = {
  id: string;
  deliveryId: string;
  deliveredAt?: string | Date | null;
  createdAt: string | Date;
  storagePath?: string | null;
};

export type CustomerRetentionInput = {
  id: string;
  lastDeliveryAt?: string | Date | null;
  hasOpenDelivery?: boolean;
  hasOpenSupport?: boolean;
};

export type CourierLocationRetentionInput = {
  courierId: string;
  available: boolean;
  lastLocationAt?: string | Date | null;
  currentLat?: unknown;
  currentLng?: unknown;
};

export type CourierDeviceTokenRetentionInput = {
  id: string;
  active: boolean;
  lastSeenAt?: string | Date | null;
};

export type CustomerAddressAnonymizationInput = {
  id: string;
};

export type LgpdRetentionPlanInput = {
  now?: string | Date;
  deliveries?: DeliveryRetentionInput[];
  proofs?: DeliveryProofRetentionInput[];
  customers?: CustomerRetentionInput[];
  courierLocations?: CourierLocationRetentionInput[];
  deviceTokens?: CourierDeviceTokenRetentionInput[];
};

export type LgpdRetentionPlan = {
  generatedAt: string;
  deliveriesToAnonymize: Array<DeliveryRetentionInput & { decision: LgpdRetentionDecision }>;
  proofBinariesToDelete: Array<DeliveryProofRetentionInput & { decision: LgpdRetentionDecision }>;
  customersToAnonymize: Array<CustomerRetentionInput & { decision: LgpdRetentionDecision }>;
  courierLocationsToClear: Array<CourierLocationRetentionInput & { decision: LgpdRetentionDecision }>;
  deviceTokensToDeactivate: Array<CourierDeviceTokenRetentionInput & { decision: LgpdRetentionDecision }>;
};

export type LgpdRetentionImpactSummary = {
  totalActions: number;
  byCategory: Array<{ category: string; action: LgpdRetentionAction; count: number }>;
  byReason: Array<{ category: string; action: LgpdRetentionAction; reason: string; count: number; cutoff?: string }>;
};

export type LgpdRetentionImpactCsvContext = {
  generatedAt?: string;
  requestedBy?: string;
  dryRun?: boolean;
};

export type DeliveryAnonymizationPatch = {
  notes: null;
};

export type CustomerAnonymizationPatch = {
  name: string;
  phone: string;
};

export type CustomerAddressAnonymizationPatch = {
  street: string;
  number: string;
  complement: null;
  neighborhood: null;
  reference: null;
  latitude: null;
  longitude: null;
  active: false;
};

export type CourierLocationClearPatch = {
  currentLat: null;
  currentLng: null;
  lastLocationAt: null;
};

export type DeviceTokenDeactivationPatch = {
  token: string;
  active: false;
};

export type ProofBinaryDeletionCommand = {
  proofId: string;
  deliveryId: string;
  storagePath: string;
  preserveMetadata: true;
};

export function buildLgpdRetentionPlan(input: LgpdRetentionPlanInput): LgpdRetentionPlan {
  const now = parseDate(input.now ?? new Date()) ?? new Date();

  return {
    generatedAt: now.toISOString(),
    deliveriesToAnonymize: (input.deliveries ?? [])
      .map((delivery) => ({ ...delivery, decision: deliveryRetentionDecision(delivery, now) }))
      .filter((delivery) => delivery.decision.action === "anonymize"),
    proofBinariesToDelete: (input.proofs ?? [])
      .map((proof) => ({ ...proof, decision: deliveryProofRetentionDecision(proof, now) }))
      .filter((proof) => proof.decision.action === "delete_binary"),
    customersToAnonymize: (input.customers ?? [])
      .map((customer) => ({ ...customer, decision: customerRetentionDecision(customer, now) }))
      .filter((customer) => customer.decision.action === "anonymize"),
    courierLocationsToClear: (input.courierLocations ?? [])
      .map((location) => ({ ...location, decision: courierLocationRetentionDecision(location, now) }))
      .filter((location) => location.decision.action === "clear_location"),
    deviceTokensToDeactivate: (input.deviceTokens ?? [])
      .map((token) => ({ ...token, decision: deviceTokenRetentionDecision(token, now) }))
      .filter((token) => token.decision.action === "deactivate"),
  };
}

export function summarizeLgpdRetentionImpact(plan: LgpdRetentionPlan): LgpdRetentionImpactSummary {
  const rows = lgpdImpactRows(plan);
  const categoryCounts = new Map<string, { category: string; action: LgpdRetentionAction; count: number }>();
  const reasonCounts = new Map<string, { category: string; action: LgpdRetentionAction; reason: string; count: number; cutoff?: string }>();

  for (const row of rows) {
    const categoryKey = `${row.category}:${row.action}`;
    const existingCategory = categoryCounts.get(categoryKey);
    categoryCounts.set(categoryKey, {
      category: row.category,
      action: row.action,
      count: (existingCategory?.count ?? 0) + row.count,
    });

    const reasonKey = `${row.category}:${row.action}:${row.reason}:${row.cutoff ?? ""}`;
    const existingReason = reasonCounts.get(reasonKey);
    reasonCounts.set(reasonKey, {
      category: row.category,
      action: row.action,
      reason: row.reason,
      cutoff: row.cutoff,
      count: (existingReason?.count ?? 0) + row.count,
    });
  }

  return {
    totalActions: rows.reduce((total, row) => total + row.count, 0),
    byCategory: [...categoryCounts.values()].sort(sortImpactRows),
    byReason: [...reasonCounts.values()].sort(sortImpactRows),
  };
}

export function buildLgpdRetentionImpactCsv(plan: LgpdRetentionPlan, context: LgpdRetentionImpactCsvContext = {}) {
  const summary = summarizeLgpdRetentionImpact(plan);
  const generatedAt = context.generatedAt ?? new Date().toISOString();
  const sections = [
    [
      ["contexto_lgpd"],
      ["gerado_em", generatedAt],
      ["plano_gerado_em", plan.generatedAt],
      ["modo", context.dryRun === false ? "execucao" : "dry-run"],
      ["solicitado_por", context.requestedBy ?? ""],
      ["total_acoes_planejadas", String(summary.totalActions)],
      [""],
    ],
    [
      ["resumo_por_categoria"],
      ["categoria", "acao", "quantidade"],
      ...summary.byCategory.map((row) => [row.category, row.action, String(row.count)]),
      [""],
    ],
    [
      ["resumo_por_motivo"],
      ["categoria", "acao", "motivo", "quantidade", "corte"],
      ...summary.byReason.map((row) => [row.category, row.action, row.reason, String(row.count), row.cutoff ?? ""]),
    ],
  ];

  return sections.flatMap((section) => section.map((row) => row.map(csvCell).join(","))).join("\n");
}

export function anonymizedLabel(prefix: string, id: string) {
  return `${prefix}_${shortHash(id)}`;
}

export function buildDeliveryAnonymizationPatch(_delivery: DeliveryRetentionInput): DeliveryAnonymizationPatch {
  return { notes: null };
}

export function buildCustomerAnonymizationPatch(customer: CustomerRetentionInput): CustomerAnonymizationPatch {
  const label = anonymizedLabel("cliente_anonimizado", customer.id);
  return {
    name: label,
    phone: anonymizedLabel("telefone_anonimizado", customer.id),
  };
}

export function buildCustomerAddressAnonymizationPatch(address: CustomerAddressAnonymizationInput): CustomerAddressAnonymizationPatch {
  return {
    street: anonymizedLabel("endereco_anonimizado", address.id),
    number: "s/n",
    complement: null,
    neighborhood: null,
    reference: null,
    latitude: null,
    longitude: null,
    active: false,
  };
}

export function buildCourierLocationClearPatch(_location: CourierLocationRetentionInput): CourierLocationClearPatch {
  return {
    currentLat: null,
    currentLng: null,
    lastLocationAt: null,
  };
}

export function buildDeviceTokenDeactivationPatch(token: CourierDeviceTokenRetentionInput): DeviceTokenDeactivationPatch {
  return {
    token: anonymizedLabel("token_revogado", token.id),
    active: false,
  };
}

export function buildProofBinaryDeletionCommand(proof: DeliveryProofRetentionInput): ProofBinaryDeletionCommand | null {
  if (!proof.storagePath) return null;
  return {
    proofId: proof.id,
    deliveryId: proof.deliveryId,
    storagePath: proof.storagePath,
    preserveMetadata: true,
  };
}

export function deliveryRetentionDecision(delivery: DeliveryRetentionInput, now: Date): LgpdRetentionDecision {
  const cutoff = subtractMonths(now, lgpdRetentionPolicy.deliveryRetentionMonths);
  const terminalAt = parseDate(delivery.deliveredAt) ?? parseDate(delivery.canceledAt);

  if (delivery.hasOpenSupport) return keep("delivery_has_open_support");
  if (openDeliveryStatuses.has(delivery.status) || !terminalDeliveryStatuses.has(delivery.status)) {
    return keep("delivery_not_terminal");
  }
  if (!terminalAt) return keep("delivery_missing_terminal_date");
  if (terminalAt > cutoff) return keep("delivery_inside_retention_window", cutoff);

  return anonymize("delivery_terminal_outside_retention_window", cutoff);
}

export function deliveryProofRetentionDecision(proof: DeliveryProofRetentionInput, now: Date): LgpdRetentionDecision {
  const cutoff = subtractDays(now, lgpdRetentionPolicy.proofBinaryRetentionDays);
  const deliveredAt = parseDate(proof.deliveredAt);
  const createdAt = parseDate(proof.createdAt);
  const referenceDate = deliveredAt ?? createdAt;

  if (!proof.storagePath) return keep("proof_without_binary_path");
  if (!referenceDate) return keep("proof_missing_reference_date");
  if (referenceDate > cutoff) return keep("proof_inside_binary_retention_window", cutoff);

  return { action: "delete_binary", reason: "proof_binary_outside_retention_window", cutoff: cutoff.toISOString() };
}

export function customerRetentionDecision(customer: CustomerRetentionInput, now: Date): LgpdRetentionDecision {
  const cutoff = subtractMonths(now, lgpdRetentionPolicy.customerInactiveMonths);
  const lastDeliveryAt = parseDate(customer.lastDeliveryAt);

  if (customer.hasOpenDelivery) return keep("customer_has_open_delivery");
  if (customer.hasOpenSupport) return keep("customer_has_open_support");
  if (!lastDeliveryAt) return keep("customer_without_delivery_history");
  if (lastDeliveryAt > cutoff) return keep("customer_inside_inactivity_window", cutoff);

  return anonymize("customer_inactive_outside_retention_window", cutoff);
}

export function courierLocationRetentionDecision(location: CourierLocationRetentionInput, now: Date): LgpdRetentionDecision {
  const cutoff = subtractHours(now, lgpdRetentionPolicy.courierLocationInactiveHours);
  const lastLocationAt = parseDate(location.lastLocationAt);
  const hasCoordinates = location.currentLat !== null && location.currentLat !== undefined && location.currentLng !== null && location.currentLng !== undefined;

  if (!hasCoordinates) return keep("courier_without_current_coordinates");
  if (location.available) return keep("courier_available");
  if (!lastLocationAt) return { action: "clear_location", reason: "courier_unavailable_without_location_timestamp" };
  if (lastLocationAt > cutoff) return keep("courier_recently_unavailable", cutoff);

  return { action: "clear_location", reason: "courier_unavailable_location_outside_window", cutoff: cutoff.toISOString() };
}

export function deviceTokenRetentionDecision(token: CourierDeviceTokenRetentionInput, now: Date): LgpdRetentionDecision {
  const cutoff = subtractDays(now, lgpdRetentionPolicy.deviceTokenInactiveDays);
  const lastSeenAt = parseDate(token.lastSeenAt);

  if (!token.active) return { action: "deactivate", reason: "token_already_inactive" };
  if (!lastSeenAt) return { action: "deactivate", reason: "token_missing_last_seen" };
  if (lastSeenAt > cutoff) return keep("token_recently_seen", cutoff);

  return { action: "deactivate", reason: "token_inactive_outside_window", cutoff: cutoff.toISOString() };
}

function keep(reason: string, cutoff?: Date): LgpdRetentionDecision {
  return { action: "keep", reason, cutoff: cutoff?.toISOString() };
}

function anonymize(reason: string, cutoff: Date): LgpdRetentionDecision {
  return { action: "anonymize", reason, cutoff: cutoff.toISOString() };
}

function lgpdImpactRows(plan: LgpdRetentionPlan) {
  return [
    ...plan.deliveriesToAnonymize.map((item) => impactRow("entregas", item.decision)),
    ...plan.proofBinariesToDelete.map((item) => impactRow("comprovantes", item.decision)),
    ...plan.customersToAnonymize.map((item) => impactRow("clientes", item.decision)),
    ...plan.courierLocationsToClear.map((item) => impactRow("localizacao_motoboy", item.decision)),
    ...plan.deviceTokensToDeactivate.map((item) => impactRow("tokens_notificacao", item.decision)),
  ];
}

function impactRow(category: string, decision: LgpdRetentionDecision) {
  return {
    category,
    action: decision.action,
    reason: decision.reason,
    cutoff: decision.cutoff,
    count: 1,
  };
}

function sortImpactRows<T extends { category: string; action: string; reason?: string }>(left: T, right: T) {
  return (
    left.category.localeCompare(right.category) ||
    left.action.localeCompare(right.action) ||
    (left.reason ?? "").localeCompare(right.reason ?? "")
  );
}

function shortHash(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

function parseDate(value?: string | Date | null) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function subtractDays(date: Date, days: number) {
  return new Date(date.getTime() - days * 24 * 60 * 60 * 1000);
}

function subtractHours(date: Date, hours: number) {
  return new Date(date.getTime() - hours * 60 * 60 * 1000);
}

function subtractMonths(date: Date, months: number) {
  const copy = new Date(date.getTime());
  copy.setUTCMonth(copy.getUTCMonth() - months);
  return copy;
}
