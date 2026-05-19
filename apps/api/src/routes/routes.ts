import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import { recalculateRouteSchema, routePreviewQuerySchema } from "../contracts";
import { validationError } from "../http";
import { prisma } from "../prisma";
import { requireAuth } from "../auth";
import { canUseSupabaseRest, supabaseRest, type SupabaseDelivery, type SupabaseStore } from "../supabaseRest";
import {
  deliveryStoreRestFilter,
  hasStoreAccess,
  isStoreLoginRole,
  motoboyDeliveryRestFilter,
  resolveCourierStoreScope,
  resolveUserStoreScope,
} from "../accessScope";

export async function courierRouteRoutes(app: FastifyInstance) {
  app.get("/courier-routes", async (request, reply) => {
    const session = await requireAuth(request, reply, ["ADMIN", "GERENTE", "MOTOBOY"]);
    if (!session) return;
    const userStoreScope = await resolveUserStoreScope(session);

    try {
      const routes = await prisma.courierRoute.findMany({
        where: {
          status: {
            in: ["ABERTA", "EM_ANDAMENTO"],
          },
          ...routeScopeWhere(session, userStoreScope),
        },
        orderBy: { createdAt: "desc" },
        include: {
          courier: {
            include: {
              user: true,
            },
          },
          stops: {
            orderBy: { sequence: "asc" },
            include: {
              delivery: {
                include: {
                  customer: true,
                },
              },
            },
          },
        },
      });

      return routes.map((route) => serializeRoute(route, session, userStoreScope));
    } catch (error) {
      app.log.error({ error }, "courier routes list error");
      if (canUseSupabaseRest()) {
        const routes = await supabaseRest<Array<Record<string, unknown>>>("CourierRoute", {
          query: `select=*,Courier(id,baseStoreName,User(name)),RouteStop(*,Delivery(id,storeId,publicCode,storeDailyDate,storeDailyNumber,status,Customer(name)))&status=in.(ABERTA,EM_ANDAMENTO)&order=createdAt.desc${routeScopeRestFilter(session, userStoreScope)}`,
        });
        return routes.map((route) => serializeRestRoute(route, session, userStoreScope));
      }

      return reply.status(503).send({
        error: "DATABASE_UNAVAILABLE",
        message: "Nao foi possivel listar rotas dos motoboys.",
      });
    }
  });

  app.get("/courier-routes/preview", async (request, reply) => {
    const session = await requireAuth(request, reply, ["ADMIN", "GERENTE", "MOTOBOY"]);
    if (!session) return;

    const parsed = routePreviewQuerySchema.safeParse(request.query);
    if (!parsed.success) return validationError(reply, parsed.error);
    const userStoreScope = await resolveUserStoreScope(session);
    const courierStoreScope = await resolveCourierStoreScope(session);
    const scopedStoreId = resolveRoutePreviewStoreId(session, userStoreScope, courierStoreScope, parsed.data.storeId);
    const scopedCourierId =
      session.role === "MOTOBOY" && session.courierId ? session.courierId : parsed.data.courierId;

    try {
      const courier = scopedCourierId
        ? await prisma.courier.findUnique({
            where: { id: scopedCourierId },
          })
        : null;
      const store = scopedStoreId
        ? await prisma.store.findUnique({
            where: { id: scopedStoreId },
          })
        : null;

      const deliveries = await prisma.delivery.findMany({
        where: {
          ...routePreviewDeliveryWhere(session, userStoreScope, courierStoreScope, scopedStoreId),
          customerAddress: {
            latitude: { not: null },
            longitude: { not: null },
          },
        },
        include: {
          store: true,
          customer: true,
          customerAddress: true,
        },
        orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
      });

      const start = chooseStartPoint({
        courier:
          courier?.currentLat && courier.currentLng
            ? {
                lat: Number(courier.currentLat),
                lng: Number(courier.currentLng),
                label: "Localizacao atual do motoboy",
              }
            : null,
        store:
          store?.latitude && store.longitude
            ? {
                lat: Number(store.latitude),
                lng: Number(store.longitude),
                label: store.name,
              }
            : null,
      });

      return buildPreview(
        start,
        deliveries.map((delivery) => ({
          id: delivery.id,
          publicCode: delivery.publicCode,
          status: delivery.status,
          priority: delivery.priority,
          customer: delivery.customer.name,
          phone: delivery.customer.phone,
          store: delivery.store.name,
          address: [delivery.customerAddress.street, delivery.customerAddress.number, delivery.customerAddress.complement]
            .filter(Boolean)
            .join(", "),
          coordinates: {
            lat: Number(delivery.customerAddress.latitude),
            lng: Number(delivery.customerAddress.longitude),
          },
          earliestDispatchAt: delivery.earliestDispatchAt?.toISOString() ?? null,
          createdAt: delivery.createdAt.toISOString(),
        })),
      );
    } catch (error) {
      app.log.error({ error }, "route preview error");
      if (canUseSupabaseRest()) {
        try {
          const scopeQuery = routePreviewDeliveryRestFilter(session, userStoreScope, courierStoreScope, scopedStoreId);
          const deliveries = await supabaseRest<SupabaseDelivery[]>("Delivery", {
            query:
              "select=*,Store(id,name,latitude,longitude),Customer(id,name,phone),CustomerAddress(id,street,number,complement,latitude,longitude)" +
              "&status=in.(AGUARDANDO_MOTOBOY,ACEITA_PELO_MOTOBOY,COLETADA,EM_ROTA)" +
              scopeQuery +
              "&order=createdAt.asc",
          });
          const stores = scopedStoreId
            ? await supabaseRest<SupabaseStore[]>("Store", {
                query: `select=id,name,latitude,longitude&id=eq.${scopedStoreId}`,
              })
            : [];
          const store = stores[0];
          const start = chooseStartPoint({
            courier: null,
            store:
              store?.latitude && store.longitude
                ? {
                    lat: store.latitude,
                    lng: store.longitude,
                    label: store.name,
                  }
                : null,
          });

          return {
            ...buildPreview(
              start,
              deliveries
                .filter((delivery) => delivery.CustomerAddress?.latitude && delivery.CustomerAddress.longitude)
                .map((delivery) => ({
                  id: delivery.id,
                  publicCode: delivery.publicCode,
                  status: delivery.status,
                  priority: delivery.priority,
                  customer: delivery.Customer?.name ?? "Cliente",
                  phone: delivery.Customer?.phone ?? "",
                  store: delivery.Store?.name ?? "Loja",
                  address: [
                    delivery.CustomerAddress?.street,
                    delivery.CustomerAddress?.number,
                    delivery.CustomerAddress?.complement,
                  ]
                    .filter(Boolean)
                    .join(", "),
                  coordinates: {
                    lat: delivery.CustomerAddress!.latitude!,
                    lng: delivery.CustomerAddress!.longitude!,
                  },
                  earliestDispatchAt: delivery.earliestDispatchAt,
                  createdAt: delivery.createdAt,
                })),
            ),
            source: "supabase-rest",
          };
        } catch (restError) {
          app.log.error({ error: restError }, "route preview supabase rest error");
        }
      }

      return reply.status(503).send({
        error: "DATABASE_UNAVAILABLE",
        message: "Nao foi possivel gerar pre-rota.",
      });
    }
  });

  app.post("/courier-routes/recalculate", async (request, reply) => {
    const session = await requireAuth(request, reply, ["ADMIN", "GERENTE", "MOTOBOY"]);
    if (!session) return;

    const parsed = recalculateRouteSchema.safeParse(request.body);
    if (!parsed.success) return validationError(reply, parsed.error);

    if (session.role === "MOTOBOY") {
      const routeOwner = await prisma.courierRoute.findUnique({
        where: { id: parsed.data.routeId },
        select: { courierId: true },
      });
      if (!session.courierId || routeOwner?.courierId !== session.courierId) {
        return reply.status(403).send({
          error: "FORBIDDEN",
          message: "Motoboy so pode recalcular a propria rota.",
        });
      }
    }

    try {
      const route = await prisma.courierRoute.findUnique({
        where: { id: parsed.data.routeId },
        include: {
          courier: {
            include: {
              user: true,
            },
          },
          stops: {
            orderBy: { sequence: "asc" },
            include: {
              delivery: {
                include: {
                  customer: true,
                  store: true,
                },
              },
            },
          },
        },
      });

      if (!route) {
        return reply.status(404).send({
          error: "ROUTE_NOT_FOUND",
          message: "Rota nao encontrada.",
        });
      }

      if (!["ABERTA", "EM_ANDAMENTO"].includes(route.status)) {
        return reply.status(409).send({
          error: "ROUTE_NOT_ACTIVE",
          message: "Apenas rotas abertas ou em andamento podem ser recalculadas.",
        });
      }

      const pendingStops = route.stops.filter(
        (stop) => stop.status === "PENDENTE" && stop.latitude !== null && stop.longitude !== null,
      );

      if (pendingStops.length < 2) {
        return reply.status(409).send({
          error: "NOT_ENOUGH_STOPS",
          message: "A rota precisa de pelo menos duas paradas pendentes com coordenadas para recalcular.",
        });
      }

      const start = chooseStartPoint({
        courier:
          route.courier.currentLat && route.courier.currentLng
            ? {
                lat: Number(route.courier.currentLat),
                lng: Number(route.courier.currentLng),
                label: "Localizacao atual do motoboy",
              }
            : null,
        store: firstDeliveryStorePoint(route.stops),
      });

      const orderedStops = orderRouteStops(start, pendingStops);
      const sequenceBase = Math.max(
        0,
        ...route.stops.filter((stop) => stop.status !== "PENDENTE").map((stop) => stop.sequence),
      );
      const sequenceByStopId = new Map(orderedStops.map((stop, index) => [stop.id, sequenceBase + index + 1]));
      const previousSequenceByDelivery = new Map(
        route.stops
          .filter((stop) => stop.deliveryId)
          .map((stop) => [stop.deliveryId!, stop.sequence]),
      );

      await prisma.$transaction(async (tx) => {
        await Promise.all(
          orderedStops.map((stop, index) =>
            tx.routeStop.update({
              where: { id: stop.id },
              data: { sequence: -(index + 1) },
            }),
          ),
        );

        await Promise.all(
          orderedStops.map((stop) =>
            tx.routeStop.update({
              where: { id: stop.id },
              data: { sequence: sequenceByStopId.get(stop.id)! },
            }),
          ),
        );

        await tx.courierRoute.update({
          where: { id: route.id },
          data: { recalculatedAt: new Date() },
        });

        await Promise.all(
          orderedStops
            .filter((stop) => stop.deliveryId)
            .map((stop) =>
              tx.deliveryEvent.create({
                data: {
                  deliveryId: stop.deliveryId!,
                  type: "ROTA_RECALCULADA",
                  notes: "Rota recalculada automaticamente.",
                  actorUserId: session.sub,
                  metadata: {
                    routeId: route.id,
                    reason: parsed.data.reason,
                    previousSequence: previousSequenceByDelivery.get(stop.deliveryId!),
                    currentSequence: sequenceByStopId.get(stop.id),
                  },
                },
              }),
            ),
        );
      });

      const updatedRoute = await prisma.courierRoute.findUnique({
        where: { id: route.id },
        include: {
          courier: {
            include: {
              user: true,
            },
          },
          stops: {
            orderBy: { sequence: "asc" },
            include: {
              delivery: {
                include: {
                  customer: true,
                },
              },
            },
          },
        },
      });

      return updatedRoute ? serializeRoute(updatedRoute) : reply.status(404).send({ error: "ROUTE_NOT_FOUND" });
    } catch (error) {
      app.log.error({ error }, "route recalculate error");
      return reply.status(503).send({
        error: "DATABASE_UNAVAILABLE",
        message: "Nao foi possivel recalcular a rota.",
      });
    }
  });
}

