import { createHash, randomUUID } from "node:crypto";
import { constants, createReadStream } from "node:fs";
import { access, mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { FastifyBaseLogger, FastifyInstance, FastifyReply } from "fastify";
import type { Prisma } from "@prisma/client";
import {
  acceptDeliverySchema,
  cancelDeliverySchema,
  createCustomerAddressSchema,
  createCustomerSchema,
  DELIVERY_PROOF_MAX_BYTES,
  DELIVERY_PROOF_UPLOAD_BODY_LIMIT_BYTES,
  createDeliverySchema,
  createDeliveryWithCustomerSchema,
  deliveryReportQuerySchema,
  deliveryStatusTransitionSchema,
  registerDeliveryProblemSchema,
  uploadDeliveryProofSchema,
} from "../contracts";
import { validationError } from "../http";
import { prisma } from "../prisma";
import { buildDeliveryPublicCode, resolveDeliverySequenceDate } from "../deliveryPublicCode";
import { formatDeliveryMutationResponse } from "../deliveryMutationResponse";
import { resolveDeliveryProofStorageRoot } from "../deliveryProofStorage";
import { buildDeliveryReport, buildDeliveryReportCsv } from "../deliveryReport";
import { requireAuth } from "../auth";
import {
  deliveryStoreRestFilter,
  deliveryScopeRestFilter,
  deliveryScopeWhere,
  hasStoreAccess,
  isStoreLoginRole,
  resolveCourierStoreScope,
  resolveUserStoreScope,
} from "../accessScope";
import {
  canUseSupabaseRest,
  supabaseRest,
  type SupabaseCustomer,
  type SupabaseCustomerAddress,
  type SupabaseDelivery,
  type SupabaseDeliveryEvent,
  type SupabaseStore,
} from "../supabaseRest";
import { isCourierPushConfigured, sendCourierPushNotification } from "../notifications";
import { deliveryCreationNotes } from "../deliveryCreationAudit";

/** Registra rotas de entregas, clientes, relatorios, comprovantes, transicoes e notificacoes. */
export async function deliveryRoutes(app: FastifyInstance) {
  const stopScheduledNotifications = startScheduledDeliveryNotificationScheduler(app.log);
  app.addHook("onClose", async () => {
    stopScheduledNotifications();
  });

  app.get("/deliveries", async (request, reply) => {
    const session = await requireAuth(request, reply, ["ADMIN", "GERENTE", "MOTOBOY"]);
    if (!session) return;
    const storeScope = await resolveUserStoreScope(session);
    const courierStoreScope = await resolveCourierStoreScope(session);
    const courierAvailable = await resolveCourierAvailability(session);

    try {
      const deliveries = await prisma.delivery.findMany({
        where: deliveryScopeWhere(session, storeScope, courierStoreScope, courierAvailable),
        orderBy: { createdAt: "desc" },
        take: 100,
        include: {
          store: true,
          customer: true,
          customerAddress: true,
          courier: {
            include: {
              user: true,
            },
          },
          events: {
            where: { type: "CRIADA" },
            select: { metadata: true },
            take: 1,
          },
          _count: {
            select: {
              proofs: true,
            },
          },
        },
      });

        return deliveries.map((delivery) => ({
          id: delivery.id,
          publicCode: delivery.publicCode,
          storeDailyDate: delivery.storeDailyDate.toISOString().slice(0, 10),
          storeDailyNumber: delivery.storeDailyNumber,
          store: delivery.store.name,
        customer: delivery.customer.name,
        phone: delivery.customer.phone,
        address: formatAddress({
          street: delivery.customerAddress.street,
          number: delivery.customerAddress.number,
          complement: delivery.customerAddress.complement,
          neighborhood: delivery.customerAddress.neighborhood,
        }),
        status: delivery.status,
        courier: delivery.courier?.user.name ?? "Sem motoboy",
        attendantName: deliveryCreationAttendantName(delivery.events),
        createdAt: delivery.createdAt.toISOString(),
        acceptedAt: delivery.acceptedAt?.toISOString() ?? null,
        collectedAt: delivery.collectedAt?.toISOString() ?? null,
        deliveredAt: delivery.deliveredAt?.toISOString() ?? null,
        canceledAt: delivery.canceledAt?.toISOString() ?? null,
        earliestDispatchAt: delivery.earliestDispatchAt?.toISOString() ?? null,
        priority: delivery.priority,
        deadlineTier: delivery.deadlineTier,
        proofCount: delivery._count.proofs,
        coordinates:
          delivery.customerAddress.latitude && delivery.customerAddress.longitude
            ? {
                lat: Number(delivery.customerAddress.latitude),
                lng: Number(delivery.customerAddress.longitude),
              }
            : null,
      }));
    } catch (error) {
      app.log.error({ error }, "deliveries list error");
      if (canUseSupabaseRest()) {
        const deliveries = await supabaseRest<SupabaseDelivery[]>("Delivery", {
          query:
            `select=*,Store(id,name,latitude,longitude),Courier(id,User(name)),Customer(id,name,phone),CustomerAddress(id,street,number,complement,neighborhood,latitude,longitude),DeliveryProof(id),DeliveryEvent(type,metadata)&order=createdAt.desc&limit=100${deliveryScopeRestFilter(session, storeScope, courierStoreScope, courierAvailable)}`,
        });

        return deliveries.map((delivery) => ({
          id: delivery.id,
          publicCode: delivery.publicCode,
          storeDailyDate: delivery.storeDailyDate ?? null,
          storeDailyNumber: delivery.storeDailyNumber ?? null,
          store: delivery.Store?.name ?? "Loja",
          customer: delivery.Customer?.name ?? "Cliente",
          phone: delivery.Customer?.phone ?? "",
          address: formatAddress({
            street: delivery.CustomerAddress?.street ?? "",
            number: delivery.CustomerAddress?.number ?? "",
            complement: delivery.CustomerAddress?.complement ?? null,
            neighborhood: delivery.CustomerAddress?.neighborhood ?? null,
          }),
          status: delivery.status,
          courier: delivery.Courier?.User?.name ?? "Sem motoboy",
          attendantName: deliveryCreationAttendantName(delivery.DeliveryEvent),
          createdAt: delivery.createdAt,
          acceptedAt: delivery.acceptedAt ?? null,
          collectedAt: delivery.collectedAt ?? null,
          deliveredAt: delivery.deliveredAt ?? null,
          canceledAt: delivery.canceledAt ?? null,
          earliestDispatchAt: delivery.earliestDispatchAt,
          priority: delivery.priority,
          deadlineTier: delivery.deadlineTier ?? "MEDIO",
          proofCount: delivery.DeliveryProof?.length ?? 0,
          coordinates:
            delivery.CustomerAddress?.latitude && delivery.CustomerAddress?.longitude
              ? {
                  lat: delivery.CustomerAddress.latitude,
                  lng: delivery.CustomerAddress.longitude,
                }
              : null,
          source: "supabase-rest",
        }));
      }

      return reply.status(503).send({
        error: "DATABASE_UNAVAILABLE",
        message: "Nao foi possivel listar entregas.",
      });
    }
  });

  app.get("/reports/deliveries-summary", async (request, reply) => {
    const session = await requireAuth(request, reply, ["ADMIN", "GERENTE"]);
    if (!session) return;

    const parsed = deliveryReportQuerySchema.safeParse(request.query);
    if (!parsed.success) return validationError(reply, parsed.error);
    const storeScope = await resolveUserStoreScope(session);

    try {
      const deliveries = await prisma.delivery.findMany({
        where: deliveryReportWhere(session, storeScope, parsed.data.storeId, parsed.data),
        orderBy: { createdAt: "desc" },
        take: 1000,
        include: {
          store: true,
          customerAddress: true,
          courier: {
            include: {
              user: true,
            },
          },
          events: {
            where: { type: "CRIADA" },
            select: { metadata: true },
            take: 1,
          },
          _count: {
            select: {
              proofs: true,
            },
          },
        },
      });

      return buildDeliveryReport(
        deliveries.map((delivery) => ({
          id: delivery.id,
          store: delivery.store.name,
          status: delivery.status,
          courier: delivery.courier?.user.name ?? "Sem motoboy",
          attendantName: deliveryCreationAttendantName(delivery.events),
          priority: delivery.priority,
          createdAt: delivery.createdAt.toISOString(),
          acceptedAt: delivery.acceptedAt?.toISOString() ?? null,
          collectedAt: delivery.collectedAt?.toISOString() ?? null,
          deliveredAt: delivery.deliveredAt?.toISOString() ?? null,
          canceledAt: delivery.canceledAt?.toISOString() ?? null,
          proofCount: delivery._count.proofs,
          hasMapPoint: delivery.customerAddress.latitude !== null && delivery.customerAddress.longitude !== null,
        })),
        parsed.data,
        parsed.data,
      );
    } catch (error) {
      app.log.error({ error }, "delivery report summary error");
      if (canUseSupabaseRest()) {
        const deliveries = await supabaseRest<SupabaseDelivery[]>("Delivery", {
          query:
            `select=id,status,priority,createdAt,acceptedAt,collectedAt,deliveredAt,canceledAt,Store(id,name),Courier(id,User(name)),CustomerAddress(id,latitude,longitude),DeliveryProof(id),DeliveryEvent(type,metadata)&order=createdAt.desc&limit=1000${deliveryReportRestFilter(session, storeScope, parsed.data.storeId, parsed.data)}`,
        });

        return {
          ...buildDeliveryReport(
            deliveries.map((delivery) => ({
              id: delivery.id,
              store: delivery.Store?.name ?? "Loja",
              status: delivery.status,
              courier: delivery.Courier?.User?.name ?? "Sem motoboy",
              attendantName: deliveryCreationAttendantName(delivery.DeliveryEvent),
              priority: delivery.priority,
              createdAt: delivery.createdAt,
              acceptedAt: delivery.acceptedAt ?? null,
              collectedAt: delivery.collectedAt ?? null,
              deliveredAt: delivery.deliveredAt ?? null,
              canceledAt: delivery.canceledAt ?? null,
              proofCount: delivery.DeliveryProof?.length ?? 0,
              hasMapPoint: delivery.CustomerAddress?.latitude != null && delivery.CustomerAddress.longitude != null,
            })),
            parsed.data,
            parsed.data,
          ),
          source: "supabase-rest",
        };
      }

      return reply.status(503).send({
        error: "DATABASE_UNAVAILABLE",
        message: "Nao foi possivel montar o relatorio.",
      });
    }
  });

  app.get("/reports/deliveries-export", async (request, reply) => {
    const session = await requireAuth(request, reply, ["ADMIN", "GERENTE"]);
    if (!session) return;

    const parsed = deliveryReportQuerySchema.safeParse(request.query);
    if (!parsed.success) return validationError(reply, parsed.error);
    const storeScope = await resolveUserStoreScope(session);
    const exportLimit = deliveryReportExportLimit(parsed.data.exportLimit);

    try {
      const deliveries = await prisma.delivery.findMany({
        where: deliveryReportWhere(session, storeScope, parsed.data.storeId, parsed.data),
        orderBy: { createdAt: "desc" },
        take: exportLimit,
        include: {
          store: true,
          customer: true,
          customerAddress: true,
          courier: {
            include: {
              user: true,
            },
          },
          events: {
            where: { type: "CRIADA" },
            select: { metadata: true },
            take: 1,
          },
          _count: {
            select: {
              proofs: true,
            },
          },
        },
      });

      return sendDeliveryReportCsv(
        reply,
        buildDeliveryReportCsv(
          deliveries.map((delivery) => ({
            id: delivery.id,
            publicCode: delivery.publicCode,
            storeDailyDate: delivery.storeDailyDate.toISOString().slice(0, 10),
            storeDailyNumber: delivery.storeDailyNumber,
            store: delivery.store.name,
            customer: delivery.customer.name,
            phone: delivery.customer.phone,
            address: formatAddress({
              street: delivery.customerAddress.street,
              number: delivery.customerAddress.number,
              complement: delivery.customerAddress.complement,
              neighborhood: delivery.customerAddress.neighborhood,
            }),
            hasMapPoint: delivery.customerAddress.latitude !== null && delivery.customerAddress.longitude !== null,
            status: delivery.status,
            courier: delivery.courier?.user.name ?? "Sem motoboy",
            attendantName: deliveryCreationAttendantName(delivery.events),
            priority: delivery.priority,
            createdAt: delivery.createdAt.toISOString(),
            acceptedAt: delivery.acceptedAt?.toISOString() ?? null,
            collectedAt: delivery.collectedAt?.toISOString() ?? null,
            deliveredAt: delivery.deliveredAt?.toISOString() ?? null,
            canceledAt: delivery.canceledAt?.toISOString() ?? null,
            proofCount: delivery._count.proofs,
          })),
          {
            generatedAt: new Date().toISOString(),
            scopeLabel: deliveryReportScopeLabel(session, parsed.data.storeId),
            periodLabel: deliveryReportPeriodLabel(parsed.data),
            period: parsed.data,
            filters: parsed.data,
            exportLimit,
            exportLimitReached: deliveries.length >= exportLimit,
          },
        ),
        parsed.data,
      );
    } catch (error) {
      app.log.error({ error }, "delivery report export error");
      if (canUseSupabaseRest()) {
        const deliveries = await supabaseRest<SupabaseDelivery[]>("Delivery", {
          query:
            `select=id,publicCode,storeDailyDate,storeDailyNumber,status,priority,createdAt,acceptedAt,collectedAt,deliveredAt,canceledAt,Store(id,name),Courier(id,User(name)),Customer(id,name,phone),CustomerAddress(id,street,number,complement,neighborhood,latitude,longitude),DeliveryProof(id),DeliveryEvent(type,metadata)&order=createdAt.desc&limit=${exportLimit}${deliveryReportRestFilter(session, storeScope, parsed.data.storeId, parsed.data)}`,
        });

        return sendDeliveryReportCsv(
          reply,
          buildDeliveryReportCsv(
            deliveries.map((delivery) => ({
              id: delivery.id,
              publicCode: delivery.publicCode,
              storeDailyDate: delivery.storeDailyDate ?? null,
              storeDailyNumber: delivery.storeDailyNumber ?? null,
              store: delivery.Store?.name ?? "Loja",
              customer: delivery.Customer?.name ?? "Cliente",
              phone: delivery.Customer?.phone ?? "",
              address: formatAddress({
                street: delivery.CustomerAddress?.street ?? "",
                number: delivery.CustomerAddress?.number ?? "",
                complement: delivery.CustomerAddress?.complement ?? null,
                neighborhood: delivery.CustomerAddress?.neighborhood ?? null,
              }),
              hasMapPoint: delivery.CustomerAddress?.latitude != null && delivery.CustomerAddress.longitude != null,
              status: delivery.status,
              courier: delivery.Courier?.User?.name ?? "Sem motoboy",
              attendantName: deliveryCreationAttendantName(delivery.DeliveryEvent),
              priority: delivery.priority,
              createdAt: delivery.createdAt,
              acceptedAt: delivery.acceptedAt ?? null,
              collectedAt: delivery.collectedAt ?? null,
              deliveredAt: delivery.deliveredAt ?? null,
              canceledAt: delivery.canceledAt ?? null,
              proofCount: delivery.DeliveryProof?.length ?? 0,
            })),
            {
              generatedAt: new Date().toISOString(),
              scopeLabel: deliveryReportScopeLabel(session, parsed.data.storeId),
              periodLabel: deliveryReportPeriodLabel(parsed.data),
              period: parsed.data,
              filters: parsed.data,
              exportLimit,
              exportLimitReached: deliveries.length >= exportLimit,
            },
          ),
          parsed.data,
        );
      }

      return reply.status(503).send({
        error: "DATABASE_UNAVAILABLE",
        message: "Nao foi possivel exportar o relatorio.",
      });
    }
  });

  app.get("/deliveries/:deliveryId/events", async (request, reply) => {
    const session = await requireAuth(request, reply, ["ADMIN", "GERENTE", "MOTOBOY"]);
    if (!session) return;

    const params = request.params as { deliveryId: string };
    if (!params.deliveryId) {
      return reply.status(400).send({
        error: "VALIDATION_ERROR",
        message: "Informe a entrega.",
      });
    }
    if (!(await canViewDelivery(session, params.deliveryId, reply))) return;

    try {
      const events = await prisma.deliveryEvent.findMany({
        where: { deliveryId: params.deliveryId },
        orderBy: { createdAt: "asc" },
        include: {
          actorUser: true,
        },
      });

      return events.map((event) => ({
        id: event.id,
        deliveryId: event.deliveryId,
        type: event.type,
        notes: event.notes,
        metadata: event.metadata,
        actor: event.actorUser
          ? {
              id: event.actorUser.id,
              name: event.actorUser.name,
              role: event.actorUser.role,
            }
          : null,
        createdAt: event.createdAt.toISOString(),
      }));
    } catch (error) {
      app.log.error({ error }, "delivery events list error");
      if (canUseSupabaseRest()) {
        const events = await supabaseRest<SupabaseDeliveryEvent[]>("DeliveryEvent", {
          query: `select=*,User:actorUserId(id,name,role)&deliveryId=eq.${params.deliveryId}&order=createdAt.asc`,
        });

        return events.map((event) => ({
          id: event.id,
          deliveryId: event.deliveryId,
          type: event.type,
          notes: event.notes,
          metadata: event.metadata ?? null,
          actor: event.User
            ? {
                id: event.User.id,
                name: event.User.name,
                role: event.User.role,
              }
            : null,
          createdAt: event.createdAt,
          source: "supabase-rest",
        }));
      }

      return reply.status(503).send({
        error: "DATABASE_UNAVAILABLE",
        message: "Nao foi possivel listar o historico da entrega.",
      });
    }
  });

  app.get("/customers", async (request, reply) => {
    const session = await requireAuth(request, reply, ["ADMIN", "GERENTE"]);
    if (!session) return;

    const query = request.query as { phone?: string };
    const phone = query.phone?.trim();
    if (!phone || phone.length < 8) {
      return reply.status(400).send({
        error: "VALIDATION_ERROR",
        message: "Informe um telefone com pelo menos 8 caracteres.",
      });
    }

    try {
      const customer = await prisma.customer.findUnique({
        where: { phone },
        include: {
          addresses: {
            where: { active: true },
            orderBy: { updatedAt: "desc" },
          },
        },
      });

      if (!customer) return reply.send(null);

      return {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        addresses: customer.addresses.map((address) => ({
          id: address.id,
          street: address.street,
          number: address.number,
          complement: address.complement,
          neighborhood: address.neighborhood,
          reference: address.reference,
          latitude: address.latitude ? Number(address.latitude) : null,
          longitude: address.longitude ? Number(address.longitude) : null,
          updatedAt: address.updatedAt.toISOString(),
        })),
      };
    } catch (error) {
      app.log.error({ error }, "customer lookup error");
      if (canUseSupabaseRest()) {
        const customers = await supabaseRest<SupabaseCustomer[]>("Customer", {
          query: `select=*,CustomerAddress(*)&phone=eq.${encodeURIComponent(phone)}`,
        });
        const customer = customers[0];
        if (!customer) return reply.send(null);

        return {
          id: customer.id,
          name: customer.name,
          phone: customer.phone,
          addresses: (customer.CustomerAddress ?? [])
            .filter((address) => address.active !== false)
            .map((address) => ({
              id: address.id,
              street: address.street,
              number: address.number,
              complement: address.complement,
              neighborhood: address.neighborhood,
              reference: address.reference,
              latitude: address.latitude ?? null,
              longitude: address.longitude ?? null,
              updatedAt: address.updatedAt,
            })),
          source: "supabase-rest",
        };
      }

      return reply.status(503).send({
        error: "DATABASE_UNAVAILABLE",
        message: "Nao foi possivel buscar o cliente.",
      });
    }
  });

  app.post("/customers", async (request, reply) => {
    const session = await requireAuth(request, reply, ["ADMIN", "GERENTE"]);
    if (!session) return;

    const parsed = createCustomerSchema.safeParse(request.body);
    if (!parsed.success) return validationError(reply, parsed.error);

    try {
      const customer = await prisma.customer.upsert({
        where: { phone: parsed.data.phone },
        update: { name: parsed.data.name },
        create: parsed.data,
      });

      return reply.status(201).send({
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        createdAt: customer.createdAt.toISOString(),
        updatedAt: customer.updatedAt.toISOString(),
      });
    } catch (error) {
      app.log.error({ error }, "customer create error");
      if (canUseSupabaseRest()) {
        try {
          const customers = await supabaseRest<SupabaseCustomer[]>("Customer", {
            method: "POST",
            query: "on_conflict=phone",
            prefer: "resolution=merge-duplicates,return=representation",
            body: parsed.data,
          });
          return reply.status(201).send({ ...customers[0], source: "supabase-rest" });
        } catch (restError) {
          app.log.error({ error: restError }, "customer create supabase rest error");
        }
      }

      return reply.status(503).send({
        error: "DATABASE_UNAVAILABLE",
        message: "Nao foi possivel salvar o cliente.",
      });
    }
  });

  app.post("/customer-addresses", async (request, reply) => {
    const session = await requireAuth(request, reply, ["ADMIN", "GERENTE"]);
    if (!session) return;

    const parsed = createCustomerAddressSchema.safeParse(request.body);
    if (!parsed.success) return validationError(reply, parsed.error);

    try {
      const address = await prisma.customerAddress.create({
        data: {
          customerId: parsed.data.customerId,
          street: parsed.data.street,
          number: parsed.data.number,
          complement: parsed.data.complement,
          neighborhood: parsed.data.neighborhood,
          reference: parsed.data.reference,
          latitude: parsed.data.coordinates?.latitude,
          longitude: parsed.data.coordinates?.longitude,
        },
      });

      return reply.status(201).send(formatCustomerAddress(address));
    } catch (error) {
      app.log.error({ error }, "customer address create error");
      if (canUseSupabaseRest()) {
        try {
          const addresses = await supabaseRest<SupabaseCustomerAddress[]>("CustomerAddress", {
            method: "POST",
            prefer: "return=representation",
            body: {
              customerId: parsed.data.customerId,
              street: parsed.data.street,
              number: parsed.data.number,
              complement: parsed.data.complement,
              neighborhood: parsed.data.neighborhood,
              reference: parsed.data.reference,
              latitude: parsed.data.coordinates?.latitude,
              longitude: parsed.data.coordinates?.longitude,
            },
          });
          return reply.status(201).send({ ...addresses[0], source: "supabase-rest" });
        } catch (restError) {
          app.log.error({ error: restError }, "customer address create supabase rest error");
        }
      }

      return reply.status(503).send({
        error: "DATABASE_UNAVAILABLE",
        message: "Nao foi possivel salvar o endereco.",
      });
    }
  });

  app.post("/deliveries", async (request, reply) => {
    const session = await requireAuth(request, reply, ["ADMIN", "GERENTE"]);
    if (!session) return;

    const parsed = createDeliverySchema.safeParse(request.body);
    if (!parsed.success) return validationError(reply, parsed.error);
    const sourceStoreId = await resolveWritableStoreId(session, parsed.data.storeId, reply);
    if (!sourceStoreId) return;

    try {
      const result = await prisma.$transaction(async (tx) => {
        const numbering = await allocateStoreDailyDeliveryCode(tx, sourceStoreId);
        return tx.delivery.create({
          data: {
            publicCode: numbering.publicCode,
            storeDailyDate: numbering.storeDailyDate,
            storeDailyNumber: numbering.storeDailyNumber,
            createdAt: numbering.createdAt,
            storeId: sourceStoreId,
            customerId: parsed.data.customerId,
            customerAddressId: parsed.data.customerAddressId,
            priority: parsed.data.priority,
            deadlineTier: parsed.data.deadlineTier,
            notes: parsed.data.notes,
            earliestDispatchAt: parsed.data.earliestDispatchAt ? new Date(parsed.data.earliestDispatchAt) : undefined,
            events: {
              create: [
                {
                  type: "CRIADA",
                  notes: "Entrega criada pelo painel web com endereco cadastrado.",
                  actorUserId: session.sub,
                },
                ...(parsed.data.earliestDispatchAt
                  ? [
                      {
                        type: "AGENDADA" as const,
                        notes: `Despacho permitido a partir de ${parsed.data.earliestDispatchAt}.`,
                        actorUserId: session.sub,
                      },
                    ]
                  : []),
              ],
            },
          },
          include: {
            customer: true,
            customerAddress: true,
            store: true,
            events: true,
          },
        });
      });

      const notification = await notifyNewDeliveryIfDispatchable({
        storeId: result.store.id,
        deliveryId: result.id,
        publicCode: result.publicCode,
        earliestDispatchAt: result.earliestDispatchAt,
        log: request.log,
      });

      return reply.status(201).send({
        ...formatCreatedDelivery(result),
        notification,
      });
    } catch (error) {
      app.log.error({ error }, "delivery create error");
      if (canUseSupabaseRest()) {
        try {
          const result = await createDeliveryFromExistingRecordsWithSupabaseRest(
            {
              ...parsed.data,
              storeId: sourceStoreId,
            },
            session.sub,
          );
          const notification = await notifyNewDeliveryIfDispatchable({
            storeId: result.store.id,
            deliveryId: result.id,
            publicCode: result.publicCode,
            earliestDispatchAt: result.earliestDispatchAt,
            log: request.log,
          });
          return reply.status(201).send({
            ...result,
            notification,
          });
        } catch (restError) {
          app.log.error({ error: restError }, "delivery create supabase rest error");
        }
      }

      return reply.status(503).send({
        error: "DATABASE_UNAVAILABLE",
        message: "Nao foi possivel criar a entrega.",
      });
    }
  });

  app.post("/deliveries/create-with-customer", async (request, reply) => {
    const session = await requireAuth(request, reply, ["ADMIN", "GERENTE"]);
    if (!session) return;

    const parsed = createDeliveryWithCustomerSchema.safeParse(request.body);
    if (!parsed.success) return validationError(reply, parsed.error);
    const sourceStoreId = await resolveWritableStoreId(session, parsed.data.storeId, reply);
    if (!sourceStoreId) return;
    const requestedRedirectStoreId = parsed.data.redirectStoreId;

    try {
      const result = await prisma.$transaction(async (tx) => {
        const targetStoreId = requestedRedirectStoreId ?? sourceStoreId;
        const redirectedFromStoreId =
          requestedRedirectStoreId && requestedRedirectStoreId !== sourceStoreId ? sourceStoreId : undefined;
        const customer = await tx.customer.upsert({
          where: { phone: parsed.data.phone },
          update: { name: parsed.data.customerName },
          create: {
            name: parsed.data.customerName,
            phone: parsed.data.phone,
          },
        });

        const address = parsed.data.customerAddressId
          ? await tx.customerAddress
              .findFirstOrThrow({
                where: {
                  id: parsed.data.customerAddressId,
                  customerId: customer.id,
                  active: true,
                },
              })
              .then((existingAddress) =>
                parsed.data.coordinates
                  ? tx.customerAddress.update({
                      where: { id: existingAddress.id },
                      data: {
                        latitude: parsed.data.coordinates.latitude,
                        longitude: parsed.data.coordinates.longitude,
                      },
                    })
                  : existingAddress,
              )
          : await tx.customerAddress.create({
              data: {
                customerId: customer.id,
                street: parsed.data.street,
                number: parsed.data.number,
                complement: parsed.data.complement,
                neighborhood: parsed.data.neighborhood,
                reference: parsed.data.reference,
                latitude: parsed.data.coordinates?.latitude,
                longitude: parsed.data.coordinates?.longitude,
              },
            });

        const numbering = await allocateStoreDailyDeliveryCode(tx, targetStoreId);
        const delivery = await tx.delivery.create({
          data: {
            publicCode: numbering.publicCode,
            storeDailyDate: numbering.storeDailyDate,
            storeDailyNumber: numbering.storeDailyNumber,
            createdAt: numbering.createdAt,
            storeId: targetStoreId,
            redirectedFromStoreId,
            customerId: customer.id,
            customerAddressId: address.id,
            priority: parsed.data.priority,
            deadlineTier: parsed.data.deadlineTier,
            notes: parsed.data.notes,
            earliestDispatchAt: parsed.data.earliestDispatchAt ? new Date(parsed.data.earliestDispatchAt) : undefined,
            events: {
              create: [
                {
                  type: "CRIADA",
                  notes: deliveryCreationNotes({
                    hasCoordinates: Boolean(parsed.data.coordinates),
                    attendantName: parsed.data.attendantName,
                  }),
                  actorUserId: session.sub,
                  metadata: parsed.data.attendantName
                    ? {
                        attendantName: parsed.data.attendantName,
                      }
                    : undefined,
                },
                ...(parsed.data.earliestDispatchAt
                  ? [
                      {
                        type: "AGENDADA" as const,
                        notes: `Despacho permitido a partir de ${parsed.data.earliestDispatchAt}.`,
                        actorUserId: session.sub,
                      },
                    ]
                  : []),
                ...(redirectedFromStoreId
                  ? [
                      {
                        type: "REDIRECIONADA" as const,
                        notes: "Entrega redirecionada manualmente no painel web.",
                        actorUserId: session.sub,
                        metadata: {
                          fromStoreId: redirectedFromStoreId,
                          toStoreId: targetStoreId,
                        },
                      },
                    ]
                  : []),
              ],
            },
          },
          include: {
            customer: true,
            customerAddress: true,
            store: true,
            events: true,
          },
        });

        return delivery;
      });

      const notification = await notifyNewDeliveryIfDispatchable({
        storeId: result.store.id,
        deliveryId: result.id,
        publicCode: result.publicCode,
        earliestDispatchAt: result.earliestDispatchAt,
        log: request.log,
      });

      return reply.status(201).send({
        id: result.id,
        publicCode: result.publicCode,
        storeDailyDate: result.storeDailyDate.toISOString().slice(0, 10),
        storeDailyNumber: result.storeDailyNumber,
        status: result.status,
        priority: result.priority,
        deadlineTier: result.deadlineTier,
        createdAt: result.createdAt.toISOString(),
        earliestDispatchAt: result.earliestDispatchAt?.toISOString() ?? null,
        store: {
          id: result.store.id,
          name: result.store.name,
        },
        customer: {
          id: result.customer.id,
          name: result.customer.name,
          phone: result.customer.phone,
        },
        address: {
          id: result.customerAddress.id,
          street: result.customerAddress.street,
          number: result.customerAddress.number,
          complement: result.customerAddress.complement,
        },
        events: result.events.map((event) => ({
          id: event.id,
          type: event.type,
          createdAt: event.createdAt.toISOString(),
        })),
        notification,
      });
    } catch (error) {
      app.log.error({ error }, "delivery create-with-customer error");
      if (canUseSupabaseRest()) {
        try {
          const result = await createDeliveryWithSupabaseRest(
            {
              ...parsed.data,
              storeId: sourceStoreId,
              redirectStoreId: requestedRedirectStoreId,
            },
            session.sub,
          );
          const notification = await notifyNewDeliveryIfDispatchable({
            storeId: result.store.id,
            deliveryId: result.id,
            publicCode: result.publicCode,
            earliestDispatchAt: result.earliestDispatchAt,
            log: request.log,
          });
          return reply.status(201).send({
            ...result,
            notification,
          });
        } catch (restError) {
          app.log.error({ error: restError }, "delivery create-with-customer supabase rest error");
        }
      }

      return reply.status(503).send({
        error: "DATABASE_UNAVAILABLE",
        message: "Nao foi possivel criar a entrega. Confira a conexao da API com o Postgres/Supabase pooler.",
      });
    }
  });

  app.post("/deliveries/accept", async (request, reply) => {
    const session = await requireAuth(request, reply, ["ADMIN", "GERENTE", "MOTOBOY"]);
    if (!session) return;

    const parsed = acceptDeliverySchema.safeParse(request.body);
    if (!parsed.success) return validationError(reply, parsed.error);
    if (session.role === "MOTOBOY" && session.courierId !== parsed.data.courierId) {
      return reply.status(403).send({
        error: "FORBIDDEN",
        message: "Motoboy so pode aceitar entregas para o proprio usuario.",
      });
    }
    if (!(await canViewDelivery(session, parsed.data.deliveryId, reply))) return;

    try {
      const result = await prisma.$transaction(async (tx) => {
        const now = new Date();
        const courier = await tx.courier.findUnique({
          where: { id: parsed.data.courierId },
          select: { available: true },
        });
        if (!courier?.available) {
          throw new CourierUnavailableError();
        }

        const delivery = await tx.delivery.update({
          where: { id: parsed.data.deliveryId },
          data: {
            courierId: parsed.data.courierId,
            status: "ACEITA_PELO_MOTOBOY",
            acceptedAt: now,
            events: {
              create: {
                type: "ACEITA",
                notes: "Entrega aceita pelo motoboy.",
                actorUserId: session.sub,
              },
            },
          },
          include: {
            customerAddress: true,
            courier: {
              include: {
                user: true,
              },
            },
            events: {
              orderBy: { createdAt: "desc" },
              take: 1,
            },
          },
        });

        await tx.courier.update({
          where: { id: parsed.data.courierId },
          data: { available: false },
        });

        await attachDeliveryToCourierRoute(tx, delivery);

        return delivery;
      });

      return reply.send(formatDeliveryMutationResponse(result));
    } catch (error) {
      if (error instanceof CourierUnavailableError) {
        return reply.status(409).send({
          error: "COURIER_UNAVAILABLE",
          message: "Ative sua disponibilidade antes de aceitar corridas.",
        });
      }

      app.log.error({ error }, "delivery accept error");
      if (canUseSupabaseRest()) {
        try {
          const now = new Date().toISOString();
          const couriers = await supabaseRest<Array<{ available: boolean }>>("Courier", {
            query: `select=available&id=eq.${parsed.data.courierId}`,
          });
          if (!couriers[0]?.available) {
            return reply.status(409).send({
              error: "COURIER_UNAVAILABLE",
              message: "Ative sua disponibilidade antes de aceitar corridas.",
            });
          }

          const result = await updateDeliveryStatusWithSupabaseRest({
            deliveryId: parsed.data.deliveryId,
            status: "ACEITA_PELO_MOTOBOY",
            eventType: "ACEITA",
            notes: "Entrega aceita pelo motoboy.",
            actorUserId: session.sub,
            timestamps: { acceptedAt: now },
            courierId: parsed.data.courierId,
          });
          await supabaseRest("Courier", {
            method: "PATCH",
            query: `id=eq.${parsed.data.courierId}`,
            body: { available: false },
          });
          await attachDeliveryToCourierRouteWithSupabaseRest(parsed.data.courierId, parsed.data.deliveryId);
          return reply.send(result);
        } catch (restError) {
          app.log.error({ error: restError }, "delivery accept supabase rest error");
        }
      }

      return reply.status(503).send({
        error: "DATABASE_UNAVAILABLE",
        message: "Nao foi possivel aceitar a entrega.",
      });
    }
  });

  app.post("/deliveries/collect", async (request, reply) => {
    const session = await requireAuth(request, reply, ["ADMIN", "GERENTE", "MOTOBOY"]);
    if (!session) return;

    const parsed = deliveryStatusTransitionSchema.safeParse(request.body);
    if (!parsed.success) return validationError(reply, parsed.error);
    if (!(await canStoreUserOperateDelivery(session, parsed.data.deliveryId, reply))) return;
    if (!(await canMotoboyOperateDelivery(session, parsed.data.deliveryId, reply))) return;
    return transitionDelivery({
      app,
      reply,
      deliveryId: parsed.data.deliveryId,
      status: "COLETADA",
      eventType: "COLETADA",
      notes: parsed.data.notes ?? "Entrega coletada na loja.",
      timestamps: { collectedAt: new Date() },
      actorUserId: session.sub,
    });
  });

  app.post("/deliveries/start-route", async (request, reply) => {
    const session = await requireAuth(request, reply, ["ADMIN", "GERENTE", "MOTOBOY"]);
    if (!session) return;

    const parsed = deliveryStatusTransitionSchema.safeParse(request.body);
    if (!parsed.success) return validationError(reply, parsed.error);
    if (!(await canStoreUserOperateDelivery(session, parsed.data.deliveryId, reply))) return;
    if (!(await canMotoboyOperateDelivery(session, parsed.data.deliveryId, reply))) return;
    return transitionDelivery({
      app,
      reply,
      deliveryId: parsed.data.deliveryId,
      status: "EM_ROTA",
      eventType: "ROTA_RECALCULADA",
      notes: parsed.data.notes ?? "Entrega saiu para rota.",
      timestamps: {},
      actorUserId: session.sub,
    });
  });

  app.post("/deliveries/deliver", async (request, reply) => {
    const session = await requireAuth(request, reply, ["ADMIN", "GERENTE", "MOTOBOY"]);
    if (!session) return;

    const parsed = deliveryStatusTransitionSchema.safeParse(request.body);
    if (!parsed.success) return validationError(reply, parsed.error);
    if (!(await canStoreUserOperateDelivery(session, parsed.data.deliveryId, reply))) return;
    if (!(await canMotoboyOperateDelivery(session, parsed.data.deliveryId, reply))) return;
    const proofMetadata = parsed.data.proofId
      ? await resolveDeliveryProofMetadata(parsed.data.deliveryId, parsed.data.proofId, reply)
      : undefined;
    if (parsed.data.proofId && !proofMetadata) return;
    return transitionDelivery({
      app,
      reply,
      deliveryId: parsed.data.deliveryId,
      status: "ENTREGUE",
      eventType: "ENTREGUE",
      notes: parsed.data.notes ?? "Entrega concluida.",
      metadata: proofMetadata,
      timestamps: { deliveredAt: new Date() },
      actorUserId: session.sub,
    });
  });

  app.post("/deliveries/:deliveryId/proofs", { bodyLimit: DELIVERY_PROOF_UPLOAD_BODY_LIMIT_BYTES }, async (request, reply) => {
    const session = await requireAuth(request, reply, ["ADMIN", "GERENTE", "MOTOBOY"]);
    if (!session) return;

    const params = request.params as { deliveryId: string };
    const parsed = uploadDeliveryProofSchema.safeParse(request.body);
    if (!parsed.success) return validationError(reply, parsed.error);
    if (!(await canStoreUserOperateDelivery(session, params.deliveryId, reply))) return;
    if (!(await canMotoboyOperateDelivery(session, params.deliveryId, reply))) return;

    try {
      const proof = await saveDeliveryProof({
        deliveryId: params.deliveryId,
        actorUserId: session.sub,
        fileName: parsed.data.fileName,
        mimeType: parsed.data.mimeType,
        contentBase64: parsed.data.contentBase64,
      });

      return reply.status(201).send(proof);
    } catch (error) {
      app.log.error({ error }, "delivery proof upload error");
      return reply.status(400).send({
        error: "DELIVERY_PROOF_UPLOAD_FAILED",
        message: "Nao foi possivel salvar o comprovante da entrega.",
      });
    }
  });

  app.get("/deliveries/:deliveryId/proofs", async (request, reply) => {
    const session = await requireAuth(request, reply, ["ADMIN", "GERENTE", "MOTOBOY"]);
    if (!session) return;

    const params = request.params as { deliveryId: string };
    if (!(await canViewDelivery(session, params.deliveryId, reply))) return;

    try {
      const proofs = await prisma.deliveryProof.findMany({
        where: { deliveryId: params.deliveryId },
        orderBy: { createdAt: "desc" },
        include: {
          actorUser: {
            select: {
              id: true,
              name: true,
              role: true,
            },
          },
        },
      });

      return proofs.map(formatDeliveryProof);
    } catch (error) {
      app.log.error({ error }, "delivery proof list error");
      if (canUseSupabaseRest()) {
        const proofs = await supabaseRest<
          Array<{
            id: string;
            deliveryId: string;
            actorUserId: string | null;
            fileName: string;
            mimeType: string;
            sizeBytes: number;
            sha256: string;
            createdAt: string;
            User?: {
              id: string;
              name: string;
              role: string;
            } | null;
          }>
        >("DeliveryProof", {
          query: `select=id,deliveryId,actorUserId,fileName,mimeType,sizeBytes,sha256,createdAt,User:actorUserId(id,name,role)&deliveryId=eq.${params.deliveryId}&order=createdAt.desc`,
        });

        return proofs.map((proof) => ({
          id: proof.id,
          deliveryId: proof.deliveryId,
          fileName: proof.fileName,
          mimeType: proof.mimeType,
          sizeBytes: proof.sizeBytes,
          sha256: proof.sha256,
          actor: proof.User ?? null,
          createdAt: proof.createdAt,
        }));
      }

      return reply.status(503).send({
        error: "DATABASE_UNAVAILABLE",
        message: "Nao foi possivel buscar comprovantes da entrega.",
      });
    }
  });

  app.get("/deliveries/:deliveryId/proofs/:proofId/file", async (request, reply) => {
    const session = await requireAuth(request, reply, ["ADMIN", "GERENTE", "MOTOBOY"]);
    if (!session) return;

    const params = request.params as { deliveryId: string; proofId: string };
    if (!(await canViewDelivery(session, params.deliveryId, reply))) return;

    try {
      const proof = await prisma.deliveryProof.findFirst({
        where: {
          id: params.proofId,
          deliveryId: params.deliveryId,
        },
      });
      if (!proof) {
        return reply.status(404).send({
          error: "DELIVERY_PROOF_NOT_FOUND",
          message: "Comprovante nao encontrado para esta entrega.",
        });
      }

      await access(proof.storagePath, constants.R_OK);

      return reply
        .header("Content-Type", proof.mimeType)
        .header("Cache-Control", "private, no-store")
        .header("X-Content-Type-Options", "nosniff")
        .header("Content-Disposition", `inline; filename="${sanitizeDownloadFileName(proof.fileName)}"`)
        .send(createReadStream(proof.storagePath));
    } catch (error) {
      app.log.error({ error }, "delivery proof file error");
      return reply.status(404).send({
        error: "DELIVERY_PROOF_FILE_NOT_FOUND",
        message: "Arquivo do comprovante nao encontrado no servidor.",
      });
    }
  });

  app.post("/deliveries/problem", async (request, reply) => {
    const session = await requireAuth(request, reply, ["ADMIN", "GERENTE", "MOTOBOY"]);
    if (!session) return;

    const parsed = registerDeliveryProblemSchema.safeParse(request.body);
    if (!parsed.success) return validationError(reply, parsed.error);
    if (!(await canStoreUserOperateDelivery(session, parsed.data.deliveryId, reply))) return;
    if (!(await canMotoboyOperateDelivery(session, parsed.data.deliveryId, reply))) return;
    return transitionDelivery({
      app,
      reply,
      deliveryId: parsed.data.deliveryId,
      status: "PROBLEMA",
      eventType: "OCORRENCIA_REGISTRADA",
      notes: parsed.data.notes,
      metadata: parsed.data.metadata,
      timestamps: {},
      actorUserId: session.sub,
    });
  });

  app.post("/deliveries/cancel", async (request, reply) => {
    const session = await requireAuth(request, reply, ["ADMIN", "GERENTE"]);
    if (!session) return;

    const parsed = cancelDeliverySchema.safeParse(request.body);
    if (!parsed.success) return validationError(reply, parsed.error);
    if (!(await canStoreUserOperateDelivery(session, parsed.data.deliveryId, reply))) return;

    try {
      const result = await prisma.$transaction(async (tx) => {
        const delivery = await tx.delivery.update({
          where: { id: parsed.data.deliveryId },
          data: {
            status: "CANCELADA",
            canceledAt: new Date(),
            events: {
              create: {
                type: "CANCELADA",
                notes: parsed.data.reason,
                actorUserId: session.sub,
                metadata: {
                  notifyCourier: parsed.data.notifyCourier,
                },
              },
            },
          },
          include: {
            events: {
              orderBy: { createdAt: "desc" },
              take: 1,
            },
          },
        });

        await tx.routeStop.updateMany({
          where: {
            deliveryId: parsed.data.deliveryId,
            status: "PENDENTE",
          },
          data: {
            status: "CANCELADA",
          },
        });

        return delivery;
      });

      const notification = await notifyDeliveryCanceledIfRequested({
        notifyCourier: parsed.data.notifyCourier,
        courierId: result.courierId,
        deliveryId: result.id,
        publicCode: result.publicCode,
        reason: parsed.data.reason,
        log: request.log,
      });

      return reply.send({
        id: result.id,
        publicCode: result.publicCode,
        storeDailyDate: result.storeDailyDate.toISOString().slice(0, 10),
        storeDailyNumber: result.storeDailyNumber,
        status: result.status,
        canceledAt: result.canceledAt?.toISOString() ?? null,
        event: result.events[0]
          ? {
              id: result.events[0].id,
              type: result.events[0].type,
              notes: result.events[0].notes,
              createdAt: result.events[0].createdAt.toISOString(),
            }
          : null,
        notification,
      });
    } catch (error) {
      app.log.error({ error }, "delivery cancel error");
      if (canUseSupabaseRest()) {
        try {
          const result = await cancelDeliveryWithSupabaseRest(parsed.data, session.sub);
          const notification = await notifyDeliveryCanceledIfRequested({
            notifyCourier: parsed.data.notifyCourier,
            courierId: result.courierId,
            deliveryId: result.id,
            publicCode: result.publicCode,
            reason: parsed.data.reason,
            log: request.log,
          });
          return reply.send({
            ...result,
            notification,
          });
        } catch (restError) {
          app.log.error({ error: restError }, "delivery cancel supabase rest error");
        }
      }

      return reply.status(503).send({
        error: "DATABASE_UNAVAILABLE",
        message: "Nao foi possivel cancelar a entrega. Confira a conexao da API com o banco.",
      });
    }
  });
}

type DeliveryStatusValue = "ACEITA_PELO_MOTOBOY" | "COLETADA" | "EM_ROTA" | "ENTREGUE" | "PROBLEMA";
type DeliveryEventValue = "ACEITA" | "COLETADA" | "ROTA_RECALCULADA" | "ENTREGUE" | "OCORRENCIA_REGISTRADA";

/** Recupera o balconista informado na criacao sem exigir nova coluna no banco. */
function deliveryCreationAttendantName(events?: Array<{ type?: string; metadata?: unknown }> | null) {
  const creationEvent = events?.find((event) => !event.type || event.type === "CRIADA");
  const metadata = creationEvent?.metadata;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const attendantName = (metadata as Record<string, unknown>).attendantName;
  return typeof attendantName === "string" && attendantName.trim() ? attendantName.trim() : null;
}

/** Monta filtro Prisma de relatorio respeitando loja, periodo, status, prioridade e comprovante. */
function deliveryReportWhere(
  session: { role: string; storeId?: string | null },
  storeScope: string[] | null,
  storeId?: string,
  period: { date?: string; startsAt?: string; endsAt?: string; status?: string; priority?: string; proof?: "com" | "sem"; mapPoint?: "com" | "sem" } = {},
): Prisma.DeliveryWhereInput {
  const where: Prisma.DeliveryWhereInput = {};

  if (isStoreLoginRole(session.role)) {
    const allowedStoreIds = storeScope ?? [];
    where.storeId = storeId && allowedStoreIds.includes(storeId) ? storeId : { in: allowedStoreIds };
  } else if (storeId) {
    where.storeId = storeId;
  }

  const range = reportDateRange(period);
  if (range) {
    where.OR = [
      { createdAt: range },
      { acceptedAt: range },
      { collectedAt: range },
      { deliveredAt: range },
      { canceledAt: range },
    ];
  }

  if (period.status) {
    where.status = period.status as Prisma.EnumDeliveryStatusFilter<"Delivery">;
  }
  if (period.priority) {
    where.priority = period.priority as Prisma.EnumDeliveryPriorityFilter<"Delivery">;
  }
  if (period.proof === "com") {
    where.proofs = { some: {} };
  }
  if (period.proof === "sem") {
    where.proofs = { none: {} };
  }
  if (period.mapPoint === "com") {
    addDeliveryReportWhereAnd(where, {
      customerAddress: {
        latitude: { not: null },
        longitude: { not: null },
      },
    });
  }
  if (period.mapPoint === "sem") {
    addDeliveryReportWhereAnd(where, {
      OR: [
        { customerAddress: { latitude: null } },
        { customerAddress: { longitude: null } },
      ],
    });
  }

  return where;
}

/** Acrescenta restricoes compostas sem sobrescrever filtros OR ja usados pelo periodo. */
function addDeliveryReportWhereAnd(where: Prisma.DeliveryWhereInput, condition: Prisma.DeliveryWhereInput) {
  if (!where.AND) {
    where.AND = [condition];
    return;
  }
  where.AND = Array.isArray(where.AND) ? [...where.AND, condition] : [where.AND, condition];
}

/** Monta o equivalente REST dos filtros de relatorio que tambem existem no caminho Prisma. */
export function deliveryReportRestFilter(
  session: { role: string; storeId?: string | null },
  storeScope: string[] | null,
  storeId?: string,
  filters: { status?: string; priority?: string } = {},
) {
  const filterParts = [
    filters.status ? `&status=eq.${filters.status}` : "",
    filters.priority ? `&priority=eq.${filters.priority}` : "",
  ].join("");
  if (isStoreLoginRole(session.role)) {
    const allowedStoreIds = storeScope ?? [];
    const storeFilter = storeId && allowedStoreIds.includes(storeId)
      ? `&storeId=eq.${storeId}`
      : deliveryStoreRestFilter(allowedStoreIds);
    return `${storeFilter}${filterParts}`;
  }
  return `${storeId ? `&storeId=eq.${storeId}` : ""}${filterParts}`;
}

/** Envia CSV com nome estavel e periodo no arquivo para auditoria operacional. */
function sendDeliveryReportCsv(reply: FastifyReply, csv: string, period: { date?: string; startsAt?: string; endsAt?: string }) {
  const filename = `farmadelivery-relatorio-${deliveryReportPeriodLabel(period).replace(/[^a-zA-Z0-9_-]+/g, "-")}.csv`;
  return reply
    .header("Content-Type", "text/csv; charset=utf-8")
    .header("Content-Disposition", `attachment; filename="${filename}"`)
    .send(csv);
}

/** Define o texto do periodo usado no nome do CSV e no contexto do relatorio. */
function deliveryReportPeriodLabel(period: { date?: string; startsAt?: string; endsAt?: string }) {
  if (period.startsAt && period.endsAt && period.startsAt !== period.endsAt) {
    return `${period.startsAt}_a_${period.endsAt}`;
  }
  return period.date ?? period.startsAt ?? period.endsAt ?? "periodo";
}

/** Descreve o escopo exportado sem depender de dados sensiveis da sessao. */
function deliveryReportScopeLabel(session: { role: string }, storeId?: string) {
  if (storeId) return `loja:${storeId}`;
  return isStoreLoginRole(session.role) ? "lojas_permitidas" : "todas_as_lojas";
}

/** Mantem limite padrao seguro para exportacao server-side. */
export function deliveryReportExportLimit(value: number | undefined) {
  return value ?? 5000;
}

/** Converte filtros de data em intervalo aberto no fim do dia para consultar timestamps. */
function reportDateRange(period: { date?: string; startsAt?: string; endsAt?: string }) {
  const startsAt = period.startsAt ?? period.date;
  const endsAt = period.endsAt ?? period.date ?? period.startsAt;
  if (!startsAt && !endsAt) return null;

  const start = startsAt ? startOfDate(startsAt) : new Date(0);
  const end = endsAt ? nextDateStart(endsAt) : new Date(8_640_000_000_000_000);
  return {
    gte: start,
    lt: end,
  };
}

/** Converte yyyy-mm-dd para inicio do dia local usado pelo Prisma. */
function startOfDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/** Calcula o inicio do dia seguinte para fazer filtro menor que o fim aberto. */
function nextDateStart(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day + 1);
}

