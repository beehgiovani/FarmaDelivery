import { mapRawRouteStopStatusLabel, mapRawRouteStopTypeLabel, mapRawStatusLabel } from "./apiMappers";
import type { CourierRouteStop } from "./types";

/**
 * Escolhe o titulo da parada no painel admin.
 * Preferimos o cliente da entrega; sem contexto de entrega, mostramos coleta/entrega.
 */
export function routeStopTitle(stop: CourierRouteStop): string {
  return stop.delivery?.customer?.trim() || mapRawRouteStopTypeLabel(stop.type);
}

/**
 * Resume a parada com codigo, status da entrega e status da parada.
 * Mantem o texto util mesmo quando a API nao retorna entrega vinculada.
 */
export function routeStopDetail(stop: CourierRouteStop): string {
  const parts = [
    stop.delivery?.publicCode?.trim(),
    stop.delivery?.status ? mapRawStatusLabel(stop.delivery.status) : null,
    mapRawRouteStopStatusLabel(stop.status),
  ].filter(Boolean);

  return parts.join(" - ");
}

/**
 * Texto curto para popup do mapa.
 * Junta codigo e cliente quando existir, mas cai para o tipo da parada sem quebrar.
 */
export function routeStopMapLabel(stop: Pick<CourierRouteStop, "type" | "delivery">): string {
  const publicCode = stop.delivery?.publicCode?.trim();
  const customer = stop.delivery?.customer?.trim();
  if (publicCode && customer) return `${publicCode} - ${customer}`;
  return customer || publicCode || mapRawRouteStopTypeLabel(stop.type);
}