type RoutePoint = {
  lat: number;
  lng: number;
  label: string;
};

type RouteDelivery = {
  id: string;
  publicCode: string;
  status: string;
  priority: string;
  customer: string;
  phone: string;
  store: string;
  address: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  earliestDispatchAt: string | null;
  createdAt: string;
};

type RouteStopForOrdering = {
  id: string;
  sequence: number;
  latitude: unknown;
  longitude: unknown;
  deliveryId: string | null;
};

type RouteStopWithStore = RouteStopForOrdering & {
  delivery?: {
    store?: {
      name: string;
      latitude: unknown;
      longitude: unknown;
    };
  } | null;
};

type RouteForResponse = {
  id: string;
  status: string;
  courier: {
    id: string;
    baseStoreName: string;
    user: {
      name: string;
    };
  };
  startedAt: Date | null;
  finishedAt: Date | null;
  recalculatedAt: Date | null;
  createdAt: Date;
  stops: Array<{
    id: string;
    sequence: number;
    type: string;
    status: string;
    address: string;
    latitude: unknown;
    longitude: unknown;
    delivery: {
      id: string;
      storeId: string;
      publicCode: string;
      storeDailyDate?: Date | string | null;
      storeDailyNumber?: number | null;
      customer: {
        name: string;
      };
      status: string;
    } | null;
    earliestAt: Date | null;
    completedAt: Date | null;
  }>;
};

