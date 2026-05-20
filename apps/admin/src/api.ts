import type {
  AssignmentKind,
  AssignmentSummary,
  AuthSession,
  Courier,
  CourierRoute,
  CustomerLookup,
  Delivery,
  DeliveryEvent,
  DeliveryProof,
  DeliveryPriority,
  DeliveryReportSummary,
  DeliveryStatus,
  GeocodeResult,
  NotificationSummary,
  RoutePreview,
  StoreUnit,
  TeamRole,
  TeamUser,
} from "./types";
import { supabase } from "./supabaseClient";
import {
  apiPriorityFromDeliveryPriority,
  apiStatusFromDeliveryStatus,
  mapDeliveryDeadlineTier,
  mapDeliveryPriority,
  mapDeliveryStatus,
  mapRawPriorityLabel,
  mapRawStatusLabel,
  type ApiDeliveryDeadlineTier,
  type ApiDeliveryPriority,
  type ApiDeliveryStatus,
} from "./apiMappers";

let realtimeChannelSequence = 0;

function nextRealtimeChannelName(baseName: string) {
  realtimeChannelSequence += 1;
  return `${baseName}-${Date.now()}-${realtimeChannelSequence}`;
}

type ApiStore = {
  id?: string;
  code: string;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  baseType: "COMPARTILHADA" | "DEDICADA";
  deliveryCount?: number;
  _count?: {
    deliveries?: number;
  };
  weeklyHours?: {
    dayOfWeek: number;
    opensAt: string;
    closesAt: string;
    closed: boolean;
  }[];
  StoreWeeklyHours?: {
    dayOfWeek: number;
    opensAt: string;
    closesAt: string;
    closed: boolean;
  }[];
};

type ApiDelivery = {
  id: string;
  publicCode: string;
  storeDailyDate?: string | null;
  storeDailyNumber?: number | null;
  store: string;
  customer: string;
  phone: string;
  address: string;
  status: ApiDeliveryStatus;
  courier: string;
  attendantName?: string | null;
  notes?: string | null;
  createdAt: string;
  acceptedAt: string | null;
  collectedAt: string | null;
  deliveredAt: string | null;
  canceledAt: string | null;
  earliestDispatchAt: string | null;
  priority: ApiDeliveryPriority;
  deadlineTier?: ApiDeliveryDeadlineTier;
  coordinates: { lat: number; lng: number } | null;
  proofCount?: number;
};

export type CreatedDeliveryResult = {
  id: string;
  publicCode: string;
  storeDailyDate?: string | null;
  storeDailyNumber?: number | null;
  status: ApiDeliveryStatus;
  priority: ApiDeliveryPriority;
  deadlineTier?: ApiDeliveryDeadlineTier;
  notes?: string | null;
  createdAt: string;
  earliestDispatchAt: string | null;
  store: {
    id: string;
    name: string;
  };
  customer: {
    id: string;
    name: string;
    phone: string;
  };
  address: {
    id: string;
    street: string;
    number: string;
    complement?: string | null;
  };
  source?: string;
};

type ApiTeamUser = TeamUser;

type ApiCourier = {
  id: string;
  name: string;
  phone: string | null;
  baseStoreName: string;
  available: boolean;
  currentLat: number | null;
  currentLng: number | null;
  lastLocationAt: string | null;
  active: boolean;
};

type ApiDeliveryReportSummary = DeliveryReportSummary;

const runtimeEnv = import.meta.env ?? {};
const API_URL = runtimeEnv.VITE_API_URL ?? "http://localhost:3333";
const SUPABASE_URL = runtimeEnv.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = runtimeEnv.VITE_SUPABASE_PUBLISHABLE_KEY;

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

function authHeaders(): Record<string, string> {
  return authToken ? { Authorization: `Bearer ${authToken}` } : {};
}

async function readApiPayload(response: Response): Promise<any> {
  const payload = await response.json().catch(() => null);
  if (response.status === 401) {
    notifyUnauthorizedSession();
  }
  return payload;
}

function notifyUnauthorizedSession() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("farmadelivery:unauthorized"));
}

