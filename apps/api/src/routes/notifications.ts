import type { FastifyInstance } from "fastify";
import { requireAuth } from "../auth";
import { isCourierPushConfigured } from "../notifications";
import { prisma } from "../prisma";
import { canUseSupabaseRest, supabaseRest } from "../supabaseRest";

type NotificationEventMetadata = {
  notificationType?: string;
  sent?: unknown;
  failed?: unknown;
  inactiveTokens?: unknown;
  targetCouriers?: unknown;
  couriersWithoutTokens?: unknown;
};

type NotificationEventRow = {
  id: string;
  deliveryId: string;
  metadata: unknown;
  createdAt: Date | string;
  delivery?: {
    publicCode?: string;
    store?: {
      name?: string;
    } | null;
  } | null;
  Delivery?: {
    publicCode?: string;
    Store?: {
      name?: string;
    } | null;
  } | null;
};

type TokenPlatformCountRow = {
  platform?: string | null;
  active: boolean;
  count: number;
};

type TokenDeviceRow = {
  id: string;
  courierId: string;
  platform?: string | null;
  active: boolean;
  lastSeenAt?: Date | string | null;
  updatedAt?: Date | string | null;
  courier?: {
    id?: string;
    baseStoreName?: string | null;
    user?: {
      name?: string | null;
    } | null;
  } | null;
  Courier?: {
    id?: string;
    baseStoreName?: string | null;
    User?: {
      name?: string | null;
    } | null;
  } | null;
};