type RouteStopWithOptionalStoreScope = {
  delivery?: {
    storeId?: string | null;
  } | null;
  Delivery?: {
    storeId?: string | null;
  } | null;
};

/** Decide qual loja entra na pre-rota conforme perfil e escopo ativo. */
function resolveRoutePreviewStoreId(
  session: { role: string },
  userStoreScope: string[] | null,
  courierStoreScope: string[] | null,
  requestedStoreId?: string,
) {
  if (isStoreLoginRole(session.role)) {
    if (requestedStoreId && hasStoreAccess(userStoreScope, requestedStoreId)) return requestedStoreId;
    return userStoreScope?.[0];
  }

  if (session.role === "MOTOBOY") {
    if (requestedStoreId && hasStoreAccess(courierStoreScope, requestedStoreId)) return requestedStoreId;
    return undefined;
  }

  return requestedStoreId;
}

/** Monta filtro Prisma da pre-rota com entregas ativas e visiveis para o perfil. */
function routePreviewDeliveryWhere(
  session: { role: string; courierId?: string | null },
  userStoreScope: string[] | null,
  courierStoreScope: string[] | null,
  scopedStoreId?: string,
): Prisma.DeliveryWhereInput {
  const activeStatuses = ["AGUARDANDO_MOTOBOY", "ACEITA_PELO_MOTOBOY", "COLETADA", "EM_ROTA"] as const;
  const base: Prisma.DeliveryWhereInput = {
    status: {
      in: [...activeStatuses],
    },
  };

  if (isStoreLoginRole(session.role)) {
    return {
      ...base,
      storeId: scopedStoreId ?? { in: userStoreScope ?? [] },
    };
  }

  if (session.role === "MOTOBOY" && session.courierId) {
    return {
      ...base,
      ...(scopedStoreId ? { storeId: scopedStoreId } : {}),
      OR: [
        { courierId: session.courierId },
        {
          courierId: null,
          status: "AGUARDANDO_MOTOBOY",
          storeId: { in: courierStoreScope ?? [] },
        },
      ],
    };
  }

  return {
    ...base,
    ...(scopedStoreId ? { storeId: scopedStoreId } : {}),
  };
}

