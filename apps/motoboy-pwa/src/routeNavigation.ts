import type { CourierRoute } from "./types";

type RouteStop = CourierRoute["stops"][number];

const MAX_GOOGLE_MAPS_WAYPOINTS = 8;
const MAX_GOOGLE_MAPS_STOPS_PER_URL = MAX_GOOGLE_MAPS_WAYPOINTS + 1;
const ACTIVE_ROUTE_STATUSES = new Set<CourierRoute["status"]>(["ABERTA", "EM_ANDAMENTO"]);

export type ActiveRouteWithPendingStops = {
  route: CourierRoute;
  pendingStops: RouteStop[];
};

export type RouteMapsSegment = {
  url: string;
  includedStops: RouteStop[];
  remainingStopsCount: number;
};

/** Retorna somente rotas abertas/em andamento que ainda tenham parada pendente para o motoboy executar. */
export function activeRoutesWithPendingStops(routes: CourierRoute[]): ActiveRouteWithPendingStops[] {
  return routes
    .filter((route) => ACTIVE_ROUTE_STATUSES.has(route.status))
    .map((route) => ({
      route,
      pendingStops: pendingStopsInSequence(route.stops),
    }))
    .filter((route) => route.pendingStops.length > 0);
}

/** Ordena as paradas pendentes pela sequencia definida no backend. */
export function pendingStopsInSequence(stops: RouteStop[]) {
  return stops
    .filter((stop) => stop.status === "PENDENTE")
    .sort((a, b) => a.sequence - b.sequence);
}

/** Monta uma URL simples do Google Maps usando o primeiro trecho navegavel da rota. */
export function buildRouteMapsUrl(stops: RouteStop[]) {
  const orderedStops = navigableStopsInSequence(stops);
  const includedStops = orderedStops.slice(0, MAX_GOOGLE_MAPS_STOPS_PER_URL);
  return buildRouteMapsUrlForIncludedStops(includedStops);
}

/** Monta a URL final para o Google Maps a partir das paradas ja cortadas no limite seguro. */
function buildRouteMapsUrlForIncludedStops(includedStops: RouteStop[]) {
  const destination = includedStops.at(-1);
  if (!destination) return "https://www.google.com/maps/dir/?api=1&travelmode=driving";

  const params = new URLSearchParams({
    api: "1",
    origin: "Current Location",
    destination: stopMapsPoint(destination),
    travelmode: "driving",
  });

  const waypoints = includedStops.slice(0, -1).map(stopMapsPoint);
  if (waypoints.length) params.set("waypoints", waypoints.join("|"));

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/** Divide rotas longas no primeiro trecho compativel com o limite de waypoints do Google Maps. */
export function buildRouteMapsSegment(stops: RouteStop[]): RouteMapsSegment {
  const orderedStops = navigableStopsInSequence(stops);
  const includedStops = orderedStops.slice(0, MAX_GOOGLE_MAPS_STOPS_PER_URL);

  return {
    url: buildRouteMapsUrlForIncludedStops(includedStops),
    includedStops,
    remainingStopsCount: Math.max(orderedStops.length - includedStops.length, 0),
  };
}

/** Explica para o motoboy quando ainda ficarem paradas para abrir depois no Maps. */
export function routeSegmentNoticeText(segment: RouteMapsSegment) {
  if (segment.remainingStopsCount <= 0) return null;
  return `Maps abre as proximas ${segment.includedStops.length} paradas. Depois restam ${
    segment.remainingStopsCount
  }${segment.remainingStopsCount === 1 ? " parada." : " paradas."}`;
}

/** Ajusta o label do botao conforme a rota abre inteira ou apenas em trecho. */
export function routeMapsLinkLabel(segment: RouteMapsSegment) {
  if (segment.includedStops.length === 0) return "Enderecos pendentes";
  return segment.remainingStopsCount > 0 ? "Abrir trecho no Maps" : "Abrir Maps";
}

/** Explica quando nenhuma parada pendente tem endereco suficiente para abrir no Maps. */
export function routeMapsUnavailableText(segment: RouteMapsSegment) {
  return segment.includedStops.length === 0 ? "Nenhuma parada pendente tem endereco confirmado para abrir no Maps." : null;
}

/** Usa coordenadas quando existem; senao usa endereco textual limpo para o Maps. */
export function stopMapsPoint(stop: Pick<RouteStop, "address" | "latitude" | "longitude">) {
  if (stop.latitude != null && stop.longitude != null) {
    return `${stop.latitude},${stop.longitude}`;
  }
  return stop.address.trim();
}

/** Remove paradas sem status pendente ou sem ponto navegavel antes de montar a URL. */
function navigableStopsInSequence(stops: RouteStop[]) {
  return pendingStopsInSequence(stops).filter(hasNavigableMapsPoint);
}

/** Confirma se a parada tem coordenada ou endereco suficiente para abrir no mapa. */
function hasNavigableMapsPoint(stop: RouteStop) {
  return stop.latitude != null && stop.longitude != null || stop.address.trim().length > 0;
}