/** Valida se o login de loja pode gravar na unidade escolhida para a entrega. */
async function resolveWritableStoreId(
  session: { sub: string; role: string; storeId?: string | null },
  requestedStoreId: string,
  reply: FastifyReply,
) {
  if (!isStoreLoginRole(session.role)) return requestedStoreId;

  const storeScope = await resolveUserStoreScope(session);
  if (hasStoreAccess(storeScope, requestedStoreId)) return requestedStoreId;

  reply.status(403).send({
    error: "FORBIDDEN",
    message: "Usuario de loja so pode criar entregas em unidade vinculada ou alocada.",
  });
  return null;
}

/** Garante que motoboy so altere entregas ja aceitas por ele. */
async function canMotoboyOperateDelivery(
  session: { role: string; courierId?: string | null },
  deliveryId: string,
  reply: FastifyReply,
) {
  if (session.role !== "MOTOBOY") return true;
  if (!session.courierId) {
    reply.status(403).send({
      error: "FORBIDDEN",
      message: "Motoboy sem cadastro operacional vinculado.",
    });
    return false;
  }

  const delivery = await loadDeliveryAccess(deliveryId, reply);
  if (!delivery) return false;

  if (delivery?.courierId !== session.courierId) {
    reply.status(403).send({
      error: "FORBIDDEN",
      message: "Motoboy so pode alterar entregas aceitas por ele.",
    });
    return false;
  }

  return true;
}

