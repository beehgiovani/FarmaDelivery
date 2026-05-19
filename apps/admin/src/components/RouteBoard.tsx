import { Navigation } from "lucide-react";
import { useMemo } from "react";
import { buildRouteBoardSummary } from "../routeBoardSummary";
import type { Coordinates, Delivery, StoreUnit } from "../types";
import { StateBlock } from "./StateBlock";

type RouteBoardProps = {
  deliveries: Delivery[];
  stores: StoreUnit[];
  loading?: boolean;
  error?: string | null;
};

export function RouteBoard({ deliveries, stores, loading = false, error }: RouteBoardProps) {
  const orderedDeliveries = useMemo(() => buildSuggestedOrder(deliveries, stores), [deliveries, stores]);
  const locatedCount = deliveries.filter((delivery) => delivery.coordinates).length;
  const routeBoardSummary = buildRouteBoardSummary({ waiting: deliveries.length, located: locatedCount });

  return (
    <section className="routeBoard" aria-label="Entregas aguardando aceite">
      <div className="routeBoardHeader">
        <Navigation size={18} />
        <strong>Despacho dos motoboys</strong>
        <span>{routeBoardSummary}</span>
      </div>
      <div className="routeCards">
        {loading ? (
          <StateBlock tone="loading" title="Carregando despacho" description="Buscando entregas aguardando motoboy." />
        ) : error ? (
          <StateBlock tone="error" title="Despacho indisponivel" description={error} />
        ) : deliveries.length === 0 ? (
          <StateBlock
            title="Nenhuma entrega aguardando aceite"
            description="Quando a loja lancar uma entrega, ela entra aqui para os motoboys aceitarem."
          />
        ) : (
          orderedDeliveries.map((delivery, index) => (
            <article className="routeCard" key={delivery.id}>
              <div>
                <strong>
                  {delivery.routeSequence ? `${delivery.routeSequence}. ` : ""}
                  {delivery.customer}
                </strong>
                <span>{delivery.address}</span>
              </div>
              <div className="routeMeta">
                <span>{delivery.scheduledFor}</span>
                <span>{delivery.routeDistance ?? delivery.distanceHint}</span>
              </div>
              {delivery.suggestedStore && delivery.suggestedStore !== delivery.store ? (
                <span className="routeSuggestionBadge">Sugestao: avaliar envio para {delivery.suggestedStore}</span>
              ) : delivery.coordinates ? (
                <span className="routeSequenceBadge">Sequencia sugerida #{index + 1}</span>
              ) : (
                <span className="routeMissingBadge">Sem coordenada confirmada</span>
              )}
            </article>
          ))
        )}
      </div>
    </section>
  );
}

type DeliveryWithRoute = Delivery & {
  routeSequence?: number;
  routeDistance?: string;
};

function buildSuggestedOrder(deliveries: Delivery[], stores: StoreUnit[]): DeliveryWithRoute[] {
  const located = deliveries.filter((delivery) => delivery.coordinates);
  const withoutCoordinates = deliveries.filter((delivery) => !delivery.coordinates);
  const ordered: DeliveryWithRoute[] = [];
  const pending = [...located];
  let current = chooseStartPoint(pending, stores);

  while (pending.length > 0) {
    const nextIndex = findNearestIndex(current, pending);
    const next = pending.splice(nextIndex, 1)[0];
    const distanceKm = distanceBetween(current, next.coordinates!);
    ordered.push({
      ...next,
      routeSequence: ordered.length + 1,
      routeDistance: `${distanceKm.toFixed(1).replace(".", ",")} km do ponto anterior`,
    });
    current = next.coordinates!;
  }

  return [...ordered, ...withoutCoordinates];
}

function chooseStartPoint(deliveries: Delivery[], stores: StoreUnit[]): Coordinates {
  const firstDelivery = deliveries[0];
  const originStore = stores.find((store) => store.name === firstDelivery?.store && store.coordinates);
  return originStore?.coordinates ?? stores.find((store) => store.coordinates)?.coordinates ?? { lat: -23.966, lng: -46.237 };
}

function findNearestIndex(current: Coordinates, deliveries: Delivery[]) {
  return deliveries.reduce(
    (best, delivery, index) => {
      const distance = distanceBetween(current, delivery.coordinates!);
      return distance < best.distance ? { index, distance } : best;
    },
    { index: 0, distance: Number.POSITIVE_INFINITY },
  ).index;
}

function distanceBetween(a: Coordinates, b: Coordinates) {
  const earthRadiusKm = 6371;
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}
