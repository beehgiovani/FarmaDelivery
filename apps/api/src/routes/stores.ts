import type { FastifyInstance } from "fastify";
import { createStoreDateOverrideSchema, createStoreSchema, updateStoreWeeklyHoursSchema } from "../contracts";
import { validationError } from "../http";
import { prisma } from "../prisma";
import { requireAuth } from "../auth";
import { isStoreLoginRole, resolveUserStoreScope, storeIdRestFilter } from "../accessScope";
import {
  canUseSupabaseRest,
  supabaseRest,
  type SupabaseStore,
  type SupabaseStoreDateOverride,
  type SupabaseStoreWeeklyHours,
} from "../supabaseRest";

/** Registra as rotas de lojas, horarios semanais e excecoes por data especifica. */
export async function storeRoutes(app: FastifyInstance) {
  app.get("/stores", async (request, reply) => {
    const session = await requireAuth(request, reply, ["ADMIN", "GERENTE", "MOTOBOY"]);
    if (!session) return;
    const storeScope = await resolveUserStoreScope(session);

    try {
      const stores = await prisma.store.findMany({
        where: storeScopeWhere(session, storeScope),
        orderBy: { code: "asc" },
        include: {
          weeklyHours: {
            orderBy: { dayOfWeek: "asc" },
          },
          _count: {
            select: {
              deliveries: true,
              users: true,
            },
          },
        },
      });

      return stores.map((store) => ({
        id: store.id,
        code: store.code,
        name: store.name,
        address: store.address,
        latitude: store.latitude ? Number(store.latitude) : null,
        longitude: store.longitude ? Number(store.longitude) : null,
        baseType: store.baseType,
        active: store.active,
        deliveryCount: store._count.deliveries,
        userCount: store._count.users,
        weeklyHours: store.weeklyHours.map((hours) => ({
          dayOfWeek: hours.dayOfWeek,
          opensAt: hours.opensAt,
          closesAt: hours.closesAt,
          closed: hours.closed,
        })),
        createdAt: store.createdAt.toISOString(),
        updatedAt: store.updatedAt.toISOString(),
      }));
    } catch (error) {
      requestLog(app, error);
      if (canUseSupabaseRest()) {
        const stores = await supabaseRest<SupabaseStore[]>("Store", {
          query: `select=*,StoreWeeklyHours(*)&order=code.asc${storeScopeRestFilter(session, storeScope)}`,
        });

        return stores.map((store) => ({
          id: store.id,
          code: store.code,
          name: store.name,
          address: store.address,
          latitude: store.latitude,
          longitude: store.longitude,
          baseType: store.baseType,
          active: store.active,
          deliveryCount: 0,
          userCount: 0,
          weeklyHours: (store.StoreWeeklyHours ?? [])
            .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
            .map((hours) => ({
              dayOfWeek: hours.dayOfWeek,
              opensAt: hours.opensAt,
              closesAt: hours.closesAt,
              closed: hours.closed,
            })),
          createdAt: store.createdAt,
          updatedAt: store.updatedAt,
          source: "supabase-rest",
        }));
      }

      return reply.status(503).send({
        error: "DATABASE_UNAVAILABLE",
        message: "Nao foi possivel conectar ao Postgres. Confira DATABASE_URL, preferencialmente usando o Supabase pooler.",
      });
    }
  });

  app.post("/stores", async (request, reply) => {
    const session = await requireAuth(request, reply, ["ADMIN"]);
    if (!session) return;

    const parsed = createStoreSchema.safeParse(request.body);
    if (!parsed.success) return validationError(reply, parsed.error);

    try {
      const store = await prisma.store.create({
        data: {
          code: parsed.data.code,
          name: parsed.data.name,
          address: parsed.data.address,
          baseType: parsed.data.baseType,
          latitude: parsed.data.coordinates?.latitude,
          longitude: parsed.data.coordinates?.longitude,
          weeklyHours: parsed.data.weeklyHours
            ? {
                create: parsed.data.weeklyHours,
              }
            : undefined,
        },
        include: {
          weeklyHours: {
            orderBy: { dayOfWeek: "asc" },
          },
        },
      });

      return reply.status(201).send(formatStore(store));
    } catch (error) {
      requestLog(app, error);
      if (canUseSupabaseRest()) {
        try {
          const result = await createStoreWithSupabaseRest(parsed.data);
          return reply.status(201).send(result);
        } catch (restError) {
          requestLog(app, restError);
        }
      }

      return reply.status(503).send({
        error: "DATABASE_UNAVAILABLE",
        message: "Nao foi possivel criar a loja.",
      });
    }
  });

  app.put("/stores/:storeId/weekly-hours", async (request, reply) => {
    const session = await requireAuth(request, reply, ["ADMIN"]);
    if (!session) return;

    const params = request.params as { storeId: string };
    const parsed = updateStoreWeeklyHoursSchema.safeParse(request.body);
    if (!parsed.success) return validationError(reply, parsed.error);

    try {
      await prisma.$transaction(
        parsed.data.weeklyHours.map((hours) =>
          prisma.storeWeeklyHours.upsert({
            where: {
              storeId_dayOfWeek: {
                storeId: params.storeId,
                dayOfWeek: hours.dayOfWeek,
              },
            },
            update: {
              opensAt: hours.opensAt,
              closesAt: hours.closesAt,
              closed: hours.closed,
            },
            create: {
              storeId: params.storeId,
              dayOfWeek: hours.dayOfWeek,
              opensAt: hours.opensAt,
              closesAt: hours.closesAt,
              closed: hours.closed,
            },
          }),
        ),
      );

      return reply.send({ ok: true });
    } catch (error) {
      requestLog(app, error);
      if (canUseSupabaseRest()) {
        try {
          await upsertWeeklyHoursWithSupabaseRest(params.storeId, parsed.data.weeklyHours);
          return reply.send({ ok: true, source: "supabase-rest" });
        } catch (restError) {
          requestLog(app, restError);
        }
      }

      return reply.status(503).send({
        error: "DATABASE_UNAVAILABLE",
        message: "Nao foi possivel atualizar horario semanal.",
      });
    }
  });

  app.post("/stores/:storeId/date-overrides", async (request, reply) => {
    const session = await requireAuth(request, reply, ["ADMIN"]);
    if (!session) return;

    const params = request.params as { storeId: string };
    const parsed = createStoreDateOverrideSchema.safeParse(request.body);
    if (!parsed.success) return validationError(reply, parsed.error);

    try {
      const override = await prisma.storeDateOverride.upsert({
        where: {
          storeId_date: {
            storeId: params.storeId,
            date: new Date(parsed.data.date),
          },
        },
        update: {
          opensAt: parsed.data.opensAt,
          closesAt: parsed.data.closesAt,
          closed: parsed.data.closed,
          reason: parsed.data.reason,
        },
        create: {
          storeId: params.storeId,
          date: new Date(parsed.data.date),
          opensAt: parsed.data.opensAt,
          closesAt: parsed.data.closesAt,
          closed: parsed.data.closed,
          reason: parsed.data.reason,
        },
      });

      return reply.status(201).send({
        id: override.id,
        storeId: override.storeId,
        date: override.date.toISOString().slice(0, 10),
        opensAt: override.opensAt,
        closesAt: override.closesAt,
        closed: override.closed,
        reason: override.reason,
      });
    } catch (error) {
      requestLog(app, error);
      if (canUseSupabaseRest()) {
        try {
          const result = await upsertDateOverrideWithSupabaseRest(params.storeId, parsed.data);
          return reply.status(201).send(result);
        } catch (restError) {
          requestLog(app, restError);
        }
      }

      return reply.status(503).send({
        error: "DATABASE_UNAVAILABLE",
        message: "Nao foi possivel salvar horario especial.",
      });
    }
  });
}

