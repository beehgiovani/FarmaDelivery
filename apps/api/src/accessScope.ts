import { prisma } from "./prisma";
import type { Prisma } from "@prisma/client";
import type { COURIER_SERVICE_AREAS } from "./contracts";
import { canUseSupabaseRest, supabaseRest } from "./supabaseRest";

export type StoreScopedSession = {
  sub: string;
  role: string;
  storeId?: string | null;
  courierId?: string | null;
};

export type DeliveryScopedSession = {
  role: string;
  storeId?: string | null;
  courierId?: string | null;
};

export type CourierServiceArea = (typeof COURIER_SERVICE_AREAS)[number];

/** Identifica o login operacional da loja. Admin permanece como visao geral. */
export function isStoreLoginRole(role: string) {
  return role === "GERENTE";
}

/** Resolve as lojas ativas do login de loja, incluindo emprestimos temporarios alem da loja base. */
export async function resolveUserStoreScope(session: StoreScopedSession) {
  if (!isStoreLoginRole(session.role)) {
    return null;
  }

  const storeIds = new Set<string>();
  if (session.storeId) storeIds.add(session.storeId);

  const now = new Date();
  try {
    const assignments = await prisma.userStoreAssignment.findMany({
      where: {
        userId: session.sub,
        active: true,
        startsAt: {
          lte: now,
        },
        OR: [{ endsAt: null }, { endsAt: { gte: now } }],
      },
      select: {
        storeId: true,
      },
    });
    assignments.forEach((assignment) => storeIds.add(assignment.storeId));
  } catch {
    if (canUseSupabaseRest()) {
      const assignments = await supabaseRest<Array<{ storeId: string }>>("UserStoreAssignment", {
        query: `select=storeId&userId=eq.${session.sub}&active=eq.true&startsAt=lte.${now.toISOString()}&or=(endsAt.is.null,endsAt.gte.${now.toISOString()})`,
      });
      assignments.forEach((assignment) => storeIds.add(assignment.storeId));
    }
  }

  return [...storeIds];
}

/** Resolve as lojas que o motoboy pode atender agora, respeitando cobertura, rodizio e dedicacao ativa. */
export async function resolveCourierStoreScope(session: StoreScopedSession) {
  if (session.role !== "MOTOBOY" || !session.courierId) {
    return null;
  }

  const storeIds = new Set<string>();
  const now = new Date();
  try {
    const assignments = await prisma.courierStoreAssignment.findMany({
      where: {
        courierId: session.courierId,
        active: true,
        startsAt: {
          lte: now,
        },
        OR: [{ endsAt: null }, { endsAt: { gte: now } }],
      },
      select: {
        storeId: true,
      },
    });
    assignments.forEach((assignment) => storeIds.add(assignment.storeId));
  } catch {
    if (canUseSupabaseRest()) {
      const assignments = await supabaseRest<Array<{ storeId: string }>>("CourierStoreAssignment", {
        query: `select=storeId&courierId=eq.${session.courierId}&active=eq.true&startsAt=lte.${now.toISOString()}&or=(endsAt.is.null,endsAt.gte.${now.toISOString()})`,
      });
      assignments.forEach((assignment) => storeIds.add(assignment.storeId));
    }
  }

  return [...storeIds];
}

/** Resolve a praca escolhida pelo motoboy no app, sem depender de alocacao administrativa. */
export async function resolveCourierServiceAreaStoreScope(serviceArea?: CourierServiceArea | null) {
  if (!serviceArea) return null;

  try {
    const stores = await prisma.store.findMany({
      select: {
        id: true,
        name: true,
      },
    });
    return stores.filter((store) => storeMatchesCourierServiceArea(store.name, serviceArea)).map((store) => store.id);
  } catch {
    if (canUseSupabaseRest()) {
      const stores = await supabaseRest<Array<{ id: string; name: string }>>("Store", {
        query: "select=id,name",
      });
      return stores.filter((store) => storeMatchesCourierServiceArea(store.name, serviceArea)).map((store) => store.id);
    }
  }

  return [];
}

export function storeMatchesCourierServiceArea(storeName: string, serviceArea: CourierServiceArea) {
  const normalized = normalizeStoreName(storeName);
  const isDedicatedStore = normalized.includes("pereque");
  return serviceArea === "PEREQUE" ? isDedicatedStore : !isDedicatedStore;
}

function normalizeStoreName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Confere acesso quando null significa perfil sem restricao de loja. */
export function hasStoreAccess(storeIds: string[] | null, storeId: string) {
  return storeIds === null || storeIds.includes(storeId);
}

/** Monta filtro REST de lojas com sentinela segura quando o usuario nao tem loja ativa. */
export function storeIdRestFilter(storeIds: string[]) {
  if (storeIds.length === 0) return "&id=eq.__no_store_scope__";
  if (storeIds.length === 1) return `&id=eq.${storeIds[0]}`;
  return `&id=in.(${storeIds.join(",")})`;
}

/** Monta filtro REST de entregas por loja com sentinela segura para escopo vazio. */
export function deliveryStoreRestFilter(storeIds: string[]) {
  if (storeIds.length === 0) return "&storeId=eq.__no_store_scope__";
  if (storeIds.length === 1) return `&storeId=eq.${storeIds[0]}`;
  return `&storeId=in.(${storeIds.join(",")})`;
}

/** Permite ao motoboy ver suas entregas e, se disponivel, novas entregas das lojas em cobertura. */
export function motoboyDeliveryRestFilter(courierId: string, storeIds: string[]) {
  if (storeIds.length === 0) return `&courierId=eq.${courierId}`;
  const assignedStores = storeIds.length === 1 ? `storeId.eq.${storeIds[0]}` : `storeId.in.(${storeIds.join(",")})`;
  return `&or=(courierId.eq.${courierId},and(status.eq.AGUARDANDO_MOTOBOY,${assignedStores}))`;
}

/** Monta o where Prisma de entregas conforme papel, loja ativa e disponibilidade do motoboy. */
export function deliveryScopeWhere(
  session: DeliveryScopedSession,
  storeScope: string[] | null,
  courierStoreScope: string[] | null,
  courierAvailable: boolean,
): Prisma.DeliveryWhereInput | undefined {
  if (isStoreLoginRole(session.role)) {
    return { storeId: { in: storeScope ?? [] } };
  }

  if (session.role === "MOTOBOY" && session.courierId) {
    if (!courierAvailable) {
      return {
        courierId: session.courierId,
      };
    }

    return {
      OR: [
        { courierId: session.courierId },
        {
          status: "AGUARDANDO_MOTOBOY",
          storeId: { in: courierStoreScope ?? [] },
        },
      ],
    };
  }

  return undefined;
}

/** Mantem o mesmo escopo de entrega do Prisma quando a API precisa usar Supabase REST. */
export function deliveryScopeRestFilter(
  session: DeliveryScopedSession,
  storeScope: string[] | null,
  courierStoreScope: string[] | null,
  courierAvailable: boolean,
) {
  if (isStoreLoginRole(session.role)) {
    return deliveryStoreRestFilter(storeScope ?? []);
  }

  if (session.role === "MOTOBOY" && session.courierId) {
    if (!courierAvailable) return `&courierId=eq.${session.courierId}`;
    return motoboyDeliveryRestFilter(session.courierId, courierStoreScope ?? []);
  }

  return "";
}
