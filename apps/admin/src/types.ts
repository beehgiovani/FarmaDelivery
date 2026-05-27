export type DeliveryStatus = "Aguardando" | "Aceita" | "Coletada" | "Em rota" | "Entregue" | "Problema" | "Cancelada";

export type DeliveryPriority = "Normal" | "Urgente" | "Retorno";

export type DeliveryDeadlineTier = "Perto" | "Medio" | "Longe";

export type AccessRole = "admin" | "loja";

export type TeamRole = "ADMIN" | "GERENTE" | "BALCONISTA_CAIXA" | "MOTOBOY";

export type AssignmentKind = "BASE" | "TEMPORARIA" | "COBERTURA" | "DEDICADA" | "RODIZIO";

export type Coordinates = {
  lat: number;
  lng: number;
};

export type StoreUnit = {
  id?: string;
  name: string;
  code: string;
  address: string;
  queue: number;
  color: string;
  baseType: "compartilhada" | "dedicada";
  weeklyHours?: StoreWeeklyHours[];
  coordinates?: Coordinates;
};

export type StoreWeeklyHours = {
  dayOfWeek: number;
  opensAt: string;
  closesAt: string;
  closed: boolean;
};

export type Delivery = {
  id: string;
  publicCode?: string;
  storeDailyDate?: string | null;
  storeDailyNumber?: number | null;
  store: string;
  suggestedStore?: string;
  customer: string;
  phone: string;
  address: string;
  status: DeliveryStatus;
  courier: string;
  attendantName?: string | null;
  notes?: string | null;
  createdAt: string;
  dispatchedAt?: string;
  collectedAt?: string;
  deliveredAt?: string;
  rawCreatedAt: string;
  rawDispatchedAt?: string;
  rawCollectedAt?: string;
  rawDeliveredAt?: string;
  rawCanceledAt?: string;
  rawScheduledFor?: string;
  scheduledFor: string;
  priority: DeliveryPriority;
  deadlineTier: DeliveryDeadlineTier;
  distanceHint: string;
  coordinates?: Coordinates;
  proofCount?: number;
};

export type DeliveryEvent = {
  id: string;
  deliveryId: string;
  type: string;
  notes?: string | null;
  metadata?: Record<string, unknown> | null;
  actor?: {
    id: string;
    name: string;
    role: TeamRole;
  } | null;
  createdAt: string;
};

export type DeliveryProof = {
  id: string;
  deliveryId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  actor?: {
    id: string;
    name: string;
    role: TeamRole;
  } | null;
  createdAt: string;
};

export type ReportCountRow = {
  label: string;
  count: number;
};

export type DeliveryReportSummary = {
  date: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  total: number;
  delivered: number;
  deliveredWithProof?: number;
  deliveredWithoutProof?: number;
  issues: number;
  canceled: number;
  activeCouriers: number;
  byStatus: ReportCountRow[];
  byStore: ReportCountRow[];
  byCourier: ReportCountRow[];
  byAttendant: ReportCountRow[];
  byPriority: ReportCountRow[];
  source?: string;
};

export type CustomerAddress = {
  id: string;
  street: string;
  number: string;
  complement?: string | null;
  neighborhood?: string | null;
  reference?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  updatedAt?: string;
};

export type CustomerLookup = {
  id: string;
  name: string;
  phone: string;
  addresses: CustomerAddress[];
};

export type GeocodeResult = {
  query: string;
  latitude: number;
  longitude: number;
  label: string;
  confidence?: number | null;
  source?: "cache";
  alternatives?: Array<{
    latitude: number;
    longitude: number;
    label: string;
    confidence?: number | null;
  }>;
};

export type Courier = {
  id?: string;
  name: string;
  store: string;
  status: "Disponivel" | "Em rota" | "Voltando" | "Ocorrencia";
  deliveries: number;
  coordinates: Coordinates;
  lastLocationAt?: string | null;
};