const storeColors: Record<string, string> = {
  LOJA_1: "#0f766e",
  LOJA_2: "#2563eb",
  LOJA_3: "#7c3aed",
  LOJA_4: "#c2410c",
  LOJA_5: "#be123c",
};

const storeLabels: Record<string, string> = {
  LOJA_1: "Loja 1",
  LOJA_2: "Loja 2",
  LOJA_3: "Loja 3",
  LOJA_4: "Loja 4",
  LOJA_5: "Loja 5",
};

export type StoreFetchSource = "api" | "supabase";

export type StoreFetchResult = {
  stores: StoreUnit[];
  source: StoreFetchSource;
};

export type LoginInput = {
  identifier: string;
  password: string;
};

export type BootstrapAdminInput = {
  name: string;
  phone?: string;
  email: string;
  password: string;
};

export type CreateDeliveryInput = {
  storeId: string;
  redirectStoreId?: string;
  customerAddressId?: string;
  attendantName?: string;
  customerName: string;
  phone: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood?: string;
  reference?: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  priority: "NORMAL" | "URGENTE" | "RETORNO";
  deadlineTier: "PERTO" | "MEDIO" | "LONGE";
  notes?: string;
  earliestDispatchAt?: string;
};

export type CancelDeliveryInput = {
  deliveryId: string;
  reason: string;
  notifyCourier?: boolean;
};

export type DeliveryActionInput = {
  deliveryId: string;
  notes?: string;
};

export type AcceptDeliveryInput = DeliveryActionInput & {
  courierId: string;
};

export type CreateUserInput = {
  name: string;
  phone?: string;
  email?: string;
  password?: string;
  role: TeamRole;
  storeId?: string;
};

export type StoreWeeklyHoursInput = {
  dayOfWeek: number;
  opensAt: string;
  closesAt: string;
  closed: boolean;
};

export type CreateStoreInput = {
  code: string;
  name: string;
  address: string;
  baseType: "COMPARTILHADA" | "DEDICADA";
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  weeklyHours?: StoreWeeklyHoursInput[];
};

export type StoreDateOverrideInput = {
  date: string;
  opensAt?: string;
  closesAt?: string;
  closed: boolean;
  reason?: string;
};

export type CreateUserAssignmentInput = {
  userId: string;
  storeId: string;
  kind: AssignmentKind;
  startsAt?: string;
  endsAt?: string;
  reason?: string;
};

export type CreateCourierAssignmentInput = {
  courierId: string;
  storeId: string;
  kind: AssignmentKind;
  startsAt?: string;
  endsAt?: string;
  reason?: string;
};

export async function fetchStores(): Promise<StoreUnit[]> {
  const result = await fetchStoresWithSource();
  return result.stores;
}

export async function fetchStoresWithSource(): Promise<StoreFetchResult> {
  try {
    return {
      stores: await fetchStoresFromApi(),
      source: "api",
    };
  } catch (apiError) {
    if (messageFrom(apiError).includes("401") || messageFrom(apiError).includes("403")) {
      throw apiError;
    }

    if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
      throw apiError;
    }

    try {
      return {
        stores: await fetchStoresFromSupabase(),
        source: "supabase",
      };
    } catch (supabaseError) {
      throw new Error(
        `API local falhou (${messageFrom(apiError)}). Supabase REST tambem falhou (${messageFrom(supabaseError)}).`,
      );
    }
  }
}

async function fetchStoresFromApi(): Promise<StoreUnit[]> {
  const response = await fetch(`${API_URL}/stores`, {
    headers: authHeaders(),
  });
  const payload = await readApiPayload(response);
  if (!response.ok) {
    throw new Error(payload?.message ?? `Falha ao buscar lojas: ${response.status}`);
  }

  const stores = payload as ApiStore[];
  return mapStores(stores);
}

async function fetchStoresFromSupabase(): Promise<StoreUnit[]> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/Store?select=*,StoreWeeklyHours(*)&order=code.asc`, {
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Falha ao buscar lojas no Supabase REST: ${response.status}`);
  }

  const stores = (await response.json()) as ApiStore[];
  return mapStores(stores);
}