/** Limita a consulta Prisma de lojas conforme o perfil logado. */
export function storeScopeWhere(session: { role: string; storeId?: string | null }, storeScope: string[] | null) {
  if (isStoreLoginRole(session.role)) {
    return { id: { in: storeScope ?? [] } };
  }
  if (session.role === "MOTOBOY" && session.storeId) {
    return { id: session.storeId };
  }
  return undefined;
}

/** Mantem no Supabase REST o mesmo escopo de loja usado pelo Prisma. */
export function storeScopeRestFilter(session: { role: string; storeId?: string | null }, storeScope: string[] | null) {
  if (isStoreLoginRole(session.role)) {
    return storeIdRestFilter(storeScope ?? []);
  }
  if (session.role === "MOTOBOY" && session.storeId) {
    return `&id=eq.${session.storeId}`;
  }
  return "";
}

/** Padroniza log de erro das rotas de loja sem repetir mensagem em cada catch. */
function requestLog(app: FastifyInstance, error: unknown) {
  app.log.error({ error }, "stores route database error");
}

/** Normaliza a loja para o contrato usado pelo painel admin/loja. */
function formatStore(store: {
  id: string;
  code: string;
  name: string;
  address: string;
  latitude: unknown;
  longitude: unknown;
  baseType: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  weeklyHours?: Array<{
    dayOfWeek: number;
    opensAt: string;
    closesAt: string;
    closed: boolean;
  }>;
}) {
  return {
    id: store.id,
    code: store.code,
    name: store.name,
    address: store.address,
    latitude: store.latitude ? Number(store.latitude) : null,
    longitude: store.longitude ? Number(store.longitude) : null,
    baseType: store.baseType,
    active: store.active,
    weeklyHours: store.weeklyHours ?? [],
    createdAt: store.createdAt.toISOString(),
    updatedAt: store.updatedAt.toISOString(),
  };
}

