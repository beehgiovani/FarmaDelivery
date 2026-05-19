import { deliveryDailyNumberLabel, deliveryPrimaryCodeLabel } from "./deliveryDisplayCode";
import { deliveryStatusLabel } from "./deliveryStatusLabels";
import { routeStopTypeLabel } from "./routeStopTypeLabels";
import type { CourierRoute } from "./types";

type RouteStop = CourierRoute["stops"][number];

/**
 * Define o titulo principal da parada na rota do motoboy.
 * Quando a API manda a entrega vinculada, mostramos o codigo publico; senao usamos o tipo da parada.
 */
export function routeStopTitle(stop: RouteStop): string {
  return stop.delivery ? deliveryPrimaryCodeLabel(stop.delivery) : routeStopTypeLabel(stop.type);
}

/**
 * Monta a linha complementar da parada com cliente e status.
 * Se a parada nao tiver entrega vinculada, nao forca texto extra.
 */
export function routeStopDetails(stop: RouteStop): string | null {
  if (!stop.delivery) return null;

  const customer = stop.delivery.customer.trim();
  const status = deliveryStatusLabel(stop.delivery.status);
  const dailyNumber = deliveryDailyNumberLabel(stop.delivery);
  const code = dailyNumber ? stop.delivery.publicCode : null;
  const parts = [code, customer, status].filter(Boolean);

  return parts.join(" - ");
}