/** Monta filtro REST da pre-rota mantendo a mesma regra de visibilidade do Prisma. */
export function routePreviewDeliveryRestFilter(
  session: { role: string; courierId?: string | null },
  userStoreScope: string[] | null,
  courierStoreScope: string[] | null,
  scopedStoreId?: string,
) {
  if (isStoreLoginRole(session.role)) {
    return scopedStoreId ? `&storeId=eq.${scopedStoreId}` : deliveryStoreRestFilter(userStoreScope ?? []);
  }

  if (session.role === "MOTOBOY" && session.courierId) {
    return `${scopedStoreId ? `&storeId=eq.${scopedStoreId}` : ""}${motoboyDeliveryRestFilter(
      session.courierId,
      courierStoreScope ?? [],
    )}`;
  }

  return scopedStoreId ? `&storeId=eq.${scopedStoreId}` : "";
}

/** Escopa consulta Prisma de rotas: motoboy ve as proprias, loja ve paradas das lojas permitidas. */
function routeScopeWhere(
  session: { role: string; storeId?: string | null; courierId?: string | null },
  userStoreScope: string[] | null,
) {
  if (session.role === "MOTOBOY" && session.courierId) {
    return { courierId: session.courierId };
  }

  if (isStoreLoginRole(session.role)) {
    return {
      stops: {
        some: {
          delivery: {
            storeId: { in: userStoreScope ?? [] },
          },
        },
      },
    };
  }

  return {};
}