function mapStores(stores: ApiStore[]): StoreUnit[] {
  return stores.map((store) => ({
    id: store.id,
    name: store.name,
    code: storeLabels[store.code] ?? store.code,
    address: store.address,
    queue: store.deliveryCount ?? store._count?.deliveries ?? 0,
    color: storeColors[store.code] ?? "#275397",
    baseType: store.baseType === "DEDICADA" ? "dedicada" : "compartilhada",
    weeklyHours: store.weeklyHours ?? store.StoreWeeklyHours ?? [],
    coordinates:
      store.latitude !== null && store.longitude !== null
        ? {
            lat: store.latitude,
            lng: store.longitude,
          }
        : undefined,
  }));
}

function messageFrom(error: unknown) {
  return error instanceof Error ? error.message : "erro desconhecido";
}

function mapDelivery(delivery: ApiDelivery): Delivery {
  return {
    id: delivery.id,
    publicCode: delivery.publicCode,
    storeDailyDate: delivery.storeDailyDate ?? null,
    storeDailyNumber: delivery.storeDailyNumber ?? null,
    store: delivery.store,
    customer: delivery.customer,
    phone: delivery.phone,
    address: delivery.address,
    status: mapDeliveryStatus(delivery.status),
    courier: delivery.courier,
    attendantName: delivery.attendantName ?? null,
    notes: delivery.notes ?? null,
    createdAt: formatDateTime(delivery.createdAt),
    dispatchedAt: delivery.acceptedAt ? formatDateTime(delivery.acceptedAt) : undefined,
    collectedAt: delivery.collectedAt ? formatDateTime(delivery.collectedAt) : undefined,
    deliveredAt: delivery.deliveredAt ? formatDateTime(delivery.deliveredAt) : undefined,
    rawCreatedAt: delivery.createdAt,
    rawDispatchedAt: delivery.acceptedAt ?? undefined,
    rawCollectedAt: delivery.collectedAt ?? undefined,
    rawDeliveredAt: delivery.deliveredAt ?? undefined,
    rawCanceledAt: delivery.canceledAt ?? undefined,
    rawScheduledFor: delivery.earliestDispatchAt ?? undefined,
    scheduledFor: delivery.earliestDispatchAt ? formatDateTime(delivery.earliestDispatchAt) : "Agora",
    priority: mapDeliveryPriority(delivery.priority),
    deadlineTier: mapDeliveryDeadlineTier(delivery.deadlineTier ?? "MEDIO"),
    distanceHint: delivery.canceledAt ? `Cancelada ${formatDateTime(delivery.canceledAt)}` : "Aguardando rota",
    coordinates: delivery.coordinates ?? undefined,
    proofCount: delivery.proofCount ?? 0,
  };
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export async function createDelivery(input: CreateDeliveryInput): Promise<CreatedDeliveryResult> {
  const response = await fetch(`${API_URL}/deliveries/create-with-customer`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify(input),
  });

  const payload = await readApiPayload(response);
  if (!response.ok) {
    throw new Error(payload?.message ?? `Falha ao criar entrega: ${response.status}`);
  }

  return payload as CreatedDeliveryResult;
}

export async function login(input: LoginInput): Promise<AuthSession> {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  const payload = await readApiPayload(response);
  if (!response.ok) {
    throw new Error(payload?.message ?? `Falha ao entrar: ${response.status}`);
  }

  return payload as AuthSession;
}

