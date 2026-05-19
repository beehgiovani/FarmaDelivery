import type { AuthSession, CourierRoute, Delivery, DeliveryEvent, DeliveryMutationResponse, DeliveryProof } from "./types";

const API_URL = import.meta.env.VITE_API_URL ?? defaultApiUrl();

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

function authHeaders(): Record<string, string> {
  return authToken ? { Authorization: `Bearer ${authToken}` } : {};
}

async function readPayload(response: Response) {
  const payload = await response.json().catch(() => null);
  if (response.status === 401) {
    window.dispatchEvent(new CustomEvent("farmadelivery:unauthorized"));
  }
  if (!response.ok) {
    throw new Error(payload?.message ?? `Falha de comunicacao: ${response.status}`);
  }
  return payload;
}

export async function login(input: { identifier: string; password: string }): Promise<AuthSession> {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return readPayload(response) as Promise<AuthSession>;
}

export async function fetchCurrentSession(token: string): Promise<AuthSession> {
  const response = await fetch(`${API_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return readPayload(response) as Promise<AuthSession>;
}

export async function fetchDeliveries(): Promise<Delivery[]> {
  const response = await fetch(`${API_URL}/deliveries`, {
    headers: authHeaders(),
  });
  return readPayload(response) as Promise<Delivery[]>;
}

export async function fetchCourierRoutes(): Promise<CourierRoute[]> {
  const response = await fetch(`${API_URL}/courier-routes`, {
    headers: authHeaders(),
  });
  return readPayload(response) as Promise<CourierRoute[]>;
}

export async function fetchDeliveryEvents(deliveryId: string): Promise<DeliveryEvent[]> {
  const response = await fetch(`${API_URL}/deliveries/${deliveryId}/events`, {
    headers: authHeaders(),
  });
  return readPayload(response) as Promise<DeliveryEvent[]>;
}

export async function acceptDelivery(input: { deliveryId: string; courierId: string }): Promise<DeliveryMutationResponse> {
  return postDeliveryAction("accept", input);
}

export async function collectDelivery(input: { deliveryId: string; notes?: string }): Promise<DeliveryMutationResponse> {
  return postDeliveryAction("collect", input);
}

export async function startDeliveryRoute(input: { deliveryId: string; notes?: string }): Promise<DeliveryMutationResponse> {
  return postDeliveryAction("start-route", input);
}

export async function completeDelivery(input: {
  deliveryId: string;
  notes?: string;
  proofId?: string;
}): Promise<DeliveryMutationResponse> {
  return postDeliveryAction("deliver", input);
}

export async function registerDeliveryProblem(input: { deliveryId: string; notes: string }): Promise<DeliveryMutationResponse> {
  return postDeliveryAction("problem", input);
}

export async function updateLocation(input: {
  courierId: string;
  latitude: number;
  longitude: number;
  available?: boolean;
}) {
  const response = await fetch(`${API_URL}/couriers/location`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify(input),
  });
  return readPayload(response);
}

export async function updateAvailability(input: {
  courierId: string;
  available: boolean;
}): Promise<{
  id: string;
  available: boolean;
}> {
  const response = await fetch(`${API_URL}/couriers/availability`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify(input),
  });
  return readPayload(response) as Promise<{ id: string; available: boolean }>;
}

export async function registerCourierDeviceToken(input: {
  courierId: string;
  deviceToken: string;
  platform: "web";
}) {
  const response = await fetch(`${API_URL}/couriers/${input.courierId}/device-token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({
      deviceToken: input.deviceToken,
      platform: input.platform,
    }),
  });
  return readPayload(response);
}

export async function uploadDeliveryProof(input: {
  deliveryId: string;
  fileName: string;
  mimeType: string;
  contentBase64: string;
}): Promise<DeliveryProof> {
  const response = await fetch(`${API_URL}/deliveries/${input.deliveryId}/proofs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({
      fileName: input.fileName,
      mimeType: input.mimeType,
      contentBase64: input.contentBase64,
    }),
  });
  return readPayload(response) as Promise<DeliveryProof>;
}

async function postDeliveryAction(action: string, input: Record<string, unknown>): Promise<DeliveryMutationResponse> {
  const response = await fetch(`${API_URL}/deliveries/${action}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify(input),
  });
  return readPayload(response) as Promise<DeliveryMutationResponse>;
}

function defaultApiUrl() {
  if (typeof window === "undefined") return "http://localhost:3333";
  const { protocol, hostname } = window.location;
  return `${protocol}//${hostname}:3333`;
}
