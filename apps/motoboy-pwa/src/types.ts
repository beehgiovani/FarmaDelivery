export type TeamRole = "ADMIN" | "GERENTE" | "BALCONISTA_CAIXA" | "MOTOBOY";

export type AuthSession = {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  role: TeamRole;
  active: boolean;
  token: string;
  courier?: {
    id: string;
    baseStoreName: string;
    available: boolean;
    currentLat?: number | null;
    currentLng?: number | null;
    lastLocationAt?: string | null;
  } | null;
};

export type DeliveryStatus =
  | "RASCUNHO"
  | "AGUARDANDO_MOTOBOY"
  | "ACEITA_PELO_MOTOBOY"
  | "COLETADA"
  | "EM_ROTA"
  | "ENTREGUE"
  | "PROBLEMA"
  | "CANCELADA";

export type Delivery = {
  id: string;
  publicCode: string;
  storeDailyDate?: string | null;
  storeDailyNumber?: number | null;
  store: string;
  customer: string;
  phone: string;
  address: string;
  status: DeliveryStatus;
  courier: string;
  notes?: string | null;
  createdAt: string;
  acceptedAt: string | null;
  collectedAt: string | null;
  deliveredAt: string | null;
  canceledAt: string | null;
  earliestDispatchAt: string | null;
  priority: "NORMAL" | "URGENTE" | "RETORNO";
  deadlineTier?: "PERTO" | "MEDIO" | "LONGE";
  coordinates: { lat: number; lng: number } | null;
};

export type DeliveryMutationResponse = {
  id: string;
  publicCode: string;
  storeDailyDate?: string | null;
  storeDailyNumber?: number | null;
  status: DeliveryStatus;
  courier?: string | null;
  acceptedAt?: string | null;
  collectedAt?: string | null;
  deliveredAt?: string | null;
  canceledAt?: string | null;
  event?: {
    id: string;
    type: string;
    notes?: string | null;
    createdAt: string;
  } | null;
};

export type DeliveryEvent = {
  id: string;
  deliveryId: string;
  type: string;
  notes?: string | null;
  createdAt: string;
  actor?: {
    id: string;
    name: string;
    role: TeamRole;
  } | null;
};

export type DeliveryProof = {
  id: string;
  deliveryId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  createdAt: string;
};

export type CourierRoute = {
  id: string;
  status: "ABERTA" | "EM_ANDAMENTO" | "FINALIZADA" | "CANCELADA";
  courier: {
    id: string;
    name: string;
    baseStoreName: string;
  };
  createdAt: string;
  startedAt?: string | null;
  finishedAt?: string | null;
  recalculatedAt?: string | null;
  stops: Array<{
    id: string;
    sequence: number;
    type: string;
    status: "PENDENTE" | "CONCLUIDA" | "PULADA" | "CANCELADA";
    address: string;
    latitude?: number | null;
    longitude?: number | null;
    earliestAt?: string | null;
    completedAt?: string | null;
    delivery?: {
      id: string;
      publicCode: string;
      storeDailyDate?: string | null;
      storeDailyNumber?: number | null;
      customer: string;
      status: DeliveryStatus;
    } | null;
  }>;
};
