import { randomUUID } from "node:crypto";

type SupabaseRestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  query?: string;
  body?: unknown;
  prefer?: string;
};

export type SupabaseStore = {
  id: string;
  code: string;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  baseType: "COMPARTILHADA" | "DEDICADA";
  active: boolean;
  createdAt: string;
  updatedAt: string;
  StoreWeeklyHours?: SupabaseStoreWeeklyHours[];
};

export type SupabaseStoreWeeklyHours = {
  id: string;
  storeId: string;
  dayOfWeek: number;
  opensAt: string;
  closesAt: string;
  closed: boolean;
};

export type SupabaseStoreDateOverride = {
  id: string;
  storeId: string;
  date: string;
  opensAt: string | null;
  closesAt: string | null;
  closed: boolean;
  reason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SupabaseCustomer = {
  id: string;
  name: string;
  phone: string;
  CustomerAddress?: SupabaseCustomerAddress[];
};

export type SupabaseUser = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  passwordHash: string;
  role: "ADMIN" | "GERENTE" | "BALCONISTA_CAIXA" | "MOTOBOY";
  active: boolean;
  storeId: string | null;
  createdAt: string;
  updatedAt: string;
  Store?: Pick<SupabaseStore, "id" | "name" | "code"> | null;
  Courier?: SupabaseCourier | null;
};

export type SupabaseCourier = {
  id: string;
  userId: string;
  baseStoreName: string;
  available: boolean;
  currentLat: number | null;
  currentLng: number | null;
  lastLocationAt: string | null;
  User?: Pick<SupabaseUser, "id" | "name" | "phone"> | null;
};

export type SupabaseCustomerAddress = {
  id: string;
  customerId: string;
  street: string;
  number: string;
  complement: string | null;
  neighborhood: string | null;
  reference: string | null;
  latitude?: number | null;
  longitude?: number | null;
  active?: boolean;
  updatedAt?: string;
};

export type SupabaseDelivery = {
  id: string;
  publicCode: string;
  storeDailyDate?: string | null;
  storeDailyNumber?: number | null;
  storeId: string;
  customerId: string;
  customerAddressId: string;
  status: string;
  priority: string;
  deadlineTier?: string;
  notes: string | null;
  createdAt: string;
  earliestDispatchAt: string | null;
  acceptedAt?: string | null;
  collectedAt?: string | null;
  deliveredAt?: string | null;
  canceledAt?: string | null;
  courierId?: string | null;
  Store?: Pick<SupabaseStore, "id" | "name" | "latitude" | "longitude">;
  Courier?: {
    id: string;
    User?: {
      name: string;
    } | null;
  } | null;
  Customer?: Pick<SupabaseCustomer, "id" | "name" | "phone">;
  CustomerAddress?: Pick<
    SupabaseCustomerAddress,
    "id" | "street" | "number" | "complement" | "neighborhood" | "latitude" | "longitude"
  >;
  DeliveryProof?: Array<{ id: string }>;
  DeliveryEvent?: Array<Pick<SupabaseDeliveryEvent, "type" | "metadata">>;
};

export type SupabaseDeliveryEvent = {
  id: string;
  deliveryId: string;
  type: string;
  notes: string | null;
  metadata?: Record<string, unknown> | null;
  actorUserId?: string | null;
  User?: Pick<SupabaseUser, "id" | "name" | "role"> | null;
  createdAt: string;
};

const supabaseUrl = readEnv("SUPABASE_URL");
const serviceKey = readEnv("SUPABASE_SERVICE_ROLE_JWT") ?? readEnv("SUPABASE_SECRET_KEY");

/** Confere se a API pode cair para Supabase REST quando Prisma nao alcancar o Postgres. */
export function canUseSupabaseRest() {
  return Boolean(supabaseUrl && serviceKey);
}

/** Executa chamada server-side ao PostgREST usando service key somente no backend. */
export async function supabaseRest<T>(table: string, options: SupabaseRestOptions = {}): Promise<T> {
  if (!supabaseUrl || !serviceKey) {
    throw new Error("Supabase REST server credentials are not configured.");
  }

  const url = new URL(`${supabaseUrl}/rest/v1/${table}`);
  if (options.query) {
    const query = new URLSearchParams(options.query);
    query.forEach((value, key) => url.searchParams.append(key, value));
  }

  const response = await fetch(url, {
    method: options.method ?? "GET",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      ...(options.prefer ? { Prefer: options.prefer } : {}),
    },
    body: options.body ? JSON.stringify(prepareBody(table, options)) : undefined,
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(payload?.message ?? `Supabase REST ${table} failed with ${response.status}`);
  }

  return payload as T;
}

/** Le variavel de ambiente aceitando valores colados com aspas no .env. */
function readEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) return undefined;
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

/** Prepara inserts REST para manter id e updatedAt quando o Prisma nao esta no caminho. */
function prepareBody(table: string, options: SupabaseRestOptions) {
  if (options.method !== "POST" || !options.body) return options.body;
  if (Array.isArray(options.body)) return options.body.map((item) => prepareInsertRow(table, item));
  return prepareInsertRow(table, options.body);
}

/** Completa campos minimos que o banco espera em inserts feitos pelo PostgREST. */
function prepareInsertRow(table: string, body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return body;

  const row = { ...(body as Record<string, unknown>) };
  if (!("id" in row)) row.id = randomUUID();
  if (tablesWithUpdatedAt.has(table) && !("updatedAt" in row)) row.updatedAt = new Date().toISOString();
  return row;
}

const tablesWithUpdatedAt = new Set([
  "Store",
  "StoreWeeklyHours",
  "StoreDateOverride",
  "User",
  "UserStoreAssignment",
  "Courier",
  "CourierStoreAssignment",
  "CourierDeviceToken",
  "Customer",
  "CustomerAddress",
  "Delivery",
  "DeliveryDailySequence",
  "CourierRoute",
  "RouteStop",
]);
