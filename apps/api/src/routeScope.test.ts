import assert from "node:assert/strict";
import test from "node:test";
import {
  routePreviewDeliveryRestFilter,
  routeScopeRestFilter,
  serializeRestRoute,
  visibleRouteStopsForSession,
} from "./routes/routes";

test("builds route preview REST filter for courier available store scope", () => {
  assert.equal(
    routePreviewDeliveryRestFilter(
      { role: "MOTOBOY", courierId: "courier-1" },
      null,
      ["store-1", "store-2"],
    ),
    "&or=(courierId.eq.courier-1,and(status.eq.AGUARDANDO_MOTOBOY,storeId.in.(store-1,store-2)))",
  );
});

test("builds route preview REST filter with selected store for store logins", () => {
  assert.equal(
    routePreviewDeliveryRestFilter(
      { role: "GERENTE" },
      ["store-1", "store-2"],
      null,
      "store-2",
    ),
    "&storeId=eq.store-2",
  );
  assert.equal(
    routePreviewDeliveryRestFilter(
      { role: "GERENTE" },
      ["store-1", "store-2"],
      null,
    ),
    "&storeId=in.(store-1,store-2)",
  );
});

test("builds route scope REST filter by profile", () => {
  assert.equal(routeScopeRestFilter({ role: "MOTOBOY", courierId: "courier-1" }, null), "&courierId=eq.courier-1");
  assert.equal(
    routeScopeRestFilter({ role: "GERENTE" }, ["store-1"]),
    "&RouteStop.Delivery.storeId=eq.store-1",
  );
  assert.equal(
    routeScopeRestFilter({ role: "GERENTE" }, []),
    "&RouteStop.Delivery.storeId=eq.__no_store_scope__",
  );
  assert.equal(routeScopeRestFilter({ role: "ADMIN" }, null), "");
});

test("filters shared route stops to the store login scope", () => {
  const stops = [
    { id: "stop-1", delivery: { storeId: "store-1" } },
    { id: "stop-2", delivery: { storeId: "store-2" } },
    { id: "stop-3", delivery: null },
  ];

  assert.deepEqual(
    visibleRouteStopsForSession(stops, { role: "GERENTE" }, ["store-2"]).map((stop) => stop.id),
    ["stop-2"],
  );
});

test("keeps all route stops for unrestricted route viewers", () => {
  const stops = [
    { id: "stop-1", delivery: { storeId: "store-1" } },
    { id: "stop-2", delivery: { storeId: "store-2" } },
  ];

  assert.deepEqual(
    visibleRouteStopsForSession(stops, { role: "ADMIN" }, null).map((stop) => stop.id),
    ["stop-1", "stop-2"],
  );
});

test("serializes Supabase REST routes with the same client contract as Prisma routes", () => {
  const route = serializeRestRoute({
    id: "route-1",
    status: "ABERTA",
    startedAt: null,
    finishedAt: null,
    recalculatedAt: "2026-05-17T12:00:00.000Z",
    createdAt: "2026-05-17T11:00:00.000Z",
    Courier: {
      id: "courier-1",
      baseStoreName: "Asturias",
      User: {
        name: "Joao Motoboy",
      },
    },
    RouteStop: [
      {
        id: "stop-2",
        sequence: 2,
        type: "ENTREGA",
        status: "PENDENTE",
        address: "Rua 2",
        latitude: "-23.997",
        longitude: "-46.281",
        earliestAt: null,
        completedAt: null,
        Delivery: {
          id: "delivery-2",
          storeId: "store-1",
          publicCode: "ENT-000002",
          storeDailyDate: "2026-05-17",
          storeDailyNumber: 2,
          status: "EM_ROTA",
          Customer: {
            name: "Maria",
          },
        },
      },
      {
        id: "stop-1",
        sequence: 1,
        type: "COLETA",
        status: "PENDENTE",
        address: "Loja Asturias",
        latitude: null,
        longitude: null,
        earliestAt: "2026-05-17T13:00:00.000Z",
        completedAt: null,
        Delivery: null,
      },
    ],
  });

  assert.deepEqual(route, {
    id: "route-1",
    status: "ABERTA",
    courier: {
      id: "courier-1",
      name: "Joao Motoboy",
      baseStoreName: "Asturias",
    },
    startedAt: null,
    finishedAt: null,
    recalculatedAt: "2026-05-17T12:00:00.000Z",
    stops: [
      {
        id: "stop-1",
        sequence: 1,
        type: "COLETA",
        status: "PENDENTE",
        address: "Loja Asturias",
        latitude: null,
        longitude: null,
        delivery: null,
        earliestAt: "2026-05-17T13:00:00.000Z",
        completedAt: null,
      },
      {
        id: "stop-2",
        sequence: 2,
        type: "ENTREGA",
        status: "PENDENTE",
        address: "Rua 2",
        latitude: -23.997,
        longitude: -46.281,
        delivery: {
          id: "delivery-2",
          publicCode: "ENT-000002",
          storeDailyDate: "2026-05-17",
          storeDailyNumber: 2,
          customer: "Maria",
          status: "EM_ROTA",
        },
        earliestAt: null,
        completedAt: null,
      },
    ],
    createdAt: "2026-05-17T11:00:00.000Z",
    source: "supabase-rest",
  });
});

test("serializes Supabase REST routes after applying store login stop scope", () => {
  const route = serializeRestRoute(
    {
      id: "route-1",
      status: "ABERTA",
      createdAt: "2026-05-17T11:00:00.000Z",
      Courier: {
        id: "courier-1",
        baseStoreName: "Asturias",
        User: {
          name: "Joao Motoboy",
        },
      },
      RouteStop: [
        {
          id: "stop-1",
          sequence: 1,
          type: "ENTREGA",
          status: "PENDENTE",
          address: "Rua 1",
          Delivery: {
            id: "delivery-1",
            storeId: "store-1",
            publicCode: "ENT-000001",
            status: "EM_ROTA",
            Customer: {
              name: "Maria",
            },
          },
        },
        {
          id: "stop-2",
          sequence: 2,
          type: "ENTREGA",
          status: "PENDENTE",
          address: "Rua 2",
          Delivery: {
            id: "delivery-2",
            storeId: "store-2",
            publicCode: "ENT-000002",
            status: "EM_ROTA",
            Customer: {
              name: "Jose",
            },
          },
        },
      ],
    },
    { role: "GERENTE" },
    ["store-2"],
  );

  assert.deepEqual(route.stops.map((stop) => stop.id), ["stop-2"]);
});