export async function fetchCurrentSession(token: string): Promise<AuthSession> {
  const response = await fetch(`${API_URL}/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const payload = await readApiPayload(response);
  if (!response.ok) {
    throw new Error(payload?.message ?? `Sessao invalida: ${response.status}`);
  }

  return payload as AuthSession;
}

export async function bootstrapAdmin(input: BootstrapAdminInput): Promise<AuthSession> {
  const response = await fetch(`${API_URL}/auth/bootstrap-admin`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify(input),
  });
  const payload = await readApiPayload(response);
  if (!response.ok) {
    throw new Error(payload?.message ?? `Falha ao configurar admin: ${response.status}`);
  }

  return payload as AuthSession;
}

export async function fetchDeliveries(): Promise<Delivery[]> {
  const response = await fetch(`${API_URL}/deliveries`, {
    headers: authHeaders(),
  });
  const payload = await readApiPayload(response);
  if (!response.ok) {
    throw new Error(payload?.message ?? `Falha ao buscar entregas: ${response.status}`);
  }

  const deliveries = payload as ApiDelivery[];
  return deliveries.map(mapDelivery);
}

export async function fetchDeliveryEvents(deliveryId: string): Promise<DeliveryEvent[]> {
  const response = await fetch(`${API_URL}/deliveries/${deliveryId}/events`, {
    headers: authHeaders(),
  });
  const payload = await readApiPayload(response);
  if (!response.ok) {
    throw new Error(payload?.message ?? `Falha ao buscar historico da entrega: ${response.status}`);
  }

  const events = payload as DeliveryEvent[];
  return events;
}

export async function fetchDeliveryProofs(deliveryId: string): Promise<DeliveryProof[]> {
  const response = await fetch(`${API_URL}/deliveries/${deliveryId}/proofs`, {
    headers: authHeaders(),
  });
  const payload = await readApiPayload(response);
  if (!response.ok) {
    throw new Error(payload?.message ?? `Falha ao buscar comprovantes da entrega: ${response.status}`);
  }

  return payload as DeliveryProof[];
}

export function deliveryProofFileUrl(deliveryId: string, proofId: string) {
  return `${API_URL}/deliveries/${deliveryId}/proofs/${proofId}/file`;
}

export function deliveryProofAuthHeaders() {
  return authHeaders();
}

export async function fetchDeliveryReportSummary(input: { date?: string; startsAt?: string; endsAt?: string; storeId?: string } = {}): Promise<DeliveryReportSummary> {
  const params = new URLSearchParams();
  if (input.date) params.set("date", input.date);
  if (input.startsAt) params.set("startsAt", input.startsAt);
  if (input.endsAt) params.set("endsAt", input.endsAt);
  if (input.storeId) params.set("storeId", input.storeId);

  const query = params.toString();
  const response = await fetch(`${API_URL}/reports/deliveries-summary${query ? `?${query}` : ""}`, {
    headers: authHeaders(),
  });
  const payload = await readApiPayload(response);
  if (!response.ok) {
    throw new Error(payload?.message ?? `Falha ao buscar relatorio: ${response.status}`);
  }

  return mapDeliveryReportSummary(payload as ApiDeliveryReportSummary);
}

export async function fetchDeliveryReportCsv(
  input: {
    date?: string;
    startsAt?: string;
    endsAt?: string;
    storeId?: string;
    status?: DeliveryStatus | "";
    priority?: DeliveryPriority | "";
    proof?: "com" | "sem" | "";
    mapPoint?: "com" | "sem" | "";
    attendant?: string;
    courier?: string;
    exportLimit?: number;
  } = {},
) {
  const params = new URLSearchParams();
  if (input.date) params.set("date", input.date);
  if (input.startsAt) params.set("startsAt", input.startsAt);
  if (input.endsAt) params.set("endsAt", input.endsAt);
  if (input.storeId) params.set("storeId", input.storeId);
  if (input.status) params.set("status", apiStatusFromDeliveryStatus(input.status));
  if (input.priority) params.set("priority", apiPriorityFromDeliveryPriority(input.priority));
  if (input.proof) params.set("proof", input.proof);
  if (input.mapPoint) params.set("mapPoint", input.mapPoint);
  if (input.attendant?.trim()) params.set("attendant", input.attendant.trim());
  if (input.courier?.trim()) params.set("courier", input.courier.trim());
  if (input.exportLimit) params.set("exportLimit", String(input.exportLimit));

  const query = params.toString();
  const response = await fetch(`${API_URL}/reports/deliveries-export${query ? `?${query}` : ""}`, {
    headers: authHeaders(),
  });
  if (response.status === 401) {
    notifyUnauthorizedSession();
  }
  if (!response.ok) {
    throw new Error(`Falha ao exportar relatorio: ${response.status}`);
  }

  const blob = await response.blob();
  return {
    blob,
    fileName: fileNameFromContentDisposition(response.headers.get("Content-Disposition")) ?? "farmadelivery-relatorio.csv",
  };
}

export async function lookupCustomerByPhone(phone: string): Promise<CustomerLookup | null> {
  const response = await fetch(`${API_URL}/customers?phone=${encodeURIComponent(phone)}`, {
    headers: authHeaders(),
  });
  const payload = await readApiPayload(response);
  if (!response.ok) {
    throw new Error(payload?.message ?? `Falha ao buscar cliente: ${response.status}`);
  }

  return payload as CustomerLookup | null;
}

function mapDeliveryReportSummary(report: ApiDeliveryReportSummary): DeliveryReportSummary {
  return {
    ...report,
    byStatus: report.byStatus.map((row) => ({ ...row, label: mapRawStatusLabel(row.label) })),
    byPriority: report.byPriority.map((row) => ({ ...row, label: mapRawPriorityLabel(row.label) })),
  };
}

function fileNameFromContentDisposition(value: string | null) {
  if (!value) return null;
  const match = value.match(/filename="([^"]+)"/);
  return match?.[1] ?? null;
}

export async function geocodeAddress(input: {
  street: string;
  number: string;
  neighborhood?: string;
  city?: string;
  state?: string;
}): Promise<GeocodeResult> {
  const params = new URLSearchParams({
    street: input.street,
    number: input.number,
    city: input.city ?? "Guaruja",
    state: input.state ?? "SP",
  });
  if (input.neighborhood) params.set("neighborhood", input.neighborhood);

  const response = await fetch(`${API_URL}/geocode/address?${params.toString()}`, {
    headers: authHeaders(),
  });
  const payload = await readApiPayload(response);
  if (!response.ok) {
    throw new Error(payload?.message ?? `Falha ao buscar coordenadas: ${response.status}`);
  }

  return payload as GeocodeResult;
}

export async function cancelDelivery(input: CancelDeliveryInput) {
  const response = await fetch(`${API_URL}/deliveries/cancel`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({
      ...input,
      notifyCourier: input.notifyCourier ?? true,
    }),
  });

  const payload = await readApiPayload(response);
  if (!response.ok) {
    throw new Error(payload?.message ?? `Falha ao cancelar entrega: ${response.status}`);
  }

  return payload;
}

export async function acceptDelivery(input: AcceptDeliveryInput) {
  return postDeliveryAction("accept", input);
}

export async function collectDelivery(input: DeliveryActionInput) {
  return postDeliveryAction("collect", input);
}

export async function startDeliveryRoute(input: DeliveryActionInput) {
  return postDeliveryAction("start-route", input);
}

export async function completeDelivery(input: DeliveryActionInput) {
  return postDeliveryAction("deliver", input);
}

export async function registerDeliveryProblem(input: Required<DeliveryActionInput>) {
  return postDeliveryAction("problem", input);
}

async function postDeliveryAction(action: string, input: Record<string, unknown>) {
  const response = await fetch(`${API_URL}/deliveries/${action}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify(input),
  });

  const payload = await readApiPayload(response);
  if (!response.ok) {
    throw new Error(payload?.message ?? `Falha na acao da entrega: ${response.status}`);
  }

  return payload;
}