/** Escopa consulta REST de rotas com o mesmo recorte usado no caminho Prisma. */
export function routeScopeRestFilter(
  session: { role: string; storeId?: string | null; courierId?: string | null },
  userStoreScope: string[] | null,
) {
  if (session.role === "MOTOBOY" && session.courierId) {
    return `&courierId=eq.${session.courierId}`;
  }

  if (isStoreLoginRole(session.role)) {
    const scope = userStoreScope ?? [];
    if (scope.length === 0) return "&RouteStop.Delivery.storeId=eq.__no_store_scope__";
    if (scope.length === 1) return `&RouteStop.Delivery.storeId=eq.${scope[0]}`;
    return `&RouteStop.Delivery.storeId=in.(${scope.join(",")})`;
  }

  return "";
}

/** Filtra paradas visiveis para login de loja sem expor entregas de outras unidades. */
export function visibleRouteStopsForSession<T extends RouteStopWithOptionalStoreScope>(
  stops: T[],
  session: { role: string },
  userStoreScope: string[] | null,
) {
  if (!isStoreLoginRole(session.role)) return stops;

  const allowedStoreIds = new Set(userStoreScope ?? []);
  return stops.filter((stop) => {
    const storeId = stop.delivery?.storeId ?? stop.Delivery?.storeId;
    return storeId ? allowedStoreIds.has(storeId) : false;
  });
}

/**
 * Normaliza a rota vinda do Prisma para o contrato usado por admin, PWA e Android.
 * Tambem corta paradas fora do escopo quando quem olha e login de loja.
 */
function serializeRoute(
  route: RouteForResponse,
  session: { role: string } = { role: "ADMIN" },
  userStoreScope: string[] | null = null,
) {
  const visibleStops = visibleRouteStopsForSession(route.stops, session, userStoreScope);

  return {
    id: route.id,
    status: route.status,
    courier: {
      id: route.courier.id,
      name: route.courier.user.name,
      baseStoreName: route.courier.baseStoreName,
    },
    startedAt: route.startedAt?.toISOString() ?? null,
    finishedAt: route.finishedAt?.toISOString() ?? null,
    recalculatedAt: route.recalculatedAt?.toISOString() ?? null,
    stops: visibleStops.map((stop) => ({
      id: stop.id,
      sequence: stop.sequence,
      type: stop.type,
      status: stop.status,
      address: stop.address,
      latitude: stop.latitude ? Number(stop.latitude) : null,
      longitude: stop.longitude ? Number(stop.longitude) : null,
      delivery: stop.delivery
        ? {
            id: stop.delivery.id,
            publicCode: stop.delivery.publicCode,
            storeDailyDate: normalizeRouteDeliveryDailyDate(stop.delivery.storeDailyDate),
            storeDailyNumber: stop.delivery.storeDailyNumber ?? null,
            customer: stop.delivery.customer.name,
            status: stop.delivery.status,
          }
        : null,
      earliestAt: stop.earliestAt?.toISOString() ?? null,
      completedAt: stop.completedAt?.toISOString() ?? null,
    })),
    createdAt: route.createdAt.toISOString(),
  };
}

