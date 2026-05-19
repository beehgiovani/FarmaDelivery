import type { Delivery } from "./types";

/** Conta entregas que ja tem ponto de mapa dentro da visao atual do relatorio. */
export function buildReportMapSummary(deliveries: Pick<Delivery, "coordinates">[]) {
  const withMapPoint = deliveries.filter((delivery) => Boolean(delivery.coordinates)).length;

  return {
    withMapPoint,
    withoutMapPoint: Math.max(deliveries.length - withMapPoint, 0),
  };
}
