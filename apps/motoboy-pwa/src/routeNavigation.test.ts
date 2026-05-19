import assert from "node:assert/strict";
import test from "node:test";
import {
  activeRoutesWithPendingStops,
  buildRouteMapsSegment,
  buildRouteMapsUrl,
  pendingStopsInSequence,
  routeMapsLinkLabel,
  routeMapsUnavailableText,
  routeSegmentNoticeText,
  stopMapsPoint,
} from "./routeNavigation";
import type { CourierRoute } from "./types";

test("keeps only pending stops ordered by route sequence", () => {
  const stops = pendingStopsInSequence([
    stop(3, "Rua 3"),
    stop(1, "Rua concluida", "CONCLUIDA"),
    stop(2, "Rua 2"),
    stop(1, "Rua 1"),
  ]);

  assert.deepEqual(stops.map((item) => item.address), ["Rua 1", "Rua 2", "Rua 3"]);
});

test("uses last pending stop as maps destination and previous stops as waypoints", () => {
  const url = new URL(buildRouteMapsUrl([stop(2, "Rua 2"), stop(1, "Rua 1"), stop(3, "Rua 3")]));

  assert.equal(url.searchParams.get("origin"), "Current Location");
  assert.equal(url.searchParams.get("destination"), "Rua 3");
  assert.equal(url.searchParams.get("waypoints"), "Rua 1|Rua 2");
  assert.equal(url.searchParams.get("travelmode"), "driving");
});

test("ignores completed route stops when building maps sequence", () => {
  const url = new URL(buildRouteMapsUrl([stop(1, "Rua concluida", "CONCLUIDA"), stop(2, "Rua pendente")]));

  assert.equal(url.searchParams.get("destination"), "Rua pendente");
  assert.equal(url.searchParams.get("waypoints"), null);
});

test("builds a safe maps URL when there are no pending stops", () => {
  const url = new URL(buildRouteMapsUrl([stop(1, "Rua concluida", "CONCLUIDA")]));

  assert.equal(url.searchParams.get("api"), "1");
  assert.equal(url.searchParams.get("travelmode"), "driving");
  assert.equal(url.searchParams.get("destination"), null);
});

test("limits Google Maps to a continuous first route segment", () => {
  const stops = Array.from({ length: 12 }, (_, index) => stop(index + 1, `Rua ${index + 1}`));
  const url = new URL(buildRouteMapsUrl(stops));

  assert.equal(url.searchParams.get("destination"), "Rua 9");
  assert.deepEqual(url.searchParams.get("waypoints")?.split("|"), [
    "Rua 1",
    "Rua 2",
    "Rua 3",
    "Rua 4",
    "Rua 5",
    "Rua 6",
    "Rua 7",
    "Rua 8",
  ]);
});

test("reports route stops left out of the current Google Maps segment", () => {
  const stops = Array.from({ length: 12 }, (_, index) => stop(index + 1, `Rua ${index + 1}`));
  const segment = buildRouteMapsSegment(stops);
  const url = new URL(segment.url);

  assert.equal(segment.includedStops.length, 9);
  assert.equal(segment.remainingStopsCount, 3);
  assert.equal(url.searchParams.get("destination"), "Rua 9");
});

test("keeps direct maps URL and route segment URL equivalent", () => {
  const stops = Array.from({ length: 12 }, (_, index) => stop(index + 1, `Rua ${index + 1}`));

  assert.equal(buildRouteMapsSegment(stops).url, buildRouteMapsUrl(stops));
});

test("builds route segment notice only when stops remain", () => {
  const completeSegment = buildRouteMapsSegment(Array.from({ length: 3 }, (_, index) => stop(index + 1, `Rua ${index + 1}`)));
  const longSegment = buildRouteMapsSegment(Array.from({ length: 12 }, (_, index) => stop(index + 1, `Rua ${index + 1}`)));
  const oneRemainingSegment = buildRouteMapsSegment(
    Array.from({ length: 10 }, (_, index) => stop(index + 1, `Rua ${index + 1}`)),
  );

  assert.equal(routeSegmentNoticeText(completeSegment), null);
  assert.equal(routeSegmentNoticeText(longSegment), "Maps abre as proximas 9 paradas. Depois restam 3 paradas.");
  assert.equal(routeSegmentNoticeText(oneRemainingSegment), "Maps abre as proximas 9 paradas. Depois restam 1 parada.");
});