/**
 * Mantem o filtro de paradas no formato cru retornado pelo Supabase REST.
 * Esse passo existe antes da serializacao para reaproveitar a mesma regra de escopo.
 */
function filterRestRouteStopsForSession(
  route: Record<string, unknown>,
  session: { role: string },
  userStoreScope: string[] | null,
) {
  const stops = Array.isArray(route.RouteStop) ? route.RouteStop : [];

  return {
    ...route,
    RouteStop: visibleRouteStopsForSession(stops as RouteStopWithOptionalStoreScope[], session, userStoreScope),
    source: "supabase-rest",
  };
}

/**
 * Converte CourierRoute/RouteStop do Supabase REST para o mesmo shape do Prisma.
 * Isso evita clientes tratando dois contratos diferentes quando o fallback REST entra.
 */
export function serializeRestRoute(
  route: Record<string, unknown>,
  session: { role: string } = { role: "ADMIN" },
  userStoreScope: string[] | null = null,
) {
  const filteredRoute = filterRestRouteStopsForSession(route, session, userStoreScope) as Record<string, unknown> & {
    RouteStop?: unknown;
  };
  const stops = (Array.isArray(filteredRoute.RouteStop) ? filteredRoute.RouteStop : []) as Array<Record<string, unknown>>;
  const courier = objectRecord(filteredRoute.Courier);
  const user = objectRecord(courier.User);

  return {
    id: stringValue(filteredRoute.id),
    status: stringValue(filteredRoute.status),
    courier: {
      id: stringValue(courier.id),
      name: stringValue(user.name, "Motoboy"),
      baseStoreName: stringValue(courier.baseStoreName, "Base"),
    },
    startedAt: nullableStringValue(filteredRoute.startedAt),
    finishedAt: nullableStringValue(filteredRoute.finishedAt),
    recalculatedAt: nullableStringValue(filteredRoute.recalculatedAt),
    stops: stops
      .map((stop) => {
        const delivery = objectRecord(stop.Delivery);
        const customer = objectRecord(delivery.Customer);
        return {
          id: stringValue(stop.id),
          sequence: numberValue(stop.sequence),
          type: stringValue(stop.type),
          status: stringValue(stop.status),
          address: stringValue(stop.address),
          latitude: nullableNumberValue(stop.latitude),
          longitude: nullableNumberValue(stop.longitude),
          delivery: delivery.id
            ? {
                id: stringValue(delivery.id),
                publicCode: stringValue(delivery.publicCode),
                storeDailyDate: nullableStringValue(delivery.storeDailyDate),
                storeDailyNumber: nullableNumberValue(delivery.storeDailyNumber),
                customer: stringValue(customer.name, "Cliente"),
                status: stringValue(delivery.status),
              }
            : null,
          earliestAt: nullableStringValue(stop.earliestAt),
          completedAt: nullableStringValue(stop.completedAt),
        };
      })
      .sort((a, b) => a.sequence - b.sequence),
    createdAt: stringValue(filteredRoute.createdAt),
    source: "supabase-rest",
  };
}

/**
 * Garante leitura segura de objetos vindos do REST sem confiar no formato bruto.
 */
function objectRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

/** Le string opcional do REST retornando null quando o valor nao veio no formato esperado. */
function nullableStringValue(value: unknown) {
  return typeof value === "string" ? value : null;
}