export type UserStoreAssignment = {
  id: string;
  kind: AssignmentKind;
  startsAt: string;
  endsAt?: string | null;
  active: boolean;
  reason?: string | null;
  user: {
    id: string;
    name: string;
    role: TeamRole;
  };
  store: {
    id: string;
    name: string;
    code: string;
  };
};

export type CourierStoreAssignment = {
  id: string;
  kind: AssignmentKind;
  startsAt: string;
  endsAt?: string | null;
  active: boolean;
  reason?: string | null;
  courier: {
    id: string;
    name: string;
    phone?: string | null;
    baseStoreName: string;
  };
  store: {
    id: string;
    name: string;
    code: string;
  };
};

export type AssignmentSummary = {
  users: UserStoreAssignment[];
  couriers: CourierStoreAssignment[];
};

export type NotificationSummary = {
  configured: boolean;
  scheduledWorkerEnabled: boolean;
  scheduledIntervalMs: number;
  activeTokens: number;
  inactiveTokens: number;
  tokenPlatforms: Array<{
    platform: string;
    active: number;
    inactive: number;
    total: number;
  }>;
  tokenDevices: Array<{
    id: string;
    courierId: string;
    courierName: string;
    baseStoreName: string;
    platform: string;
    active: boolean;
    lastSeenAt: string | null;
    updatedAt: string | null;
  }>;
  recentTotals: {
    sent: number;
    failed: number;
    inactiveTokens: number;
    targetCouriers: number;
    couriersWithoutTokens: number;
  };
  recentEvents: Array<{
    id: string;
    deliveryId: string;
    publicCode: string;
    store: string;
    notificationType: string;
    sent: number;
    failed: number;
    inactiveTokens: number;
    targetCouriers: number;
    couriersWithoutTokens: number;
    createdAt: string;
  }>;
  source?: string;
};

export type TeamUser = {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  role: TeamRole;
  active: boolean;
  store?: {
    id: string;
    name: string;
    code: string;
  } | null;
  courier?: {
    id: string;
    baseStoreName: string;
    available: boolean;
    currentLat?: number | null;
    currentLng?: number | null;
    lastLocationAt?: string | null;
  } | null;
  createdAt: string;
};

export type AuthSession = TeamUser & {
  token: string;
};

export type RouteStopKind = "coleta" | "entrega";

export type RouteStop = {
  id: string;
  kind: RouteStopKind;
  store?: string;
  deliveryId?: string;
  address: string;
  coordinates: Coordinates;
  earliestAt?: string;
  createdAt: string;
  priority: DeliveryPriority;
};

export type RoutePreviewStop = {
  id: string;
  publicCode: string;
  status: string;
  priority: string;
  customer: string;
  phone: string;
  store: string;
  address: string;
  coordinates: Coordinates;
  earliestDispatchAt: string | null;
  createdAt: string;
  sequence: number;
  distanceFromPreviousKm: number;
};

export type RoutePreview = {
  start: Coordinates & {
    label: string;
  };
  stopCount: number;
  totalDistanceKm: number;
  stops: RoutePreviewStop[];
  source?: string;
};

export type CourierRouteStatus = "ABERTA" | "EM_ANDAMENTO" | "FINALIZADA" | "CANCELADA";

export type CourierRouteStopStatus = "PENDENTE" | "CONCLUIDA" | "PULADA" | "CANCELADA";

export type CourierRouteStop = {
  id: string;
  sequence: number;
  type: string;
  status: CourierRouteStopStatus;
  address: string;
  latitude?: number | null;
  longitude?: number | null;
  earliestAt?: string | null;
  completedAt?: string | null;
  delivery?: {
    id: string;
    publicCode: string;
    customer: string;
    status: string;
  } | null;
};

export type CourierRoute = {
  id: string;
  status: CourierRouteStatus;
  courier: {
    id: string;
    name: string;
    baseStoreName: string;
  };
  startedAt?: string | null;
  finishedAt?: string | null;
  recalculatedAt?: string | null;
  createdAt: string;
  stops: CourierRouteStop[];
  source?: string;
};