/** Garante que usuario de loja so altere entrega de loja vinculada ou alocada. */
async function canStoreUserOperateDelivery(
  session: { sub: string; role: string; storeId?: string | null },
  deliveryId: string,
  reply: FastifyReply,
) {
  if (!isStoreLoginRole(session.role)) return true;
  const storeScope = await resolveUserStoreScope(session);
  if (!storeScope?.length) {
    reply.status(403).send({
      error: "FORBIDDEN",
      message: "Usuario de loja sem unidade vinculada ou alocada.",
    });
    return false;
  }

  const delivery = await loadDeliveryAccess(deliveryId, reply);
  if (!delivery) return false;

  if (!storeScope.includes(delivery.storeId)) {
    reply.status(403).send({
      error: "FORBIDDEN",
      message: "Usuario de loja so pode alterar entregas de unidade vinculada ou alocada.",
    });
    return false;
  }

  return true;
}

/** Centraliza permissao de leitura de entrega para admin, loja e motoboy. */
async function canViewDelivery(
  session: { sub: string; role: string; storeId?: string | null; courierId?: string | null },
  deliveryId: string,
  reply: FastifyReply,
) {
  if (session.role === "ADMIN") return true;

  const delivery = await loadDeliveryAccess(deliveryId, reply);
  if (!delivery) return false;

  if (!delivery) {
    reply.status(404).send({
      error: "DELIVERY_NOT_FOUND",
      message: "Entrega nao encontrada.",
    });
    return false;
  }

  if (isStoreLoginRole(session.role)) {
    const storeScope = await resolveUserStoreScope(session);
    if (storeScope?.includes(delivery.storeId)) return true;
  }
  if (
    session.role === "MOTOBOY" &&
    (session.courierId === delivery.courierId ||
      (delivery.status === "AGUARDANDO_MOTOBOY" &&
        (await resolveCourierAvailability(session)) &&
        (await resolveCourierStoreScope(session))?.includes(delivery.storeId)))
  ) {
    return true;
  }

  reply.status(403).send({
    error: "FORBIDDEN",
    message: "Seu usuario nao tem permissao para ver esta entrega.",
  });
  return false;
}