export async function fetchUsers(): Promise<TeamUser[]> {
  const response = await fetch(`${API_URL}/users`, {
    headers: authHeaders(),
  });
  const payload = await readApiPayload(response);
  if (!response.ok) {
    throw new Error(payload?.message ?? `Falha ao buscar usuarios: ${response.status}`);
  }

  const users = payload as ApiTeamUser[];
  return users;
}

export async function fetchCouriers(): Promise<Courier[]> {
  const response = await fetch(`${API_URL}/couriers`, {
    headers: authHeaders(),
  });
  const payload = await readApiPayload(response);
  if (!response.ok) {
    throw new Error(payload?.message ?? `Falha ao buscar motoboys: ${response.status}`);
  }

  const couriers = payload as ApiCourier[];
  return couriers
    .filter((courier) => courier.currentLat !== null && courier.currentLng !== null)
    .map((courier) => ({
      id: courier.id,
      name: courier.name,
      store: courier.baseStoreName,
      status: courier.available ? "Disponivel" : "Em rota",
      deliveries: 0,
      coordinates: {
        lat: courier.currentLat!,
        lng: courier.currentLng!,
      },
    }));
}

export async function fetchRoutePreview(input: { storeId?: string; courierId?: string } = {}): Promise<RoutePreview> {
  const params = new URLSearchParams();
  if (input.storeId) params.set("storeId", input.storeId);
  if (input.courierId) params.set("courierId", input.courierId);
  const query = params.toString();
  const response = await fetch(`${API_URL}/courier-routes/preview${query ? `?${query}` : ""}`, {
    headers: authHeaders(),
  });
  const payload = await readApiPayload(response);
  if (!response.ok) {
    throw new Error(payload?.message ?? `Falha ao gerar pre-rota: ${response.status}`);
  }

  return payload as RoutePreview;
}