/** Normaliza a data diaria da entrega da rota sem vazar objeto Date para os apps. */
function normalizeRouteDeliveryDailyDate(value: Date | string | null | undefined) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return typeof value === "string" ? value.slice(0, 10) : null;
}

/** Converte valor numerico vindo do REST com fallback zero para ordenacao segura. */
function numberValue(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

/** Converte coordenada opcional do REST sem transformar vazio em zero falso. */
function nullableNumberValue(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

/** Escolhe o ponto inicial da rota, priorizando localizacao do motoboy e depois a loja. */
function chooseStartPoint({ courier, store }: { courier: RoutePoint | null; store: RoutePoint | null }) {
  return courier ?? store ?? { lat: -23.966, lng: -46.237, label: "Guaruja" };
}

/** Usa a loja da primeira entrega com coordenada como fallback de inicio da rota. */
function firstDeliveryStorePoint(stops: RouteStopWithStore[]): RoutePoint | null {
  const stop = stops.find((item) => item.delivery?.store?.latitude && item.delivery.store.longitude);
  if (!stop?.delivery?.store?.latitude || !stop.delivery.store.longitude) return null;

  return {
    lat: Number(stop.delivery.store.latitude),
    lng: Number(stop.delivery.store.longitude),
    label: stop.delivery.store.name,
  };
}

/** Reordena paradas pendentes por vizinho mais proximo a partir do ponto atual. */
function orderRouteStops<T extends RouteStopForOrdering>(start: RoutePoint, stops: T[]) {
  const pending = [...stops];
  const ordered: T[] = [];
  let current = start;

  while (pending.length > 0) {
    const nextIndex = pending.reduce(
      (best, stop, index) => {
        const distance = distanceBetween(current, {
          lat: Number(stop.latitude),
          lng: Number(stop.longitude),
        });
        return distance < best.distance ? { index, distance } : best;
      },
      { index: 0, distance: Number.POSITIVE_INFINITY },
    ).index;
    const next = pending.splice(nextIndex, 1)[0];
    ordered.push(next);
    current = {
      lat: Number(next.latitude),
      lng: Number(next.longitude),
      label: `Parada ${next.sequence}`,
    };
  }

  return ordered;
}

/** Gera uma pre-visualizacao otimizada simples para o motoboy antes da rota persistida. */
function buildPreview(start: RoutePoint, deliveries: RouteDelivery[]) {
  const pending = [...deliveries];
  const stops: Array<RouteDelivery & { sequence: number; distanceFromPreviousKm: number }> = [];
  let current = start;
  let totalDistanceKm = 0;

  while (pending.length > 0) {
    const nextIndex = findNearestIndex(current, pending);
    const next = pending.splice(nextIndex, 1)[0];
    const distanceFromPreviousKm = distanceBetween(current, next.coordinates);
    totalDistanceKm += distanceFromPreviousKm;
    stops.push({
      ...next,
      sequence: stops.length + 1,
      distanceFromPreviousKm: Number(distanceFromPreviousKm.toFixed(2)),
    });
    current = {
      ...next.coordinates,
      label: next.address,
    };
  }

  return {
    start,
    stopCount: stops.length,
    totalDistanceKm: Number(totalDistanceKm.toFixed(2)),
    stops,
  };
}

/** Encontra a proxima entrega mais perto do ponto atual. */
function findNearestIndex(current: RoutePoint, deliveries: RouteDelivery[]) {
  return deliveries.reduce(
    (best, delivery, index) => {
      const distance = distanceBetween(current, delivery.coordinates);
      return distance < best.distance ? { index, distance } : best;
    },
    { index: 0, distance: Number.POSITIVE_INFINITY },
  ).index;
}

/** Calcula distancia aproximada em km entre duas coordenadas. */
function distanceBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
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

/** Converte graus para radianos no calculo de distancia geografica. */
function toRadians(value: number) {
  return (value * Math.PI) / 180;
}