/** Consulta disponibilidade atual do motoboy antes de liberar fila ou aceite. */
async function resolveCourierAvailability(session: { role: string; courierId?: string | null }) {
  if (session.role !== "MOTOBOY" || !session.courierId) return true;

  try {
    const courier = await prisma.courier.findUnique({
      where: { id: session.courierId },
      select: { available: true },
    });
    return courier?.available == true;
  } catch (error) {
    if (!canUseSupabaseRest()) throw error;
  }

  const couriers = await supabaseRest<Array<{ available: boolean }>>("Courier", {
    query: `select=available&id=eq.${session.courierId}`,
  });
  return couriers[0]?.available == true;
}

/** Carrega o minimo necessario para validar permissao sobre uma entrega. */
async function loadDeliveryAccess(deliveryId: string, reply: FastifyReply) {
  try {
    const delivery = await prisma.delivery.findUnique({
      where: { id: deliveryId },
      select: {
        storeId: true,
        courierId: true,
        status: true,
      },
    });

    if (!delivery) {
      reply.status(404).send({
        error: "DELIVERY_NOT_FOUND",
        message: "Entrega nao encontrada.",
      });
      return null;
    }

    return delivery;
  } catch {
    if (canUseSupabaseRest()) {
      const deliveries = await supabaseRest<Array<{ storeId: string; courierId: string | null; status: string }>>(
        "Delivery",
        {
          query: `select=storeId,courierId,status&id=eq.${deliveryId}&limit=1`,
        },
      );
      const delivery = deliveries[0];
      if (!delivery) {
        reply.status(404).send({
          error: "DELIVERY_NOT_FOUND",
          message: "Entrega nao encontrada.",
        });
        return null;
      }
      return delivery;
    }

    reply.status(503).send({
      error: "DATABASE_UNAVAILABLE",
      message: "Nao foi possivel validar permissao da entrega.",
    });
    return null;
  }
}