export async function fetchCourierRoutes(): Promise<CourierRoute[]> {
  const response = await fetch(`${API_URL}/courier-routes`, {
    headers: authHeaders(),
  });
  const payload = await readApiPayload(response);
  if (!response.ok) {
    throw new Error(payload?.message ?? `Falha ao buscar rotas dos motoboys: ${response.status}`);
  }

  return payload as CourierRoute[];
}

export async function recalculateCourierRoute(routeId: string): Promise<CourierRoute> {
  const response = await fetch(`${API_URL}/courier-routes/recalculate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({
      routeId,
      reason: "AJUSTE_MANUAL",
    }),
  });
  const payload = await readApiPayload(response);
  if (!response.ok) {
    throw new Error(payload?.message ?? `Falha ao recalcular rota: ${response.status}`);
  }

  return payload as CourierRoute;
}

export async function createUser(input: CreateUserInput): Promise<TeamUser> {
  const response = await fetch(`${API_URL}/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify(input),
  });

  const payload = await readApiPayload(response);
  if (!response.ok) {
    throw new Error(payload?.message ?? `Falha ao criar usuario: ${response.status}`);
  }

  return payload as TeamUser;
}

export async function resetUserPassword(userId: string, password: string) {
  const response = await fetch(`${API_URL}/users/${userId}/password`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({ password }),
  });

  const payload = await readApiPayload(response);
  if (!response.ok) {
    throw new Error(payload?.message ?? `Falha ao redefinir senha: ${response.status}`);
  }

  return payload as Pick<TeamUser, "id" | "name" | "email" | "phone" | "role" | "active">;
}

export async function fetchAssignments(options: { includeInactive?: boolean } = {}): Promise<AssignmentSummary> {
  const params = new URLSearchParams();
  if (options.includeInactive) params.set("includeInactive", "true");
  const query = params.toString();
  const response = await fetch(`${API_URL}/assignments${query ? `?${query}` : ""}`, {
    headers: authHeaders(),
  });
  const payload = await readApiPayload(response);
  if (!response.ok) {
    throw new Error(payload?.message ?? `Falha ao buscar alocacoes: ${response.status}`);
  }

  return payload as AssignmentSummary;
}

export async function fetchNotificationSummary(options: { limit?: number } = {}): Promise<NotificationSummary> {
  const params = new URLSearchParams();
  if (options.limit) params.set("limit", String(options.limit));
  const query = params.toString();
  const response = await fetch(`${API_URL}/notifications/summary${query ? `?${query}` : ""}`, {
    headers: authHeaders(),
  });
  const payload = await readApiPayload(response);
  if (!response.ok) {
    throw new Error(payload?.message ?? `Falha ao buscar notificacoes: ${response.status}`);
  }

  return payload as NotificationSummary;
}

