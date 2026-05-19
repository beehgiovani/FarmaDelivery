import type { Delivery } from "./types";

/** Abre a entrega no Maps usando coordenadas quando existirem; senao busca pelo endereco. */
export function deliveryMapSearchUrl(delivery: Pick<Delivery, "address" | "coordinates">) {
  const query = delivery.coordinates
    ? `${delivery.coordinates.lat},${delivery.coordinates.lng}`
    : delivery.address.trim();

  if (!query) return null;

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