/** Registra o resumo administrativo de push sem expor tokens dos aparelhos. */
export async function notificationRoutes(app: FastifyInstance) {
  app.get("/notifications/summary", async (request, reply) => {
    const session = await requireAuth(request, reply, ["ADMIN"]);
    if (!session) return;

    const query = request.query as { limit?: string };
    const limit = parseNotificationEventLimit(query.limit);

    try {
      const [activeTokens, inactiveTokens, tokenPlatformRows, tokenDeviceRows, recentEvents] = await Promise.all([
        prisma.courierDeviceToken.count({ where: { active: true } }),
        prisma.courierDeviceToken.count({ where: { active: false } }),
        prisma.courierDeviceToken.groupBy({
          by: ["platform", "active"],
          _count: {
            _all: true,
          },
        }),
        prisma.courierDeviceToken.findMany({
          orderBy: { lastSeenAt: "desc" },
          take: 200,
          select: {
            id: true,
            courierId: true,
            platform: true,
            active: true,
            lastSeenAt: true,
            updatedAt: true,
            courier: {
              select: {
                id: true,
                baseStoreName: true,
                user: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        }),
        prisma.deliveryEvent.findMany({
          where: { type: "NOTIFICACAO_ENVIADA" },
          orderBy: { createdAt: "desc" },
          take: limit,
          include: {
            delivery: {
              select: {
                publicCode: true,
                store: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        }),
      ]);

      return buildNotificationSummary(
        activeTokens,
        inactiveTokens,
        recentEvents,
        "prisma",
        tokenPlatformRows.map((row) => ({
          platform: row.platform,
          active: row.active,
          count: row._count._all,
        })),
        tokenDeviceRows,
      );
    } catch (error) {
      app.log.error({ error }, "notification summary error");
      if (canUseSupabaseRest()) {
        try {
          const [activeTokens, inactiveTokens, tokenRows, tokenDeviceRows, recentEvents] = await Promise.all([
            supabaseRest<Array<{ id: string }>>("CourierDeviceToken", {
              query: "select=id&active=eq.true",
            }),
            supabaseRest<Array<{ id: string }>>("CourierDeviceToken", {
              query: "select=id&active=eq.false",
            }),
            supabaseRest<Array<{ platform: string | null; active: boolean }>>("CourierDeviceToken", {
              query: "select=platform,active",
            }),
            supabaseRest<TokenDeviceRow[]>("CourierDeviceToken", {
              query:
                "select=id,courierId,platform,active,lastSeenAt,updatedAt,Courier(id,baseStoreName,User(name))&order=lastSeenAt.desc&limit=200",
            }),
            supabaseRest<NotificationEventRow[]>("DeliveryEvent", {
              query:
                `select=id,deliveryId,metadata,createdAt,Delivery(publicCode,Store(name))&type=eq.NOTIFICACAO_ENVIADA&order=createdAt.desc&limit=${limit}`,
            }),
          ]);

          return buildNotificationSummary(
            activeTokens.length,
            inactiveTokens.length,
            recentEvents,
            "supabase-rest",
            countTokenPlatforms(tokenRows),
            tokenDeviceRows,
          );
        } catch (restError) {
          app.log.error({ error: restError }, "notification summary supabase rest error");
        }
      }

      return reply.status(503).send({
        error: "DATABASE_UNAVAILABLE",
        message: "Nao foi possivel carregar o resumo de notificacoes.",
      });
    }
  });
}

/** Consolida configuracao, tokens e eventos recentes para o monitor de notificacoes. */
export function buildNotificationSummary(
  activeTokens: number,
  inactiveTokens: number,
  recentEvents: NotificationEventRow[],
  source = "prisma",
  tokenPlatformRows: TokenPlatformCountRow[] = [],
  tokenDeviceRows: TokenDeviceRow[] = [],
) {
  const totals = recentEvents.reduce(
    (acc, event) => {
      const metadata = readNotificationMetadata(event.metadata);
      acc.sent += notificationMetric(metadata.sent);
      acc.failed += notificationMetric(metadata.failed);
      acc.inactiveTokens += notificationMetric(metadata.inactiveTokens);
      acc.targetCouriers += notificationMetric(metadata.targetCouriers);
      acc.couriersWithoutTokens += notificationMetric(metadata.couriersWithoutTokens);
      return acc;
    },
    {
      sent: 0,
      failed: 0,
      inactiveTokens: 0,
      targetCouriers: 0,
      couriersWithoutTokens: 0,
    },
  );

  return {
    configured: isCourierPushConfigured(),
    scheduledWorkerEnabled: process.env.SCHEDULED_DELIVERY_NOTIFICATION_WORKER !== "false",
    scheduledIntervalMs: Math.max(Number(process.env.SCHEDULED_DELIVERY_NOTIFICATION_INTERVAL_MS ?? 60_000), 15_000),
    activeTokens,
    inactiveTokens,
    tokenPlatforms: buildTokenPlatformSummary(tokenPlatformRows),
    tokenDevices: buildTokenDeviceSummary(tokenDeviceRows),
    recentTotals: totals,
    recentEvents: recentEvents.map((event) => {
      const metadata = readNotificationMetadata(event.metadata);
      return {
        id: event.id,
        deliveryId: event.deliveryId,
        publicCode: event.delivery?.publicCode ?? event.Delivery?.publicCode ?? "",
        store: event.delivery?.store?.name ?? event.Delivery?.Store?.name ?? "",
        notificationType: metadata.notificationType ?? "NOTIFICACAO_ENVIADA",
        sent: notificationMetric(metadata.sent),
        failed: notificationMetric(metadata.failed),
        inactiveTokens: notificationMetric(metadata.inactiveTokens),
        targetCouriers: notificationMetric(metadata.targetCouriers),
        couriersWithoutTokens: notificationMetric(metadata.couriersWithoutTokens),
        createdAt: event.createdAt instanceof Date ? event.createdAt.toISOString() : event.createdAt,
      };
    }),
    source,
  };
}

/** Agrupa tokens por plataforma e estado sem retornar o valor do token. */
export function buildTokenPlatformSummary(rows: TokenPlatformCountRow[]) {
  const platforms = new Map<string, { platform: string; active: number; inactive: number; total: number }>();

  rows.forEach((row) => {
    const platform = row.platform?.trim() || "desconhecida";
    const current = platforms.get(platform) ?? {
      platform,
      active: 0,
      inactive: 0,
      total: 0,
    };
    if (row.active) {
      current.active += row.count;
    } else {
      current.inactive += row.count;
    }
    current.total += row.count;
    platforms.set(platform, current);
  });

  return [...platforms.values()].sort((left, right) => right.total - left.total || left.platform.localeCompare(right.platform));
}

/** Monta a lista de dispositivos por motoboy sem vazar o token FCM/Web Push. */
export function buildTokenDeviceSummary(rows: TokenDeviceRow[]) {
  return rows.map((row) => ({
    id: row.id,
    courierId: row.courierId,
    courierName: row.courier?.user?.name ?? row.Courier?.User?.name ?? "Motoboy nao informado",
    baseStoreName: row.courier?.baseStoreName ?? row.Courier?.baseStoreName ?? "",
    platform: row.platform?.trim() || "desconhecida",
    active: row.active,
    lastSeenAt: dateToIso(row.lastSeenAt),
    updatedAt: dateToIso(row.updatedAt),
  }));
}

/** Simula o groupBy de plataforma quando estamos no fallback Supabase REST. */
function countTokenPlatforms(rows: Array<{ platform: string | null; active: boolean }>): TokenPlatformCountRow[] {
  const counts = new Map<string, TokenPlatformCountRow>();
  rows.forEach((row) => {
    const key = `${row.platform ?? ""}:${row.active}`;
    const current = counts.get(key) ?? {
      platform: row.platform,
      active: row.active,
      count: 0,
    };
    current.count += 1;
    counts.set(key, current);
  });
  return [...counts.values()];
}

/** Normaliza Date ou string para ISO mantendo null quando nao ha contato registrado. */
function dateToIso(value: Date | string | null | undefined) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
}

/** Limita quantos eventos recentes o painel pode pedir para evitar payload grande demais. */
export function parseNotificationEventLimit(value: string | undefined) {
  const parsed = Number(value ?? 10);
  if (!Number.isFinite(parsed)) return 10;
  return Math.min(Math.max(Math.trunc(parsed), 1), 100);
}

/** Le metadata auditavel de notificacao com fallback seguro para objeto invalido. */
function readNotificationMetadata(value: unknown): NotificationEventMetadata {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as NotificationEventMetadata;
}

function notificationMetric(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}