test("uses a route maps label that matches full or partial segments", () => {
  const completeSegment = buildRouteMapsSegment(Array.from({ length: 3 }, (_, index) => stop(index + 1, `Rua ${index + 1}`)));
  const longSegment = buildRouteMapsSegment(Array.from({ length: 12 }, (_, index) => stop(index + 1, `Rua ${index + 1}`)));
  const emptySegment = buildRouteMapsSegment([stop(1, "   ")]);

  assert.equal(routeMapsLinkLabel(completeSegment), "Abrir Maps");
  assert.equal(routeMapsLinkLabel(longSegment), "Abrir trecho no Maps");
  assert.equal(routeMapsLinkLabel(emptySegment), "Enderecos pendentes");
});

test("explains when a route has no pending stop that can open in Maps", () => {
  const emptySegment = buildRouteMapsSegment([stop(1, "   ")]);
  const completeSegment = buildRouteMapsSegment([stop(1, "Rua 1")]);

  assert.equal(routeMapsUnavailableText(emptySegment), "Nenhuma parada pendente tem endereco confirmado para abrir no Maps.");
  assert.equal(routeMapsUnavailableText(completeSegment), null);
});

test("prefers coordinates over address for maps points", () => {
  assert.equal(stopMapsPoint({ address: "Rua Teste", latitude: -23.961, longitude: -46.333 }), "-23.961,-46.333");
});

test("trims address maps points when coordinates are unavailable", () => {
  assert.equal(stopMapsPoint({ address: "  Rua Teste  ", latitude: null, longitude: null }), "Rua Teste");
});

test("skips pending stops without coordinates or address when building maps route", () => {
  const url = new URL(buildRouteMapsUrl([stop(1, "  "), stop(2, "Rua Valida")]));
  const segment = buildRouteMapsSegment([stop(1, "  "), stop(2, "Rua Valida")]);

  assert.equal(url.searchParams.get("destination"), "Rua Valida");
  assert.equal(url.searchParams.get("waypoints"), null);
  assert.deepEqual(segment.includedStops.map((item) => item.address), ["Rua Valida"]);
});

test("keeps pending stops grouped by active route", () => {
  const routes = activeRoutesWithPendingStops([
    route("route-1", "ABERTA", [stop(2, "Rua 2"), stop(1, "Rua 1")]),
    route("route-2", "EM_ANDAMENTO", [stop(1, "Rua 3"), stop(2, "Rua 4", "CONCLUIDA")]),
    route("route-3", "FINALIZADA", [stop(1, "Rua ignorada")]),
  ]);

  assert.equal(routes.length, 2);
  assert.equal(routes[0].route.id, "route-1");
  assert.deepEqual(routes[0].pendingStops.map((stop) => stop.address), ["Rua 1", "Rua 2"]);
  assert.equal(routes[1].route.id, "route-2");
  assert.deepEqual(routes[1].pendingStops.map((stop) => stop.address), ["Rua 3"]);
});

function route(
  id: string,
  status: CourierRoute["status"],
  stops: CourierRoute["stops"],
): CourierRoute {
  return {
    id,
    status,
    courier: {
      id: "courier-1",
      name: "Motoboy Teste",
      baseStoreName: "Drogaria Santo Antonio",
    },
    createdAt: "2026-05-15T12:00:00.000Z",
    stops,
  };
}

function stop(
  sequence: number,
  address: string,
  status: CourierRoute["stops"][number]["status"] = "PENDENTE",
): CourierRoute["stops"][number] {
  return {
    id: `stop-${sequence}`,
    sequence,
    type: "ENTREGA",
    status,
    address,
    latitude: null,
    longitude: null,
    earliestAt: null,
    completedAt: null,
    delivery: null,
  };
}