/** Cria a parada da entrega na rota aberta do motoboy sem duplicar parada existente. */
async function attachDeliveryToCourierRoute(
  tx: Prisma.TransactionClient,
  delivery: {
    id: string;
    courierId: string | null;
    customerAddress: {
      street: string;
      number: string;
      complement: string | null;
      neighborhood: string | null;
      latitude: unknown;
      longitude: unknown;
    };
    earliestDispatchAt: Date | null;
  },
) {
  if (!delivery.courierId) return;

  const route =
    (await tx.courierRoute.findFirst({
      where: {
        courierId: delivery.courierId,
        status: {
          in: ["ABERTA", "EM_ANDAMENTO"],
        },
      },
      orderBy: { createdAt: "desc" },
    })) ??
    (await tx.courierRoute.create({
      data: {
        courierId: delivery.courierId,
        status: "ABERTA",
      },
    }));

  const existingStop = await tx.routeStop.findFirst({
    where: {
      routeId: route.id,
      deliveryId: delivery.id,
    },
  });
  if (existingStop) return;

  const lastStop = await tx.routeStop.findFirst({
    where: { routeId: route.id },
    orderBy: { sequence: "desc" },
  });

  await tx.routeStop.create({
    data: {
      routeId: route.id,
      deliveryId: delivery.id,
      type: "ENTREGA",
      sequence: (lastStop?.sequence ?? 0) + 1,
      address: formatAddress(delivery.customerAddress),
      latitude: delivery.customerAddress.latitude ? Number(delivery.customerAddress.latitude) : undefined,
      longitude: delivery.customerAddress.longitude ? Number(delivery.customerAddress.longitude) : undefined,
      earliestAt: delivery.earliestDispatchAt ?? undefined,
    },
  });
}

/** Sincroniza parada e rota quando a entrega sai para rota, e concluida ou vira problema. */
async function syncRouteForDeliveryTransition(deliveryId: string, status: DeliveryStatusValue) {
  if (status === "EM_ROTA") {
    const delivery = await prisma.delivery.findUnique({
      where: { id: deliveryId },
      select: { courierId: true },
    });
    if (delivery?.courierId) {
      await prisma.courierRoute.updateMany({
        where: {
          courierId: delivery.courierId,
          status: "ABERTA",
        },
        data: {
          status: "EM_ANDAMENTO",
          startedAt: new Date(),
          recalculatedAt: new Date(),
        },
      });
    }
  }

  if (status === "ENTREGUE") {
    await prisma.routeStop.updateMany({
      where: {
        deliveryId,
        status: "PENDENTE",
      },
      data: {
        status: "CONCLUIDA",
        completedAt: new Date(),
      },
    });
    await finishRoutesWithoutPendingStops(deliveryId);
  }

  if (status === "PROBLEMA") {
    await prisma.routeStop.updateMany({
      where: {
        deliveryId,
        status: "PENDENTE",
      },
      data: {
        status: "PULADA",
      },
    });
  }
}

/** Finaliza rotas que ficaram sem nenhuma parada pendente apos a entrega ser concluida. */
async function finishRoutesWithoutPendingStops(deliveryId: string) {
  const stops = await prisma.routeStop.findMany({
    where: { deliveryId },
    select: { routeId: true },
  });
  const routeIds = [...new Set(stops.map((stop) => stop.routeId))];

  await Promise.all(
    routeIds.map(async (routeId) => {
      const pendingCount = await prisma.routeStop.count({
        where: {
          routeId,
          status: "PENDENTE",
        },
      });
      if (pendingCount === 0) {
        await prisma.courierRoute.update({
          where: { id: routeId },
          data: {
            status: "FINALIZADA",
            finishedAt: new Date(),
          },
        });
      }
    }),
  );
}