export async function createUserAssignment(input: CreateUserAssignmentInput) {
  const response = await fetch(`${API_URL}/assignments/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify(input),
  });
  const payload = await readApiPayload(response);
  if (!response.ok) {
    throw new Error(payload?.message ?? `Falha ao criar alocacao de usuario: ${response.status}`);
  }

  return payload;
}

export async function createCourierAssignment(input: CreateCourierAssignmentInput) {
  const response = await fetch(`${API_URL}/assignments/couriers`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify(input),
  });
  const payload = await readApiPayload(response);
  if (!response.ok) {
    throw new Error(payload?.message ?? `Falha ao criar alocacao de motoboy: ${response.status}`);
  }

  return payload;
}

export async function endAssignment(type: "users" | "couriers", assignmentId: string) {
  const response = await fetch(`${API_URL}/assignments/${type}/${assignmentId}/end`, {
    method: "PATCH",
    headers: authHeaders(),
  });
  const payload = await readApiPayload(response);
  if (!response.ok) {
    throw new Error(payload?.message ?? `Falha ao encerrar alocacao: ${response.status}`);
  }

  return payload;
}

export async function createStore(input: CreateStoreInput): Promise<StoreUnit> {
  const response = await fetch(`${API_URL}/stores`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify(input),
  });

  const payload = await readApiPayload(response);
  if (!response.ok) {
    throw new Error(payload?.message ?? `Falha ao criar loja: ${response.status}`);
  }

  return mapStores([payload as ApiStore])[0];
}

export async function updateStoreWeeklyHours(storeId: string, weeklyHours: StoreWeeklyHoursInput[]) {
  const response = await fetch(`${API_URL}/stores/${storeId}/weekly-hours`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({ weeklyHours }),
  });

  const payload = await readApiPayload(response);
  if (!response.ok) {
    throw new Error(payload?.message ?? `Falha ao atualizar horario: ${response.status}`);
  }

  return payload;
}

export async function createStoreDateOverride(storeId: string, input: StoreDateOverrideInput) {
  const response = await fetch(`${API_URL}/stores/${storeId}/date-overrides`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify(input),
  });

  const payload = await readApiPayload(response);
  if (!response.ok) {
    throw new Error(payload?.message ?? `Falha ao salvar horario especial: ${response.status}`);
  }

  return payload;
}

export function subscribeToUserChanges(onChange: () => void) {
  if (!supabase) return () => undefined;
  const client = supabase;

  const channel = client
    .channel(nextRealtimeChannelName("team-db-changes"))
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "User",
      },
      () => onChange(),
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "Courier",
      },
      () => onChange(),
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "UserStoreAssignment",
      },
      () => onChange(),
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "CourierStoreAssignment",
      },
      () => onChange(),
    )
    .subscribe();

  return () => {
    void client.removeChannel(channel);
  };
}

export function subscribeToDeliveryCancellation(onCancel: () => void) {
  if (!supabase) return () => undefined;
  const client = supabase;

  const channel = client
    .channel(nextRealtimeChannelName("delivery-cancellation-events"))
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "DeliveryEvent",
        filter: "type=eq.CANCELADA",
      },
      () => onCancel(),
    )
    .subscribe();

  return () => {
    void client.removeChannel(channel);
  };
}

export function subscribeToDeliveryChanges(onChange: () => void) {
  if (!supabase) return () => undefined;
  const client = supabase;

  const channel = client
    .channel(nextRealtimeChannelName("delivery-db-changes"))
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "Delivery",
      },
      () => onChange(),
    )
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "DeliveryEvent",
      },
      () => onChange(),
    )
    .subscribe();

  return () => {
    void client.removeChannel(channel);
  };
}

export function subscribeToRouteChanges(onChange: () => void) {
  if (!supabase) return () => undefined;
  const client = supabase;

  const channel = client
    .channel(nextRealtimeChannelName("courier-route-db-changes"))
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "CourierRoute",
      },
      () => onChange(),
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "RouteStop",
      },
      () => onChange(),
    )
    .subscribe();

  return () => {
    void client.removeChannel(channel);
  };
}

export function subscribeToStoreChanges(onChange: () => void) {
  if (!supabase) return () => undefined;
  const client = supabase;

  const channel = client
    .channel(nextRealtimeChannelName("store-db-changes"))
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "Store",
      },
      () => onChange(),
    )
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "Store",
      },
      () => onChange(),
    )
    .on(
      "postgres_changes",
      {
        event: "DELETE",
        schema: "public",
        table: "Store",
      },
      () => onChange(),
    )
    .subscribe();

  return () => {
    void client.removeChannel(channel);
  };
}