/** Cria loja pelo fallback REST e, se vier horario semanal, grava os horarios em seguida. */
async function createStoreWithSupabaseRest(data: typeof createStoreSchema._output) {
  const stores = await supabaseRest<SupabaseStore[]>("Store", {
    method: "POST",
    prefer: "return=representation",
    body: {
      code: data.code,
      name: data.name,
      address: data.address,
      baseType: data.baseType,
      latitude: data.coordinates?.latitude,
      longitude: data.coordinates?.longitude,
    },
  });
  const store = stores[0];
  if (!store) throw new Error("Store was not returned by Supabase REST.");

  if (data.weeklyHours?.length) {
    await upsertWeeklyHoursWithSupabaseRest(store.id, data.weeklyHours);
  }

  return {
    ...store,
    weeklyHours: data.weeklyHours ?? [],
    source: "supabase-rest",
  };
}

/** Regrava o horario semanal completo para evitar sobras de dias antigos no fallback REST. */
async function upsertWeeklyHoursWithSupabaseRest(
  storeId: string,
  weeklyHours: typeof updateStoreWeeklyHoursSchema._output.weeklyHours,
) {
  await supabaseRest("StoreWeeklyHours", {
    method: "DELETE",
    query: `storeId=eq.${storeId}`,
  });

  if (weeklyHours.length === 0) return;

  await supabaseRest<SupabaseStoreWeeklyHours[]>("StoreWeeklyHours", {
    method: "POST",
    prefer: "return=representation",
    body: weeklyHours.map((hours) => ({
      storeId,
      dayOfWeek: hours.dayOfWeek,
      opensAt: hours.opensAt,
      closesAt: hours.closesAt,
      closed: hours.closed,
    })),
  });
}

/** Salva ou atualiza horario especial de uma data no fallback REST. */
async function upsertDateOverrideWithSupabaseRest(
  storeId: string,
  data: typeof createStoreDateOverrideSchema._output,
) {
  const overrides = await supabaseRest<SupabaseStoreDateOverride[]>("StoreDateOverride", {
    method: "POST",
    query: "on_conflict=storeId,date",
    prefer: "resolution=merge-duplicates,return=representation",
    body: {
      storeId,
      date: data.date,
      opensAt: data.opensAt,
      closesAt: data.closesAt,
      closed: data.closed,
      reason: data.reason,
    },
  });
  return overrides[0];
}