/** Aplica transicao operacional da entrega e grava evento auditavel no mesmo fluxo. */
async function transitionDelivery({
  app,
  reply,
  deliveryId,
  status,
  eventType,
  notes,
  metadata,
  timestamps,
  actorUserId,
}: {
  app: FastifyInstance;
  reply: FastifyReply;
  deliveryId: string;
  status: DeliveryStatusValue;
  eventType: DeliveryEventValue;
  notes: string;
  metadata?: Record<string, unknown>;
  timestamps: {
    collectedAt?: Date;
    deliveredAt?: Date;
  };
  actorUserId?: string;
}) {
  try {
    const result = await prisma.delivery.update({
      where: { id: deliveryId },
      data: {
        status,
        ...timestamps,
        events: {
          create: {
            type: eventType,
            notes,
            actorUserId,
            metadata: metadata ? (metadata as Prisma.InputJsonObject) : undefined,
          },
        },
      },
      include: {
        routeStops: true,
        courier: {
          include: {
            user: true,
          },
        },
        events: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    await syncRouteForDeliveryTransition(result.id, status);

    return reply.send(formatDeliveryMutationResponse(result));
  } catch (error) {
    app.log.error({ error }, "delivery transition error");
    if (canUseSupabaseRest()) {
      try {
        const result = await updateDeliveryStatusWithSupabaseRest({
          deliveryId,
          status,
          eventType,
          notes,
          metadata,
          actorUserId,
          timestamps: Object.fromEntries(
            Object.entries(timestamps).map(([key, value]) => [key, value?.toISOString()]),
          ),
        });
        await syncRouteForDeliveryTransitionWithSupabaseRest(deliveryId, status);
        return reply.send(result);
      } catch (restError) {
        app.log.error({ error: restError }, "delivery transition supabase rest error");
      }
    }

    return reply.status(503).send({
      error: "DATABASE_UNAVAILABLE",
      message: "Nao foi possivel atualizar a entrega.",
    });
  }
}

/** Salva comprovante fotografico opcional validando tamanho, tipo real e hash do arquivo. */
async function saveDeliveryProof({
  deliveryId,
  actorUserId,
  fileName,
  mimeType,
  contentBase64,
}: {
  deliveryId: string;
  actorUserId?: string;
  fileName: string;
  mimeType: string;
  contentBase64: string;
}) {
  const bytes = Buffer.from(contentBase64, "base64");
  if (bytes.length === 0 || bytes.length > DELIVERY_PROOF_MAX_BYTES) {
    throw new Error("Delivery proof must be between 1 byte and 4 MB.");
  }
  const detectedMimeType = detectImageMimeType(bytes);
  if (!detectedMimeType || detectedMimeType !== mimeType) {
    throw new Error("Delivery proof content does not match the declared image type.");
  }

  const extension = extensionForImageMimeType(detectedMimeType);
  const proofId = randomUUID();
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/\.(jpg|jpeg|png|webp)$/i, "").slice(0, 80);
  const storageDirectory = path.join(resolveDeliveryProofStorageRoot(), deliveryId);
  const storedFileName = `${proofId}-${safeName || "proof"}.${extension}`;
  const storagePath = path.join(storageDirectory, storedFileName);

  await mkdir(storageDirectory, { recursive: true });
  await writeFile(storagePath, bytes);

  const proofData = {
    id: proofId,
    deliveryId,
    actorUserId,
    fileName,
    mimeType: detectedMimeType,
    storagePath,
    sizeBytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };

  try {
    const proof = await prisma.deliveryProof.create({
      data: proofData,
    });

    return {
      id: proof.id,
      deliveryId: proof.deliveryId,
      fileName: proof.fileName,
      mimeType: proof.mimeType,
      sizeBytes: proof.sizeBytes,
      sha256: proof.sha256,
      createdAt: proof.createdAt.toISOString(),
    };
  } catch (error) {
    try {
      if (!canUseSupabaseRest()) throw error;
      const proofs = await supabaseRest<
        Array<{
          id: string;
          deliveryId: string;
          fileName: string;
          mimeType: string;
          sizeBytes: number;
          sha256: string;
          createdAt: string;
        }>
      >("DeliveryProof", {
        method: "POST",
        body: proofData,
        query: "select=*",
      });
      const proof = proofs[0];
      if (!proof) throw new Error("Delivery proof was not returned by Supabase REST.");
      return proof;
    } catch (databaseError) {
      await removeFileIfExists(storagePath);
      throw databaseError;
    }
  }
}

/** Remove arquivo fisico quando o banco falha depois de gravar o comprovante no disco. */
async function removeFileIfExists(filePath: string) {
  try {
    await unlink(filePath);
  } catch {
    // Best-effort cleanup: the caller should still receive the original database error.
  }
}

/** Detecta o tipo real da imagem pelo cabecalho do arquivo, nao apenas pelo mime enviado. */
export function detectImageMimeType(bytes: Buffer) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
    bytes.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

/** Define a extensao persistida de acordo com o mime validado. */
export function extensionForImageMimeType(mimeType: string) {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}

/** Limpa nome de arquivo para header de download sem quebra de linha ou caminho. */
export function sanitizeDownloadFileName(fileName: string) {
  const sanitized = fileName
    .replace(/[\r\n"]/g, "")
    .replace(/[\\/]/g, "_")
    .replace(/[^\w ._-]/g, "_")
    .trim()
    .slice(0, 120);

  return sanitized || "delivery-proof.jpg";
}

/** Busca metadados do comprovante antes de liberar download autenticado. */
async function resolveDeliveryProofMetadata(deliveryId: string, proofId: string, reply: FastifyReply) {
  try {
    const proof = await prisma.deliveryProof.findFirst({
      where: {
        id: proofId,
        deliveryId,
      },
      select: {
        id: true,
        fileName: true,
        mimeType: true,
        sizeBytes: true,
        sha256: true,
      },
    });
    if (proof) {
      return { deliveryProof: proof };
    }
  } catch {
    if (canUseSupabaseRest()) {
      const proofs = await supabaseRest<
        Array<{
          id: string;
          fileName: string;
          mimeType: string;
          sizeBytes: number;
          sha256: string;
        }>
      >("DeliveryProof", {
        query: `select=id,fileName,mimeType,sizeBytes,sha256&id=eq.${proofId}&deliveryId=eq.${deliveryId}&limit=1`,
      });
      const proof = proofs[0];
      if (proof) {
        return { deliveryProof: proof };
      }
    }
  }

  reply.status(404).send({
    error: "DELIVERY_PROOF_NOT_FOUND",
    message: "Comprovante nao encontrado para esta entrega.",
  });
  return undefined;
}

/** Normaliza comprovante para resposta da API sem expor caminho interno do arquivo. */
function formatDeliveryProof(proof: {
  id: string;
  deliveryId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  actorUser?: {
    id: string;
    name: string;
    role: string;
  } | null;
  createdAt: Date;
}) {
  return {
    id: proof.id,
    deliveryId: proof.deliveryId,
    fileName: proof.fileName,
    mimeType: proof.mimeType,
    sizeBytes: proof.sizeBytes,
    sha256: proof.sha256,
    actor: proof.actorUser ?? null,
    createdAt: proof.createdAt.toISOString(),
  };
}

/** Monta endereco em uma unica linha para cards, mapas e paradas de rota. */
function formatAddress(address: {
  street: string;
  number: string;
  complement?: string | null;
  neighborhood?: string | null;
}) {
  return [address.street, address.number, address.complement, address.neighborhood].filter(Boolean).join(", ");
}

/** Normaliza endereco de cliente para o contrato do painel e do app motoboy. */
function formatCustomerAddress(address: {
  id: string;
  customerId: string;
  street: string;
  number: string;
  complement: string | null;
  neighborhood: string | null;
  reference: string | null;
  latitude: unknown;
  longitude: unknown;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: address.id,
    customerId: address.customerId,
    street: address.street,
    number: address.number,
    complement: address.complement,
    neighborhood: address.neighborhood,
    reference: address.reference,
    latitude: address.latitude ? Number(address.latitude) : null,
    longitude: address.longitude ? Number(address.longitude) : null,
    active: address.active,
    createdAt: address.createdAt.toISOString(),
    updatedAt: address.updatedAt.toISOString(),
  };
}

/** Normaliza a entrega recem-criada incluindo loja, cliente, endereco e eventos iniciais. */
function formatCreatedDelivery(delivery: {
  id: string;
  publicCode: string;
  storeDailyDate: Date;
  storeDailyNumber: number;
  status: string;
  priority: string;
  deadlineTier: string;
  createdAt: Date;
  earliestDispatchAt: Date | null;
  store: {
    id: string;
    name: string;
  };
  customer: {
    id: string;
    name: string;
    phone: string;
  };
  customerAddress: {
    id: string;
    street: string;
    number: string;
    complement: string | null;
  };
  events: Array<{
    id: string;
    type: string;
    createdAt: Date;
  }>;
}) {
  return {
    id: delivery.id,
    publicCode: delivery.publicCode,
    storeDailyDate: delivery.storeDailyDate.toISOString().slice(0, 10),
    storeDailyNumber: delivery.storeDailyNumber,
    status: delivery.status,
    priority: delivery.priority,
    deadlineTier: delivery.deadlineTier,
    createdAt: delivery.createdAt.toISOString(),
    earliestDispatchAt: delivery.earliestDispatchAt?.toISOString() ?? null,
    store: {
      id: delivery.store.id,
      name: delivery.store.name,
    },
    customer: {
      id: delivery.customer.id,
      name: delivery.customer.name,
      phone: delivery.customer.phone,
    },
    address: {
      id: delivery.customerAddress.id,
      street: delivery.customerAddress.street,
      number: delivery.customerAddress.number,
      complement: delivery.customerAddress.complement,
    },
    events: delivery.events.map((event) => ({
      id: event.id,
      type: event.type,
      createdAt: event.createdAt.toISOString(),
    })),
  };
}

/** Exige ator nos eventos do fallback REST para manter auditoria sem evento anonimo. */
export function requireOperationalActorId(actorUserId?: string) {
  if (!actorUserId) {
    throw new Error("Operational delivery events require actorUserId in Supabase REST fallback.");
  }
  return actorUserId;
}

/** Reserva o proximo numero diario da loja dentro da mesma transacao da criacao da entrega. */
async function allocateStoreDailyDeliveryCode(tx: Prisma.TransactionClient, storeId: string, now = new Date()) {
  const sequenceDate = resolveDeliverySequenceDate(now);
  const store = await tx.store.findUniqueOrThrow({
    where: { id: storeId },
    select: { code: true },
  });
  const counter = await tx.deliveryDailySequence.upsert({
    where: {
      storeId_sequenceDate: {
        storeId,
        sequenceDate: sequenceDate.date,
      },
    },
    create: {
      storeId,
      sequenceDate: sequenceDate.date,
      lastNumber: 1,
    },
    update: {
      lastNumber: {
        increment: 1,
      },
    },
  });

  return {
    createdAt: now,
    storeDailyDate: sequenceDate.date,
    storeDailyNumber: counter.lastNumber,
    publicCode: buildDeliveryPublicCode(store.code, sequenceDate.key, counter.lastNumber),
  };
}

/** Fallback REST: calcula o proximo numero pela ultima entrega do dia quando Prisma estiver indisponivel. */
async function allocateStoreDailyDeliveryCodeWithSupabaseRest(storeId: string, now = new Date()) {
  const sequenceDate = resolveDeliverySequenceDate(now);
  const [stores, deliveries] = await Promise.all([
    supabaseRest<SupabaseStore[]>("Store", {
      query: `select=id,code&id=eq.${storeId}&limit=1`,
    }),
    supabaseRest<Array<{ storeDailyNumber: number | null }>>("Delivery", {
      query: `select=storeDailyNumber&storeId=eq.${storeId}&storeDailyDate=eq.${sequenceDate.key}&order=storeDailyNumber.desc&limit=1`,
    }),
  ]);
  const storeCode = stores[0]?.code ?? "LOJA";
  const storeDailyNumber = Number(deliveries[0]?.storeDailyNumber ?? 0) + 1;

  return {
    createdAt: now.toISOString(),
    storeDailyDate: sequenceDate.key,
    storeDailyNumber,
    publicCode: buildDeliveryPublicCode(storeCode, sequenceDate.key, storeDailyNumber),
  };
}

/** Cria entrega por IDs existentes usando Supabase REST quando Prisma nao estiver disponivel. */
async function createDeliveryFromExistingRecordsWithSupabaseRest(
  data: typeof createDeliverySchema._output,
  actorUserId?: string,
) {
  const operationalActorId = requireOperationalActorId(actorUserId);
  const numbering = await allocateStoreDailyDeliveryCodeWithSupabaseRest(data.storeId);
  const deliveries = await supabaseRest<SupabaseDelivery[]>("Delivery", {
    method: "POST",
    prefer: "return=representation",
    body: {
      publicCode: numbering.publicCode,
      storeDailyDate: numbering.storeDailyDate,
      storeDailyNumber: numbering.storeDailyNumber,
      storeId: data.storeId,
      customerId: data.customerId,
      customerAddressId: data.customerAddressId,
      priority: data.priority,
      deadlineTier: data.deadlineTier,
      notes: data.notes,
      createdAt: numbering.createdAt,
      earliestDispatchAt: data.earliestDispatchAt,
    },
  });
  const delivery = deliveries[0];
  if (!delivery) throw new Error("Delivery was not returned by Supabase REST.");

  const events = await supabaseRest<SupabaseDeliveryEvent[]>("DeliveryEvent", {
    method: "POST",
    prefer: "return=representation",
    body: [
      {
        deliveryId: delivery.id,
        type: "CRIADA",
        notes: "Entrega criada pelo painel web com endereco cadastrado.",
        actorUserId: operationalActorId,
      },
      ...(data.earliestDispatchAt
        ? [
            {
              deliveryId: delivery.id,
              type: "AGENDADA",
              notes: `Despacho permitido a partir de ${data.earliestDispatchAt}.`,
              actorUserId: operationalActorId,
            },
          ]
        : []),
    ],
  });

  return {
    id: delivery.id,
    publicCode: delivery.publicCode,
    storeDailyDate: delivery.storeDailyDate ?? numbering.storeDailyDate,
    storeDailyNumber: delivery.storeDailyNumber ?? numbering.storeDailyNumber,
    status: delivery.status,
    priority: delivery.priority,
    deadlineTier: delivery.deadlineTier ?? data.deadlineTier,
    createdAt: delivery.createdAt,
    earliestDispatchAt: delivery.earliestDispatchAt,
    store: {
      id: delivery.storeId,
    },
    customer: {
      id: delivery.customerId,
    },
    address: {
      id: delivery.customerAddressId,
    },
    events: events.map((event) => ({
      id: event.id,
      type: event.type,
      createdAt: event.createdAt,
    })),
    source: "supabase-rest",
  };
}

async function createDeliveryWithSupabaseRest(data: typeof createDeliveryWithCustomerSchema._output, actorUserId?: string) {
  const operationalActorId = requireOperationalActorId(actorUserId);
  const targetStoreId = data.redirectStoreId ?? data.storeId;
  const redirectedFromStoreId = data.redirectStoreId && data.redirectStoreId !== data.storeId ? data.storeId : undefined;
  const customers = await supabaseRest<SupabaseCustomer[]>("Customer", {
    method: "POST",
    query: "on_conflict=phone",
    prefer: "resolution=merge-duplicates,return=representation",
    body: {
      name: data.customerName,
      phone: data.phone,
    },
  });
  const customer = customers[0];
  if (!customer) throw new Error("Customer was not returned by Supabase REST.");

  const addresses = data.customerAddressId
    ? await supabaseRest<SupabaseCustomerAddress[]>("CustomerAddress", {
        query: `select=*&id=eq.${data.customerAddressId}&customerId=eq.${customer.id}&active=eq.true`,
      })
    : await supabaseRest<SupabaseCustomerAddress[]>("CustomerAddress", {
        method: "POST",
        prefer: "return=representation",
        body: {
          customerId: customer.id,
          street: data.street,
          number: data.number,
          complement: data.complement,
          neighborhood: data.neighborhood,
          reference: data.reference,
          latitude: data.coordinates?.latitude,
          longitude: data.coordinates?.longitude,
        },
      });
  const address = addresses[0];
  if (!address) throw new Error("CustomerAddress was not returned by Supabase REST.");
  if (data.customerAddressId && data.coordinates) {
    await supabaseRest("CustomerAddress", {
      method: "PATCH",
      query: `id=eq.${data.customerAddressId}`,
      body: {
        latitude: data.coordinates.latitude,
        longitude: data.coordinates.longitude,
        updatedAt: new Date().toISOString(),
      },
    });
    address.latitude = data.coordinates.latitude;
    address.longitude = data.coordinates.longitude;
  }

  const numbering = await allocateStoreDailyDeliveryCodeWithSupabaseRest(targetStoreId);
  const deliveries = await supabaseRest<SupabaseDelivery[]>("Delivery", {
    method: "POST",
    prefer: "return=representation",
    body: {
      publicCode: numbering.publicCode,
      storeDailyDate: numbering.storeDailyDate,
      storeDailyNumber: numbering.storeDailyNumber,
      storeId: targetStoreId,
      redirectedFromStoreId,
      customerId: customer.id,
      customerAddressId: address.id,
      priority: data.priority,
      deadlineTier: data.deadlineTier,
      notes: data.notes,
      createdAt: numbering.createdAt,
      earliestDispatchAt: data.earliestDispatchAt,
    },
  });
  const delivery = deliveries[0];
  if (!delivery) throw new Error("Delivery was not returned by Supabase REST.");

  const eventBody = [
    {
      deliveryId: delivery.id,
      type: "CRIADA",
      notes: deliveryCreationNotes({
        hasCoordinates: Boolean(data.coordinates),
        attendantName: data.attendantName,
      }),
      actorUserId: operationalActorId,
      metadata: data.attendantName
        ? {
            attendantName: data.attendantName,
          }
        : undefined,
    },
    ...(data.earliestDispatchAt
      ? [
          {
            deliveryId: delivery.id,
            type: "AGENDADA",
            notes: `Despacho permitido a partir de ${data.earliestDispatchAt}.`,
            actorUserId: operationalActorId,
          },
        ]
      : []),
    ...(redirectedFromStoreId
      ? [
          {
            deliveryId: delivery.id,
            type: "REDIRECIONADA",
            notes: "Entrega redirecionada manualmente no painel web.",
            actorUserId: operationalActorId,
            metadata: {
              fromStoreId: redirectedFromStoreId,
              toStoreId: targetStoreId,
            },
          },
        ]
      : []),
  ];

  const events = await supabaseRest<SupabaseDeliveryEvent[]>("DeliveryEvent", {
    method: "POST",
    prefer: "return=representation",
    body: eventBody,
  });

  const stores = await supabaseRest<SupabaseStore[]>("Store", {
    query: `select=id,name&id=eq.${targetStoreId}`,
  });
  const store = stores[0];

  return {
    id: delivery.id,
    publicCode: delivery.publicCode,
    status: delivery.status,
    priority: delivery.priority,
    deadlineTier: delivery.deadlineTier ?? data.deadlineTier,
    createdAt: delivery.createdAt,
    earliestDispatchAt: delivery.earliestDispatchAt,
    store: {
      id: store?.id ?? targetStoreId,
      name: store?.name ?? "Loja",
    },
    customer: {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
    },
    address: {
      id: address.id,
      street: address.street,
      number: address.number,
      complement: address.complement,
    },
    events: events.map((event) => ({
      id: event.id,
      type: event.type,
      createdAt: event.createdAt,
    })),
    source: "supabase-rest",
  };
}

async function updateDeliveryStatusWithSupabaseRest({
  deliveryId,
  status,
  eventType,
  notes,
  metadata,
  actorUserId,
  timestamps,
  courierId,
}: {
  deliveryId: string;
  status: DeliveryStatusValue;
  eventType: DeliveryEventValue;
  notes: string;
  metadata?: Record<string, unknown>;
  actorUserId?: string;
  timestamps: Record<string, string | undefined>;
  courierId?: string;
}) {
  const operationalActorId = requireOperationalActorId(actorUserId);
  const deliveries = await supabaseRest<SupabaseDelivery[]>("Delivery", {
    method: "PATCH",
    query: `id=eq.${deliveryId}`,
    prefer: "return=representation",
    body: {
      status,
      courierId,
      ...timestamps,
    },
  });
  const delivery = deliveries[0];
  if (!delivery) throw new Error("Delivery was not returned by Supabase REST.");

  const events = await supabaseRest<SupabaseDeliveryEvent[]>("DeliveryEvent", {
    method: "POST",
    prefer: "return=representation",
    body: {
      deliveryId,
      type: eventType,
      notes,
      actorUserId: operationalActorId,
      metadata,
    },
  });
  const event = events[0];

  return {
    id: delivery.id,
    publicCode: delivery.publicCode,
    storeDailyDate: delivery.storeDailyDate ?? null,
    storeDailyNumber: delivery.storeDailyNumber ?? null,
    status: delivery.status,
    courierId: delivery.courierId ?? null,
    acceptedAt: delivery.acceptedAt ?? null,
    collectedAt: delivery.collectedAt ?? null,
    deliveredAt: delivery.deliveredAt ?? null,
    canceledAt: delivery.canceledAt ?? null,
    event: event
      ? {
          id: event.id,
          type: event.type,
          notes: event.notes,
          createdAt: event.createdAt,
        }
      : null,
    source: "supabase-rest",
  };
}

async function attachDeliveryToCourierRouteWithSupabaseRest(courierId: string, deliveryId: string) {
  const routes = await supabaseRest<Array<{ id: string; courierId: string; status: string; createdAt: string }>>(
    "CourierRoute",
    {
      query: `select=*&courierId=eq.${courierId}&status=in.(ABERTA,EM_ANDAMENTO)&order=createdAt.desc&limit=1`,
    },
  );
  const route =
    routes[0] ??
    (
      await supabaseRest<Array<{ id: string; courierId: string; status: string }>>("CourierRoute", {
        method: "POST",
        prefer: "return=representation",
        body: {
          courierId,
          status: "ABERTA",
        },
      })
    )[0];
  if (!route) throw new Error("CourierRoute was not returned by Supabase REST.");

  const existingStops = await supabaseRest<Array<{ id: string }>>("RouteStop", {
    query: `select=id&routeId=eq.${route.id}&deliveryId=eq.${deliveryId}&limit=1`,
  });
  if (existingStops[0]) return;

  const deliveries = await supabaseRest<
    Array<
      SupabaseDelivery & {
        CustomerAddress?: SupabaseCustomerAddress | null;
      }
    >
  >("Delivery", {
    query: `select=*,CustomerAddress(*)&id=eq.${deliveryId}`,
  });
  const delivery = deliveries[0];
  if (!delivery?.CustomerAddress) return;

  const lastStops = await supabaseRest<Array<{ sequence: number }>>("RouteStop", {
    query: `select=sequence&routeId=eq.${route.id}&order=sequence.desc&limit=1`,
  });

  await supabaseRest("RouteStop", {
    method: "POST",
    prefer: "return=representation",
    body: {
      routeId: route.id,
      deliveryId,
      type: "ENTREGA",
      sequence: (lastStops[0]?.sequence ?? 0) + 1,
      address: formatAddress({
        street: delivery.CustomerAddress.street,
        number: delivery.CustomerAddress.number,
        complement: delivery.CustomerAddress.complement,
        neighborhood: delivery.CustomerAddress.neighborhood,
      }),
      latitude: delivery.CustomerAddress.latitude,
      longitude: delivery.CustomerAddress.longitude,
      earliestAt: delivery.earliestDispatchAt,
    },
  });
}

async function syncRouteForDeliveryTransitionWithSupabaseRest(deliveryId: string, status: DeliveryStatusValue) {
  if (status === "EM_ROTA") {
    const deliveries = await supabaseRest<Array<Pick<SupabaseDelivery, "courierId">>>("Delivery", {
      query: `select=courierId&id=eq.${deliveryId}`,
    });
    const courierId = deliveries[0]?.courierId;
    if (courierId) {
      await supabaseRest("CourierRoute", {
        method: "PATCH",
        query: `courierId=eq.${courierId}&status=eq.ABERTA`,
        body: {
          status: "EM_ANDAMENTO",
          startedAt: new Date().toISOString(),
          recalculatedAt: new Date().toISOString(),
        },
      });
    }
  }

  if (status === "ENTREGUE") {
    await supabaseRest("RouteStop", {
      method: "PATCH",
      query: `deliveryId=eq.${deliveryId}&status=eq.PENDENTE`,
      body: {
        status: "CONCLUIDA",
        completedAt: new Date().toISOString(),
      },
    });
  }

  if (status === "PROBLEMA") {
    await supabaseRest("RouteStop", {
      method: "PATCH",
      query: `deliveryId=eq.${deliveryId}&status=eq.PENDENTE`,
      body: {
        status: "PULADA",
      },
    });
  }
}

async function cancelDeliveryWithSupabaseRest(data: typeof cancelDeliverySchema._output, actorUserId?: string) {
  const operationalActorId = requireOperationalActorId(actorUserId);
  const canceledAt = new Date().toISOString();
  const deliveries = await supabaseRest<SupabaseDelivery[]>("Delivery", {
    method: "PATCH",
    query: `id=eq.${data.deliveryId}`,
    prefer: "return=representation",
    body: {
      status: "CANCELADA",
      canceledAt,
    },
  });
  const delivery = deliveries[0];
  if (!delivery) throw new Error("Delivery was not returned by Supabase REST.");

  const events = await supabaseRest<SupabaseDeliveryEvent[]>("DeliveryEvent", {
    method: "POST",
    prefer: "return=representation",
    body: {
      deliveryId: delivery.id,
      type: "CANCELADA",
      notes: data.reason,
      actorUserId: operationalActorId,
      metadata: {
        notifyCourier: data.notifyCourier,
      },
    },
  });
  const event = events[0];

  await supabaseRest("RouteStop", {
    method: "PATCH",
    query: `deliveryId=eq.${delivery.id}&status=eq.PENDENTE`,
    body: {
      status: "CANCELADA",
    },
  });

  return {
    id: delivery.id,
    publicCode: delivery.publicCode,
    storeDailyDate: delivery.storeDailyDate ?? null,
    storeDailyNumber: delivery.storeDailyNumber ?? null,
    courierId: delivery.courierId ?? null,
    status: delivery.status,
    canceledAt: delivery.canceledAt ?? canceledAt,
    event: event
      ? {
          id: event.id,
          type: event.type,
          notes: event.notes,
          createdAt: event.createdAt,
        }
      : null,
    source: "supabase-rest",
  };
}

/** Notifica motoboys disponiveis somente quando a entrega ja pode ser despachada. */
async function notifyNewDeliveryIfDispatchable(data: {
  storeId: string;
  deliveryId: string;
  publicCode: string;
  earliestDispatchAt?: Date | string | null;
  log: FastifyBaseLogger;
}) {
  if (data.earliestDispatchAt && new Date(data.earliestDispatchAt).getTime() > Date.now()) {
    return {
      enabled: true,
      sent: 0,
      failed: 0,
      inactiveTokens: 0,
      reason: "SCHEDULED_FOR_LATER",
    };
  }

  if (!isCourierPushConfigured()) {
    return {
      enabled: false,
      sent: 0,
      failed: 0,
      inactiveTokens: 0,
      reason: "FIREBASE_ADMIN_NOT_CONFIGURED",
    };
  }

  try {
    if (await hasNewDeliveryNotificationEvent(data.deliveryId)) {
      return {
        enabled: true,
        sent: 0,
        failed: 0,
        inactiveTokens: 0,
        reason: "ALREADY_NOTIFIED",
      };
    }

    const courierIds = await listAvailableCourierIdsForStore(data.storeId);
    if (courierIds.length === 0) {
      return {
        enabled: true,
        sent: 0,
        failed: 0,
        inactiveTokens: 0,
        reason: "NO_AVAILABLE_COURIERS_FOR_STORE",
      };
    }

    const results = await Promise.all(
      courierIds.map((courierId) =>
        sendCourierPushNotification({
          courierId,
          type: "NEW_DELIVERY_AVAILABLE",
          title: "Nova entrega disponivel",
          body: `Entrega ${data.publicCode} aguardando aceite.`,
          data: {
            deliveryId: data.deliveryId,
            publicCode: data.publicCode,
            storeId: data.storeId,
          },
          log: data.log,
        }),
      ),
    );

    const notification = aggregateNotificationResults(results, courierIds.length);
    if (notification.sent > 0) {
      await recordNewDeliveryNotificationEvent(data.deliveryId, notification);
    }

    return notification;
  } catch (error) {
    data.log.error(
      {
        error,
        delivery_id: data.deliveryId,
        store_id: data.storeId,
      },
      "new delivery push notification failed",
    );
    return {
      enabled: true,
      sent: 0,
      failed: 1,
      inactiveTokens: 0,
      reason: "SEND_FAILED",
    };
  }
}

/** Inicia o worker interno que libera notificacoes de entregas agendadas no horario certo. */
function startScheduledDeliveryNotificationScheduler(log: FastifyBaseLogger) {
  const enabled = process.env.SCHEDULED_DELIVERY_NOTIFICATION_WORKER !== "false";
  if (!enabled) return () => undefined;
  if (!isCourierPushConfigured()) return () => undefined;

  const intervalMs = Math.max(Number(process.env.SCHEDULED_DELIVERY_NOTIFICATION_INTERVAL_MS ?? 60_000), 15_000);
  let running = false;

  const run = async () => {
    if (running) return;
    running = true;
    try {
      await processScheduledDeliveryNotifications(log);
    } catch (error) {
      log.error({ error }, "scheduled delivery notification worker failed");
    } finally {
      running = false;
    }
  };

  const timer = setInterval(run, intervalMs);
  timer.unref?.();
  void run();

  return () => clearInterval(timer);
}

/** Processa um lote pequeno de entregas agendadas que acabaram de ficar disponiveis. */
async function processScheduledDeliveryNotifications(log: FastifyBaseLogger) {
  const now = new Date();
  const deliveries = await listScheduledDeliveriesForNotification(now);

  for (const delivery of deliveries) {
    await notifyNewDeliveryIfDispatchable({
      storeId: delivery.storeId,
      deliveryId: delivery.id,
      publicCode: delivery.publicCode,
      earliestDispatchAt: delivery.earliestDispatchAt,
      log,
    });
  }
}

/** Lista entregas agendadas ainda nao notificadas, com fallback REST quando necessario. */
async function listScheduledDeliveriesForNotification(now: Date) {
  try {
    return await prisma.delivery.findMany({
      where: {
        status: "AGUARDANDO_MOTOBOY",
        earliestDispatchAt: {
          not: null,
          lte: now,
        },
        events: {
          none: {
            type: "NOTIFICACAO_ENVIADA",
          },
        },
      },
      select: {
        id: true,
        publicCode: true,
        storeId: true,
        earliestDispatchAt: true,
      },
      orderBy: {
        earliestDispatchAt: "asc",
      },
      take: 20,
    });
  } catch (error) {
    if (!canUseSupabaseRest()) throw error;
  }

  const candidates = await supabaseRest<
    Array<{ id: string; publicCode: string; storeId: string; earliestDispatchAt: string | null }>
  >("Delivery", {
    query: `select=id,publicCode,storeId,earliestDispatchAt&status=eq.AGUARDANDO_MOTOBOY&earliestDispatchAt=lte.${now.toISOString()}&earliestDispatchAt=not.is.null&order=earliestDispatchAt.asc&limit=20`,
  });
  const alreadyNotified = await listNotifiedDeliveryIds(candidates.map((delivery) => delivery.id));
  return candidates
    .filter((delivery) => !alreadyNotified.has(delivery.id))
    .map((delivery) => ({
      ...delivery,
      earliestDispatchAt: delivery.earliestDispatchAt ? new Date(delivery.earliestDispatchAt) : null,
    }));
}

/** Busca IDs ja auditados para evitar disparo duplicado no fallback REST. */
async function listNotifiedDeliveryIds(deliveryIds: string[]) {
  if (deliveryIds.length === 0) return new Set<string>();
  const events = await supabaseRest<Array<{ deliveryId: string }>>("DeliveryEvent", {
    query: `select=deliveryId&type=eq.NOTIFICACAO_ENVIADA&deliveryId=in.(${deliveryIds.join(",")})`,
  });
  return new Set(events.map((event) => event.deliveryId));
}

/** Confere se a entrega ja tem evento de notificacao enviada antes de disparar push. */
async function hasNewDeliveryNotificationEvent(deliveryId: string) {
  try {
    const existingEvent = await prisma.deliveryEvent.findFirst({
      where: {
        deliveryId,
        type: "NOTIFICACAO_ENVIADA",
      },
      select: {
        id: true,
      },
    });
    return Boolean(existingEvent);
  } catch (error) {
    if (!canUseSupabaseRest()) throw error;
  }

  const events = await supabaseRest<Array<{ id: string }>>("DeliveryEvent", {
    query: `select=id&deliveryId=eq.${deliveryId}&type=eq.NOTIFICACAO_ENVIADA&limit=1`,
  });
  return events.length > 0;
}

/** Registra auditoria agregada do envio de nova entrega para evitar duplicidade e apoiar relatorios. */
async function recordNewDeliveryNotificationEvent(
  deliveryId: string,
  notification: {
    sent: number;
    failed: number;
    inactiveTokens: number;
    targetCouriers: number;
    couriersWithoutTokens: number;
  },
) {
  const metadata = {
    notificationType: "NEW_DELIVERY_AVAILABLE",
    sent: notification.sent,
    failed: notification.failed,
    inactiveTokens: notification.inactiveTokens,
    targetCouriers: notification.targetCouriers,
    couriersWithoutTokens: notification.couriersWithoutTokens,
  };

  try {
    await prisma.deliveryEvent.create({
      data: {
        deliveryId,
        type: "NOTIFICACAO_ENVIADA",
        notes: "Notificacao de nova entrega disponivel enviada para motoboys.",
        metadata,
      },
    });
    return;
  } catch (error) {
    if (!canUseSupabaseRest()) throw error;
  }

  await supabaseRest("DeliveryEvent", {
    method: "POST",
    body: {
      deliveryId,
      type: "NOTIFICACAO_ENVIADA",
      notes: "Notificacao de nova entrega disponivel enviada para motoboys.",
      metadata,
    },
  });
}

/** Envia push de cancelamento apenas quando o operador marcou essa opcao. */
async function notifyDeliveryCanceledIfRequested(data: {
  notifyCourier: boolean;
  courierId?: string | null;
  deliveryId: string;
  publicCode: string;
  reason: string;
  log: FastifyBaseLogger;
}) {
  if (!data.notifyCourier) {
    return {
      enabled: false,
      sent: 0,
      failed: 0,
      inactiveTokens: 0,
      reason: "NOT_REQUESTED",
    };
  }

  if (!data.courierId) {
    return {
      enabled: true,
      sent: 0,
      failed: 0,
      inactiveTokens: 0,
      reason: "DELIVERY_WITHOUT_COURIER",
    };
  }

  try {
    return await sendCourierPushNotification({
      courierId: data.courierId,
      type: "DELIVERY_CANCELED",
      title: "Entrega cancelada",
      body: `A entrega ${data.publicCode} foi cancelada.`,
      data: {
        deliveryId: data.deliveryId,
        publicCode: data.publicCode,
      },
      log: data.log,
    });
  } catch (error) {
    data.log.error(
      {
        error,
        delivery_id: data.deliveryId,
        courier_id: data.courierId,
      },
      "delivery cancellation push notification failed",
    );
    return {
      enabled: true,
      sent: 0,
      failed: 1,
      inactiveTokens: 0,
      reason: "SEND_FAILED",
    };
  }
}

/** Lista motoboys ativos, disponiveis e alocados na loja para receber nova corrida. */
async function listAvailableCourierIdsForStore(storeId: string) {
  const now = new Date();
  try {
    const assignments = await prisma.courierStoreAssignment.findMany({
      where: {
        storeId,
        active: true,
        startsAt: {
          lte: now,
        },
        OR: [{ endsAt: null }, { endsAt: { gte: now } }],
        courier: {
          available: true,
          user: {
            active: true,
          },
        },
      },
      select: {
        courierId: true,
      },
      distinct: ["courierId"],
    });
    return assignments.map((assignment) => assignment.courierId);
  } catch (error) {
    if (!canUseSupabaseRest()) throw error;
  }

  const assignments = await supabaseRest<Array<{ courierId: string }>>("CourierStoreAssignment", {
    query: `select=courierId&storeId=eq.${storeId}&active=eq.true&startsAt=lte.${now.toISOString()}&or=(endsAt.is.null,endsAt.gte.${now.toISOString()})`,
  });
  const courierIds = [...new Set(assignments.map((assignment) => assignment.courierId))];
  if (courierIds.length === 0) return [];

  const couriers = await supabaseRest<Array<{ id: string }>>("Courier", {
    query: `select=id,User!inner(active)&id=in.(${courierIds.join(",")})&available=eq.true&User.active=eq.true`,
  });
  return couriers.map((courier) => courier.id);
}

/** Erro de dominio usado para bloquear aceite quando o motoboy esta indisponivel. */
class CourierUnavailableError extends Error {
  constructor() {
    super("Courier is unavailable.");
    this.name = "CourierUnavailableError";
  }
}

/** Soma resultados individuais de push em um resumo unico para auditoria. */
function aggregateNotificationResults(
  results: Array<{
    enabled: boolean;
    sent: number;
    failed: number;
    inactiveTokens: number;
    reason?: string;
  }>,
  courierCount: number,
) {
  const disabled = results.every((result) => !result.enabled);
  const sent = results.reduce((total, result) => total + result.sent, 0);
  const failed = results.reduce((total, result) => total + result.failed, 0);
  const inactiveTokens = results.reduce((total, result) => total + result.inactiveTokens, 0);
  const couriersWithoutTokens = results.filter((result) => result.reason === "NO_ACTIVE_DEVICE_TOKENS").length;

  return {
    enabled: !disabled,
    sent,
    failed,
    inactiveTokens,
    targetCouriers: courierCount,
    couriersWithoutTokens,
    reason: disabled ? "FIREBASE_ADMIN_NOT_CONFIGURED" : undefined,
  };
}
