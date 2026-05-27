import type { Delivery } from "./types";
import { deliveryPrimaryCodeLabel } from "./deliveryDisplayCode";

export type LocalNotificationSignal = {
  title: string;
  body: string;
};

const statusLabels: Record<Delivery["status"], string> = {
  RASCUNHO: "Rascunho",
  AGUARDANDO_MOTOBOY: "Disponivel",
  ACEITA_PELO_MOTOBOY: "Aceita",
  COLETADA: "Coletada",
  EM_ROTA: "Em rota",
  ENTREGUE: "Entregue",
  PROBLEMA: "Problema",
  CANCELADA: "Cancelada",
};

/** Compara a carga anterior e atual para gerar uma notificacao local relevante ao motoboy. */
export function summarizeOperationalChanges(
  previous: Delivery[],
  next: Delivery[],
  hasPreviousSnapshot = previous.length > 0,
): LocalNotificationSignal | null {
  if (!hasPreviousSnapshot) return null;

  const previousById = new Map(previous.map((delivery) => [delivery.id, delivery]));
  const newAvailable = next.find((delivery) => {
    const previousDelivery = previousById.get(delivery.id);
    return delivery.status === "AGUARDANDO_MOTOBOY" && previousDelivery?.status !== "AGUARDANDO_MOTOBOY";
  });
  if (newAvailable) {
    return {
      title: "Nova entrega disponivel",
      body: `${deliveryPrimaryCodeLabel(newAvailable)} - ${newAvailable.customer}`,
    };
  }

  const changedActive = next.find((delivery) => {
    const previousDelivery = previousById.get(delivery.id);
    if (!previousDelivery) return false;
    const wasMine = ["ACEITA_PELO_MOTOBOY", "COLETADA", "EM_ROTA", "PROBLEMA"].includes(previousDelivery.status);
    return wasMine && previousDelivery.status !== delivery.status;
  });
  if (changedActive) {
    return {
      title: "Entrega atualizada",
      body: `${deliveryPrimaryCodeLabel(changedActive)} agora esta como ${statusLabels[changedActive.status]}.`,
    };
  }

  return null;
}

/** Bloqueia notificacoes de novas corridas quando o motoboy esta indisponivel. */
export function summarizeOperationalChangesForAvailability(
  previous: Delivery[],
  next: Delivery[],
  available: boolean,
  hasPreviousSnapshot = previous.length > 0,
): LocalNotificationSignal | null {
  if (!available) return null;
  return summarizeOperationalChanges(previous, next, hasPreviousSnapshot);
}

/** Evita enviar GPS toda hora; so libera por tempo minimo ou deslocamento real. */
export function shouldSendTrackedLocation(
  lastLocation: { latitude: number; longitude: number; sentAt: number } | null,
  latitude: number,
  longitude: number,
  now = Date.now(),
) {
  if (!lastLocation) return true;
  const elapsedMs = now - lastLocation.sentAt;
  const movedMeters = distanceInMeters(lastLocation.latitude, lastLocation.longitude, latitude, longitude);
  return elapsedMs >= 30000 || movedMeters >= 35;
}

/** Centraliza as condicoes para o rastreamento aberto no PWA ficar ativo. */
export function canTrackOpenAppLocation(input: {
  hasSession: boolean;
  hasCourier: boolean;
  trackingEnabled: boolean;
  operationallyActive: boolean;
}) {
  return input.hasSession && input.hasCourier && input.trackingEnabled && input.operationallyActive;
}

/** Calcula distancia aproximada entre duas coordenadas para limitar envio de localizacao. */
export function distanceInMeters(fromLat: number, fromLng: number, toLat: number, toLng: number) {
  const earthRadiusMeters = 6371000;
  const dLat = toRadians(toLat - fromLat);
  const dLng = toRadians(toLng - fromLng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(fromLat)) * Math.cos(toRadians(toLat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Converte graus em radianos para o calculo de distancia geografica. */
function toRadians(value: number) {
  return (value * Math.PI) / 180;
}
