import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import {
  bootstrapAdminSchema,
  createCourierStoreAssignmentSchema,
  createUserSchema,
  createUserStoreAssignmentSchema,
  loginSchema,
  registerCourierDeviceTokenSchema,
  resetUserPasswordSchema,
  updateCourierAvailabilitySchema,
  updateCourierLocationSchema,
  uuidSchema,
} from "../contracts";
import { validationError } from "../http";
import { prisma } from "../prisma";
import { readBearerToken, requireAuth, signSessionToken, verifySessionToken, type SessionPayload } from "../auth";
import { hashPassword, verifyPassword } from "../passwordHash";
import { canUseSupabaseRest, supabaseRest, type SupabaseCourier, type SupabaseStore, type SupabaseUser } from "../supabaseRest";
import { isStoreLoginRole, resolveUserStoreScope } from "../accessScope";

/** Registra autenticacao, usuarios, motoboys, dispositivos e alocacoes operacionais. */
export async function userRoutes(app: FastifyInstance) {
  app.get("/auth/me", async (request, reply) => {
    const auth = readBearerToken(request.headers.authorization);
    const payload = auth ? verifySessionToken(auth) : null;
    if (!payload) {
      return reply.status(401).send({
        error: "UNAUTHENTICATED",
        message: "Sessao invalida ou expirada.",
      });
    }

    try {
      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        include: {
          store: true,
          courier: true,
        },
      });

      if (!user?.active) {
        return reply.status(401).send({
          error: "UNAUTHENTICATED",
          message: "Usuario inativo ou nao encontrado.",
        });
      }

      return withSessionToken(mapUserSession(user));
    } catch (error) {
      app.log.error({ error }, "auth me error");
      if (canUseSupabaseRest()) {
        try {
          const user = await findSupabaseSessionUser(payload.sub);
          if (!user?.active) {
            return reply.status(401).send({
              error: "UNAUTHENTICATED",
              message: "Usuario inativo ou nao encontrado.",
            });
          }

          return withSessionToken(mapSupabaseUser(user));
        } catch (restError) {
          app.log.error({ error: restError }, "auth me supabase rest error");
        }
      }

      return reply.status(503).send({
        error: "DATABASE_UNAVAILABLE",
        message: "Nao foi possivel validar sessao agora.",
      });
    }
  });

  app.post("/auth/login", async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) return validationError(reply, parsed.error);

    const identifier = parsed.data.identifier.trim();

    try {
      const user = await prisma.user.findFirst({
        where: {
          active: true,
          OR: [{ email: identifier }, { phone: identifier }],
        },
        include: {
          store: true,
          courier: true,
        },
      });

      if (!user || !verifyPassword(parsed.data.password, user.passwordHash)) {
        return reply.status(401).send({
          error: "INVALID_CREDENTIALS",
          message: "Email/telefone ou senha invalidos.",
        });
      }

      return withSessionToken(mapUserSession(user));
    } catch (error) {
      app.log.error({ error }, "auth login error");
      if (canUseSupabaseRest()) {
        try {
          const users = await supabaseRest<SupabaseUser[]>("User", {
            query: `select=*,Store(id,name,code),Courier(*)&active=eq.true&or=(email.eq.${encodeURIComponent(identifier)},phone.eq.${encodeURIComponent(identifier)})&limit=1`,
          });
          const user = users[0];
          if (!user || !verifyPassword(parsed.data.password, user.passwordHash)) {
            return reply.status(401).send({
              error: "INVALID_CREDENTIALS",
              message: "Email/telefone ou senha invalidos.",
            });
          }
          return withSessionToken(mapSupabaseUser(user));
        } catch (restError) {
          app.log.error({ error: restError }, "auth login supabase rest error");
        }
      }

      return reply.status(503).send({
        error: "DATABASE_UNAVAILABLE",
        message: "Nao foi possivel entrar agora.",
      });
    }
  });

  app.post("/auth/bootstrap-admin", async (request, reply) => {
    const parsed = bootstrapAdminSchema.safeParse(request.body);
    if (!parsed.success) return validationError(reply, parsed.error);

    try {
      const existingUsers = await prisma.user.count();
      if (existingUsers > 0) {
        return reply.status(409).send({
          error: "BOOTSTRAP_LOCKED",
          message: "Primeiro admin ja foi configurado.",
        });
      }

      const user = await prisma.user.create({
        data: {
          name: parsed.data.name,
          phone: parsed.data.phone,
          email: parsed.data.email,
          passwordHash: hashPassword(parsed.data.password),
          role: "ADMIN",
        },
        include: {
          store: true,
          courier: true,
        },
      });

      return reply.status(201).send(withSessionToken(mapUserSession(user)));
    } catch (error) {
      app.log.error({ error }, "auth bootstrap admin error");
      if (canUseSupabaseRest()) {
        try {
          const existingUsers = await supabaseRest<Array<Pick<SupabaseUser, "id">>>("User", {
            query: "select=id&limit=1",
          });
          if (existingUsers.length > 0) {
            return reply.status(409).send({
              error: "BOOTSTRAP_LOCKED",
              message: "Primeiro admin ja foi configurado.",
            });
          }

          const users = await supabaseRest<SupabaseUser[]>("User", {
            method: "POST",
            prefer: "return=representation",
            body: {
              name: parsed.data.name,
              phone: parsed.data.phone,
              email: parsed.data.email,
              passwordHash: hashPassword(parsed.data.password),
              role: "ADMIN",
            },
          });
          const user = users[0];
          if (!user) throw new Error("User was not returned by Supabase REST.");

          return reply.status(201).send(withSessionToken(mapSupabaseUser(user)));
        } catch (restError) {
          app.log.error({ error: restError }, "auth bootstrap admin supabase rest error");
        }
      }

      return reply.status(503).send({
        error: "DATABASE_UNAVAILABLE",
        message: "Nao foi possivel configurar o primeiro admin.",
      });
    }
  });

  app.get("/couriers", async (request, reply) => {
    const session = await requireAuth(request, reply, ["ADMIN", "GERENTE", "MOTOBOY"]);
    if (!session) return;
    const userStoreScope = await resolveUserStoreScope(session);

    try {
      const couriers = await prisma.courier.findMany({
        where: courierListScopeWhere(session, userStoreScope),
        orderBy: { createdAt: "desc" },
        include: {
          user: true,
        },
      });

      return couriers.map((courier) => ({
        id: courier.id,
        name: courier.user.name,
        phone: courier.user.phone,
        baseStoreName: courier.baseStoreName,
        available: courier.available,
        currentLat: courier.currentLat ? Number(courier.currentLat) : null,
        currentLng: courier.currentLng ? Number(courier.currentLng) : null,
        lastLocationAt: courier.lastLocationAt?.toISOString() ?? null,
        active: courier.user.active,
      }));
    } catch (error) {
      app.log.error({ error }, "couriers list error");
      if (canUseSupabaseRest()) {
        const courierFilter = courierListScopeRestFilter(session, userStoreScope);
        const couriers = await supabaseRest<SupabaseCourier[]>("Courier", {
          query: `select=*,User(id,name,phone)${courierFilter.select}&order=createdAt.desc${courierFilter.filter}`,
        });

        return couriers.map(mapSupabaseCourier);
      }

      return reply.status(503).send({
        error: "DATABASE_UNAVAILABLE",
        message: "Nao foi possivel listar motoboys.",
      });
    }
  });

  app.post("/couriers/location", async (request, reply) => {
    const session = await requireAuth(request, reply, ["ADMIN", "MOTOBOY"]);
    if (!session) return;

    const parsed = updateCourierLocationSchema.safeParse(request.body);
    if (!parsed.success) return validationError(reply, parsed.error);
    if (session.role === "MOTOBOY" && session.courierId !== parsed.data.courierId) {
      return reply.status(403).send({
        error: "FORBIDDEN",
        message: "Motoboy so pode atualizar a propria localizacao.",
      });
    }

    try {
      const courier = await prisma.courier.update({
        where: { id: parsed.data.courierId },
        data: {
          currentLat: parsed.data.latitude,
          currentLng: parsed.data.longitude,
          available: parsed.data.available,
          lastLocationAt: new Date(),
        },
        include: {
          user: true,
        },
      });

      return {
        id: courier.id,
        name: courier.user.name,
        phone: courier.user.phone,
        baseStoreName: courier.baseStoreName,
        available: courier.available,
        currentLat: courier.currentLat ? Number(courier.currentLat) : null,
        currentLng: courier.currentLng ? Number(courier.currentLng) : null,
        lastLocationAt: courier.lastLocationAt?.toISOString() ?? null,
        active: courier.user.active,
      };
    } catch (error) {
      app.log.error({ error }, "courier location update error");
      if (canUseSupabaseRest()) {
        try {
          const updated = await updateCourierLocationWithSupabaseRest(parsed.data);
          return reply.send(updated);
        } catch (restError) {
          app.log.error({ error: restError }, "courier location update supabase rest error");
        }
      }

      return reply.status(503).send({
        error: "DATABASE_UNAVAILABLE",
        message: "Nao foi possivel atualizar localizacao do motoboy.",
      });
    }
  });

  app.post("/couriers/availability", async (request, reply) => {
    const session = await requireAuth(request, reply, ["ADMIN", "MOTOBOY"]);
    if (!session) return;

    const parsed = updateCourierAvailabilitySchema.safeParse(request.body);
    if (!parsed.success) return validationError(reply, parsed.error);
    if (session.role === "MOTOBOY" && session.courierId !== parsed.data.courierId) {
      return reply.status(403).send({
        error: "FORBIDDEN",
        message: "Motoboy so pode atualizar a propria disponibilidade.",
      });
    }

    try {
      const courier = await prisma.courier.update({
        where: { id: parsed.data.courierId },
        data: {
          available: parsed.data.available,
        },
        include: {
          user: true,
        },
      });

      return {
        id: courier.id,
        name: courier.user.name,
        phone: courier.user.phone,
        baseStoreName: courier.baseStoreName,
        available: courier.available,
        currentLat: courier.currentLat ? Number(courier.currentLat) : null,
        currentLng: courier.currentLng ? Number(courier.currentLng) : null,
        lastLocationAt: courier.lastLocationAt?.toISOString() ?? null,
        active: courier.user.active,
      };
    } catch (error) {
      app.log.error({ error }, "courier availability update error");
      if (canUseSupabaseRest()) {
        try {
          const updated = await updateCourierAvailabilityWithSupabaseRest(parsed.data);
          return reply.send(updated);
        } catch (restError) {
          app.log.error({ error: restError }, "courier availability update supabase rest error");
        }
      }

      return reply.status(503).send({
        error: "DATABASE_UNAVAILABLE",
        message: "Nao foi possivel atualizar disponibilidade do motoboy.",
      });
    }
  });

  app.post("/couriers/:courierId/device-token", async (request, reply) => {
    const session = await requireAuth(request, reply, ["ADMIN", "MOTOBOY"]);
    if (!session) return;

    const params = request.params as { courierId: string };
    const parsedCourierId = uuidSchema.safeParse(params.courierId);
    if (!parsedCourierId.success) return validationError(reply, parsedCourierId.error);

    const parsed = registerCourierDeviceTokenSchema.safeParse(request.body);
    if (!parsed.success) return validationError(reply, parsed.error);

    if (session.role === "MOTOBOY" && session.courierId !== parsedCourierId.data) {
      return reply.status(403).send({
        error: "FORBIDDEN",
        message: "Motoboy so pode registrar o proprio dispositivo.",
      });
    }

    try {
      const deviceToken = await prisma.courierDeviceToken.upsert({
        where: { token: parsed.data.deviceToken },
        update: {
          courierId: parsedCourierId.data,
          platform: parsed.data.platform,
          active: true,
          lastSeenAt: new Date(),
        },
        create: {
          courierId: parsedCourierId.data,
          token: parsed.data.deviceToken,
          platform: parsed.data.platform,
          active: true,
        },
      });

      return mapCourierDeviceToken(deviceToken);
    } catch (error) {
      app.log.error({ error }, "courier device token register error");
      if (canUseSupabaseRest()) {
        try {
          const existingTokens = await supabaseRest<any[]>("CourierDeviceToken", {
            method: "PATCH",
            query: `token=eq.${encodeURIComponent(parsed.data.deviceToken)}`,
            prefer: "return=representation",
            body: {
              courierId: parsedCourierId.data,
              platform: parsed.data.platform,
              active: true,
              lastSeenAt: new Date().toISOString(),
            },
          });

          const createdTokens =
            existingTokens.length > 0
              ? existingTokens
              : await supabaseRest<any[]>("CourierDeviceToken", {
                  method: "POST",
                  prefer: "return=representation",
                  body: {
                    courierId: parsedCourierId.data,
                    token: parsed.data.deviceToken,
                    platform: parsed.data.platform,
                    active: true,
                    lastSeenAt: new Date().toISOString(),
                  },
                });

          const token = createdTokens[0];
          if (!token) throw new Error("Courier device token was not returned.");
          return mapSupabaseCourierDeviceToken(token);
        } catch (restError) {
          app.log.error({ error: restError }, "courier device token register supabase rest error");
        }
      }

      return reply.status(503).send({
        error: "DATABASE_UNAVAILABLE",
        message: "Nao foi possivel registrar dispositivo do motoboy.",
      });
    }
  });

  app.get("/users", async (request, reply) => {
    const session = await requireAuth(request, reply, ["ADMIN", "GERENTE"]);
    if (!session) return;
    const userStoreScope = await resolveUserStoreScope(session);

    try {
      const users = await prisma.user.findMany({
        where: userListScopeWhere(session, userStoreScope),
        orderBy: { createdAt: "desc" },
        include: {
          store: true,
          courier: true,
        },
      });

      return users.map((user) => ({
        id: user.id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        role: user.role,
        active: user.active,
        store: user.store
          ? {
              id: user.store.id,
              name: user.store.name,
              code: user.store.code,
            }
          : null,
        courier: user.courier
          ? {
              id: user.courier.id,
              baseStoreName: user.courier.baseStoreName,
              available: user.courier.available,
              currentLat: user.courier.currentLat ? Number(user.courier.currentLat) : null,
              currentLng: user.courier.currentLng ? Number(user.courier.currentLng) : null,
              lastLocationAt: user.courier.lastLocationAt?.toISOString() ?? null,
            }
          : null,
        createdAt: user.createdAt.toISOString(),
      }));
    } catch (error) {
      app.log.error({ error }, "users list error");
      if (canUseSupabaseRest()) {
        const userFilter = userListScopeRestFilter(session, userStoreScope);
        const users = await supabaseRest<SupabaseUser[]>("User", {
          query: `select=*,Store(id,name,code),Courier(*)&order=createdAt.desc${userFilter}`,
        });
        return users.map(mapSupabaseUser);
      }

      return reply.status(503).send({
        error: "DATABASE_UNAVAILABLE",
        message: "Nao foi possivel listar usuarios.",
      });
    }
  });

  app.get("/assignments", async (request, reply) => {
    const session = await requireAuth(request, reply, ["ADMIN"]);
    if (!session) return;

    const query = request.query as { includeInactive?: string };
    const includeInactive = query.includeInactive === "true";
    const activeWhere = includeInactive ? {} : { active: true };
    const activeRestFilter = includeInactive ? "" : "&active=eq.true";

    try {
      const [userAssignments, courierAssignments] = await Promise.all([
        prisma.userStoreAssignment.findMany({
          where: activeWhere,
          orderBy: { startsAt: "desc" },
          include: {
            user: true,
            store: true,
          },
        }),
        prisma.courierStoreAssignment.findMany({
          where: activeWhere,
          orderBy: { startsAt: "desc" },
          include: {
            courier: {
              include: {
                user: true,
              },
            },
            store: true,
          },
        }),
      ]);

      return {
        users: userAssignments.map(mapUserAssignment),
        couriers: courierAssignments.map(mapCourierAssignment),
      };
    } catch (error) {
      app.log.error({ error }, "assignments list error");
      if (canUseSupabaseRest()) {
        try {
          const [users, couriers] = await Promise.all([
            supabaseRest<any[]>("UserStoreAssignment", {
              query: `select=*,User(id,name,role),Store(id,name,code)${activeRestFilter}&order=startsAt.desc`,
            }),
            supabaseRest<any[]>("CourierStoreAssignment", {
              query: `select=*,Courier(id,baseStoreName,User(id,name,phone)),Store(id,name,code)${activeRestFilter}&order=startsAt.desc`,
            }),
          ]);
          return {
            users: users.map(mapSupabaseUserAssignment),
            couriers: couriers.map(mapSupabaseCourierAssignment),
          };
        } catch (restError) {
          app.log.error({ error: restError }, "assignments list supabase rest error");
        }
      }

      return reply.status(503).send({
        error: "DATABASE_UNAVAILABLE",
        message: "Nao foi possivel listar alocacoes.",
      });
    }
  });

  app.post("/assignments/users", async (request, reply) => {
    const session = await requireAuth(request, reply, ["ADMIN"]);
    if (!session) return;

    const parsed = createUserStoreAssignmentSchema.safeParse(request.body);
    if (!parsed.success) return validationError(reply, parsed.error);

    const data = {
      userId: parsed.data.userId,
      storeId: parsed.data.storeId,
      kind: parsed.data.kind,
      startsAt: parsed.data.startsAt ? new Date(parsed.data.startsAt) : undefined,
      endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : undefined,
      reason: parsed.data.reason,
    };

    try {
      const assignment = await prisma.userStoreAssignment.create({
        data,
        include: {
          user: true,
          store: true,
        },
      });
      return reply.status(201).send(mapUserAssignment(assignment));
    } catch (error) {
      app.log.error({ error }, "user assignment create error");
      if (canUseSupabaseRest()) {
        try {
          const assignments = await supabaseRest<any[]>("UserStoreAssignment", {
            method: "POST",
            prefer: "return=representation",
            body: {
              ...parsed.data,
              startsAt: parsed.data.startsAt,
              endsAt: parsed.data.endsAt,
            },
          });
          const assignment = assignments[0];
          if (!assignment) throw new Error("Assignment was not returned.");
          return reply.status(201).send(mapSupabaseUserAssignment(await hydrateUserAssignment(assignment)));
        } catch (restError) {
          app.log.error({ error: restError }, "user assignment create supabase rest error");
        }
      }

      return reply.status(503).send({
        error: "DATABASE_UNAVAILABLE",
        message: "Nao foi possivel criar alocacao de usuario.",
      });
    }
  });

  app.post("/assignments/couriers", async (request, reply) => {
    const session = await requireAuth(request, reply, ["ADMIN"]);
    if (!session) return;

    const parsed = createCourierStoreAssignmentSchema.safeParse(request.body);
    if (!parsed.success) return validationError(reply, parsed.error);

    const data = {
      courierId: parsed.data.courierId,
      storeId: parsed.data.storeId,
      kind: parsed.data.kind,
      startsAt: parsed.data.startsAt ? new Date(parsed.data.startsAt) : undefined,
      endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : undefined,
      reason: parsed.data.reason,
    };

    try {
      const assignment = await prisma.courierStoreAssignment.create({
        data,
        include: {
          courier: {
            include: {
              user: true,
            },
          },
          store: true,
        },
      });
      return reply.status(201).send(mapCourierAssignment(assignment));
    } catch (error) {
      app.log.error({ error }, "courier assignment create error");
      if (canUseSupabaseRest()) {
        try {
          const assignments = await supabaseRest<any[]>("CourierStoreAssignment", {
            method: "POST",
            prefer: "return=representation",
            body: {
              ...parsed.data,
              startsAt: parsed.data.startsAt,
              endsAt: parsed.data.endsAt,
            },
          });
          const assignment = assignments[0];
          if (!assignment) throw new Error("Assignment was not returned.");
          return reply.status(201).send(mapSupabaseCourierAssignment(await hydrateCourierAssignment(assignment)));
        } catch (restError) {
          app.log.error({ error: restError }, "courier assignment create supabase rest error");
        }
      }

      return reply.status(503).send({
        error: "DATABASE_UNAVAILABLE",
        message: "Nao foi possivel criar alocacao de motoboy.",
      });
    }
  });

  app.patch("/assignments/:type/:assignmentId/end", async (request, reply) => {
    const session = await requireAuth(request, reply, ["ADMIN"]);
    if (!session) return;

    const params = request.params as { type: string; assignmentId: string };
    if (!["users", "couriers"].includes(params.type)) {
      return reply.status(400).send({
        error: "INVALID_ASSIGNMENT_TYPE",
        message: "Tipo de alocacao invalido.",
      });
    }
    const parsedAssignmentId = uuidSchema.safeParse(params.assignmentId);
    if (!parsedAssignmentId.success) return validationError(reply, parsedAssignmentId.error);

    try {
      if (params.type === "users") {
        const assignment = await prisma.userStoreAssignment.update({
          where: { id: params.assignmentId },
          data: {
            active: false,
            endsAt: new Date(),
          },
          include: {
            user: true,
            store: true,
          },
        });
        return mapUserAssignment(assignment);
      }

      const assignment = await prisma.courierStoreAssignment.update({
        where: { id: params.assignmentId },
        data: {
          active: false,
          endsAt: new Date(),
        },
        include: {
          courier: {
            include: {
              user: true,
            },
          },
          store: true,
        },
      });
      return mapCourierAssignment(assignment);
    } catch (error) {
      app.log.error({ error }, "assignment end error");
      if (canUseSupabaseRest()) {
        try {
          const table = params.type === "users" ? "UserStoreAssignment" : "CourierStoreAssignment";
          await supabaseRest(table, {
            method: "PATCH",
            query: `id=eq.${params.assignmentId}`,
            body: {
              active: false,
              endsAt: new Date().toISOString(),
            },
          });
          return { ok: true, source: "supabase-rest" };
        } catch (restError) {
          app.log.error({ error: restError }, "assignment end supabase rest error");
        }
      }

      return reply.status(503).send({
        error: "DATABASE_UNAVAILABLE",
        message: "Nao foi possivel encerrar alocacao.",
      });
    }
  });

  app.post("/users", async (request, reply) => {
    const session = await requireAuth(request, reply, ["ADMIN"]);
    if (!session) return;

    const parsed = createUserSchema.safeParse(request.body);
    if (!parsed.success) return validationError(reply, parsed.error);
    const passwordHash = hashPassword(passwordForCreatedUser(parsed.data));

    try {
      const result = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            name: parsed.data.name,
            phone: parsed.data.phone,
            email: parsed.data.email,
            passwordHash,
            role: parsed.data.role,
            storeId: parsed.data.storeId,
          },
          include: {
            store: true,
          },
        });

        const courier =
          parsed.data.role === "MOTOBOY"
            ? await tx.courier.create({
                data: {
                  userId: user.id,
                  baseStoreName: user.store?.name ?? "Asturias",
                },
              })
            : null;

        if (user.storeId) {
          await tx.userStoreAssignment.create({
            data: {
              userId: user.id,
              storeId: user.storeId,
              kind: "BASE",
              reason: "Vinculo inicial definido no cadastro do usuario.",
            },
          });
        }

        if (courier && user.storeId) {
          await tx.courierStoreAssignment.create({
            data: {
              courierId: courier.id,
              storeId: user.storeId,
              kind: user.store?.baseType === "DEDICADA" ? "DEDICADA" : "COBERTURA",
              reason: "Vinculo inicial definido no cadastro do motoboy.",
            },
          });
        }

        return {
          user,
          courier,
        };
      });

      return reply.status(201).send({
        id: result.user.id,
        name: result.user.name,
        phone: result.user.phone,
        email: result.user.email,
        role: result.user.role,
        active: result.user.active,
        store: result.user.store
          ? {
              id: result.user.store.id,
              name: result.user.store.name,
              code: result.user.store.code,
            }
          : null,
        courier: result.courier
          ? {
              id: result.courier.id,
              baseStoreName: result.courier.baseStoreName,
              available: result.courier.available,
              currentLat: null,
              currentLng: null,
              lastLocationAt: null,
            }
          : null,
        createdAt: result.user.createdAt.toISOString(),
      });
    } catch (error) {
      app.log.error({ error }, "users create error");
      if (canUseSupabaseRest()) {
        try {
          const result = await createUserWithSupabaseRest(parsed.data);
          return reply.status(201).send(result);
        } catch (restError) {
          app.log.error({ error: restError }, "users create supabase rest error");
        }
      }

      return reply.status(503).send({
        error: "DATABASE_UNAVAILABLE",
        message: "Nao foi possivel criar usuario. Confira email unico, loja e conexao com banco.",
      });
    }
  });

  app.patch("/users/:userId/password", async (request, reply) => {
    const session = await requireAuth(request, reply, ["ADMIN"]);
    if (!session) return;

    const params = request.params as { userId: string };
    const parsedParams = uuidSchema.safeParse(params.userId);
    if (!parsedParams.success) return validationError(reply, parsedParams.error);

    const parsed = resetUserPasswordSchema.safeParse(request.body);
    if (!parsed.success) return validationError(reply, parsed.error);

    const passwordHash = hashPassword(parsed.data.password);

    try {
      const user = await prisma.user.update({
        where: { id: parsedParams.data },
        data: { passwordHash },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          active: true,
        },
      });

      return {
        ok: true,
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        active: user.active,
      };
    } catch (error) {
      app.log.error({ error }, "user password reset error");
      if (canUseSupabaseRest()) {
        try {
          const users = await supabaseRest<SupabaseUser[]>("User", {
            method: "PATCH",
            query: `id=eq.${encodeURIComponent(parsedParams.data)}&select=id,name,email,phone,role,active`,
            prefer: "return=representation",
            body: {
              passwordHash,
              updatedAt: new Date().toISOString(),
            },
          });
          const user = users[0];
          if (!user) {
            return reply.status(404).send({
              error: "USER_NOT_FOUND",
              message: "Usuario nao encontrado.",
            });
          }

          return {
            ok: true,
            id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            role: user.role,
            active: user.active,
            source: "supabase-rest",
          };
        } catch (restError) {
          app.log.error({ error: restError }, "user password reset supabase rest error");
        }
      }

      return reply.status(503).send({
        error: "DATABASE_UNAVAILABLE",
        message: "Nao foi possivel redefinir a senha agora.",
      });
    }
  });
}

/** Normaliza alocacao de usuario para o contrato usado pelo painel admin. */
function mapUserAssignment(assignment: {
  id: string;
  kind: string;
  startsAt: Date;
  endsAt: Date | null;
  active: boolean;
  reason: string | null;
  user: { id: string; name: string; role: string };
  store: { id: string; name: string; code: string };
}) {
  return {
    id: assignment.id,
    kind: assignment.kind,
    startsAt: assignment.startsAt.toISOString(),
    endsAt: assignment.endsAt?.toISOString() ?? null,
    active: assignment.active,
    reason: assignment.reason,
    user: {
      id: assignment.user.id,
      name: assignment.user.name,
      role: assignment.user.role,
    },
    store: {
      id: assignment.store.id,
      name: assignment.store.name,
      code: assignment.store.code,
    },
  };
}

/** Normaliza alocacao de motoboy incluindo dados basicos do usuario vinculado. */
function mapCourierAssignment(assignment: {
  id: string;
  kind: string;
  startsAt: Date;
  endsAt: Date | null;
  active: boolean;
  reason: string | null;
  courier: { id: string; baseStoreName: string; user: { id: string; name: string; phone: string | null } };
  store: { id: string; name: string; code: string };
}) {
  return {
    id: assignment.id,
    kind: assignment.kind,
    startsAt: assignment.startsAt.toISOString(),
    endsAt: assignment.endsAt?.toISOString() ?? null,
    active: assignment.active,
    reason: assignment.reason,
    courier: {
      id: assignment.courier.id,
      name: assignment.courier.user.name,
      phone: assignment.courier.user.phone,
      baseStoreName: assignment.courier.baseStoreName,
    },
    store: {
      id: assignment.store.id,
      name: assignment.store.name,
      code: assignment.store.code,
    },
  };
}

/** Retorna metadados seguros do token de dispositivo sem expor o token real. */
function mapCourierDeviceToken(token: {
  id: string;
  courierId: string;
  platform: string;
  active: boolean;
  lastSeenAt: Date;
}) {
  return {
    id: token.id,
    courierId: token.courierId,
    platform: token.platform,
    active: token.active,
    lastSeenAt: token.lastSeenAt.toISOString(),
  };
}

/** Normaliza alocacao de usuario vinda do Supabase REST para o mesmo contrato do Prisma. */
function mapSupabaseUserAssignment(assignment: any) {
  return {
    id: assignment.id,
    kind: assignment.kind,
    startsAt: assignment.startsAt,
    endsAt: assignment.endsAt ?? null,
    active: assignment.active,
    reason: assignment.reason ?? null,
    user: {
      id: assignment.User?.id ?? assignment.userId,
      name: assignment.User?.name ?? "Usuario",
      role: assignment.User?.role ?? "BALCONISTA_CAIXA",
    },
    store: {
      id: assignment.Store?.id ?? assignment.storeId,
      name: assignment.Store?.name ?? "Loja",
      code: assignment.Store?.code ?? "",
    },
    source: "supabase-rest",
  };
}

/** Normaliza alocacao de motoboy vinda do Supabase REST para o mesmo contrato do Prisma. */
function mapSupabaseCourierAssignment(assignment: any) {
  return {
    id: assignment.id,
    kind: assignment.kind,
    startsAt: assignment.startsAt,
    endsAt: assignment.endsAt ?? null,
    active: assignment.active,
    reason: assignment.reason ?? null,
    courier: {
      id: assignment.Courier?.id ?? assignment.courierId,
      name: assignment.Courier?.User?.name ?? "Motoboy",
      phone: assignment.Courier?.User?.phone ?? null,
      baseStoreName: assignment.Courier?.baseStoreName ?? "",
    },
    store: {
      id: assignment.Store?.id ?? assignment.storeId,
      name: assignment.Store?.name ?? "Loja",
      code: assignment.Store?.code ?? "",
    },
    source: "supabase-rest",
  };
}

/** Retorna token de dispositivo criado/atualizado via REST sem vazar o token FCM/Web Push. */
function mapSupabaseCourierDeviceToken(token: any) {
  return {
    id: token.id,
    courierId: token.courierId,
    platform: token.platform,
    active: token.active,
    lastSeenAt: token.lastSeenAt,
    source: "supabase-rest",
  };
}

/** Completa usuario e loja depois de criar alocacao via REST, que nem sempre retorna relacionamentos. */
async function hydrateUserAssignment(assignment: any) {
  const [users, stores] = await Promise.all([
    supabaseRest<any[]>("User", {
      query: `select=id,name,role&id=eq.${assignment.userId}&limit=1`,
    }),
    supabaseRest<any[]>("Store", {
      query: `select=id,name,code&id=eq.${assignment.storeId}&limit=1`,
    }),
  ]);
  return {
    ...assignment,
    User: users[0] ?? null,
    Store: stores[0] ?? null,
  };
}

/** Completa motoboy e loja depois de criar alocacao via REST, mantendo o contrato do painel. */
async function hydrateCourierAssignment(assignment: any) {
  const [couriers, stores] = await Promise.all([
    supabaseRest<any[]>("Courier", {
      query: `select=id,baseStoreName,User(id,name,phone)&id=eq.${assignment.courierId}&limit=1`,
    }),
    supabaseRest<any[]>("Store", {
      query: `select=id,name,code&id=eq.${assignment.storeId}&limit=1`,
    }),
  ]);
  return {
    ...assignment,
    Courier: couriers[0] ?? null,
    Store: stores[0] ?? null,
  };
}

/** Monta o usuario de sessao com loja e motoboy, sem retornar passwordHash. */
function mapUserSession(user: {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  role: string;
  active: boolean;
  store: { id: string; name: string; code: string } | null;
  courier: {
    id: string;
    baseStoreName: string;
    available: boolean;
    currentLat: unknown;
    currentLng: unknown;
    lastLocationAt: Date | null;
  } | null;
  createdAt: Date;
}) {
  return {
    id: user.id,
    name: user.name,
    phone: user.phone,
    email: user.email,
    role: user.role,
    active: user.active,
    store: user.store
      ? {
          id: user.store.id,
          name: user.store.name,
          code: user.store.code,
        }
      : null,
    courier: user.courier
      ? {
          id: user.courier.id,
          baseStoreName: user.courier.baseStoreName,
          available: user.courier.available,
          currentLat: user.courier.currentLat ? Number(user.courier.currentLat) : null,
          currentLng: user.courier.currentLng ? Number(user.courier.currentLng) : null,
          lastLocationAt: user.courier.lastLocationAt?.toISOString() ?? null,
        }
      : null,
    createdAt: user.createdAt.toISOString(),
  };
}

type SessionUser = ReturnType<typeof mapUserSession> | ReturnType<typeof mapSupabaseUser>;

/** Anexa token assinado da API ao usuario autenticado ou recarregado em /auth/me. */
function withSessionToken<T extends SessionUser>(user: T) {
  return {
    ...user,
    token: signSessionToken({
      sub: user.id,
      role: user.role,
      storeId: user.store?.id ?? null,
      courierId: user.courier?.id ?? null,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
    }),
  };
}

/** Cria usuario pelo fallback REST e replica vinculo base/alocacao inicial quando existir loja. */
async function createUserWithSupabaseRest(data: typeof createUserSchema._output) {
  const users = await supabaseRest<SupabaseUser[]>("User", {
    method: "POST",
    prefer: "return=representation",
    body: {
      name: data.name,
      phone: data.phone,
      email: data.email,
      passwordHash: hashPassword(passwordForCreatedUser(data)),
      role: data.role,
      storeId: data.storeId,
    },
  });
  const user = users[0];
  if (!user) throw new Error("User was not returned by Supabase REST.");

  const store = data.storeId ? await resolveStore(data.storeId) : null;
  if (store) {
    await supabaseRest("UserStoreAssignment", {
      method: "POST",
      body: {
        userId: user.id,
        storeId: store.id,
        kind: "BASE",
        reason: "Vinculo inicial definido no cadastro do usuario.",
      },
    });
  }

  let courier: SupabaseCourier | null = null;
  if (data.role === "MOTOBOY") {
    const couriers = await supabaseRest<SupabaseCourier[]>("Courier", {
      method: "POST",
      prefer: "return=representation",
      body: {
        userId: user.id,
        baseStoreName: store?.name ?? "Asturias",
      },
    });
    courier = couriers[0] ?? null;

    if (courier && store) {
      await supabaseRest("CourierStoreAssignment", {
        method: "POST",
        body: {
          courierId: courier.id,
          storeId: store.id,
          kind: store.baseType === "DEDICADA" ? "DEDICADA" : "COBERTURA",
          reason: "Vinculo inicial definido no cadastro do motoboy.",
        },
      });
    }
  }

  return mapSupabaseUser({
    ...user,
    Courier: courier,
    Store: store ? { id: store.id, name: store.name, code: store.code } : null,
  });
}

function passwordForCreatedUser(data: typeof createUserSchema._output) {
  return data.password ?? `reference-${randomUUID()}`;
}

/** Resolve nome da loja para usar como base do motoboy quando o cadastro vem pelo fallback REST. */
async function resolveStoreName(storeId?: string) {
  const store = await resolveStore(storeId);
  return store?.name ?? "Asturias";
}

/** Busca dados minimos da loja no fallback REST para criar vinculos iniciais. */
async function resolveStore(storeId?: string) {
  if (!storeId) return null;
  const stores = await supabaseRest<SupabaseStore[]>("Store", {
    query: `select=id,name,code,baseType&id=eq.${storeId}`,
  });
  return stores[0] ?? null;
}

/** Escopa listagem Prisma de motoboys por perfil, incluindo alocacoes ativas de loja. */
export function courierListScopeWhere(
  session: { role: string; courierId?: string | null },
  userStoreScope: string[] | null,
  now = new Date(),
): Prisma.CourierWhereInput | undefined {
  if (session.role === "MOTOBOY" && session.courierId) return { id: session.courierId };
  if (!isStoreLoginRole(session.role)) return undefined;
  if (!userStoreScope?.length) return { id: { in: [] } };

  return {
    storeAssignments: {
      some: {
        storeId: { in: userStoreScope },
        active: true,
        startsAt: { lte: now },
        OR: [{ endsAt: null }, { endsAt: { gte: now } }],
      },
    },
  };
}

/** Escopa listagem REST de motoboys com a mesma regra de alocacao ativa usada no Prisma. */
export function courierListScopeRestFilter(
  session: { role: string; courierId?: string | null },
  userStoreScope: string[] | null,
  now = new Date(),
) {
  if (session.role === "MOTOBOY" && session.courierId) {
    return { select: "", filter: `&id=eq.${session.courierId}` };
  }

  if (!isStoreLoginRole(session.role)) return { select: "", filter: "" };
  if (!userStoreScope?.length) return { select: "", filter: "&id=eq.__no_courier_scope__" };

  const storeFilter =
    userStoreScope.length === 1
      ? `CourierStoreAssignment.storeId=eq.${userStoreScope[0]}`
      : `CourierStoreAssignment.storeId=in.(${userStoreScope.join(",")})`;
  return {
    select: ",CourierStoreAssignment!inner(storeId)",
    filter:
      `&${storeFilter}` +
      "&CourierStoreAssignment.active=eq.true" +
      `&CourierStoreAssignment.startsAt=lte.${now.toISOString()}` +
      `&or=(CourierStoreAssignment.endsAt.is.null,CourierStoreAssignment.endsAt.gte.${now.toISOString()})`,
  };
}

/** Escopa listagem Prisma para login de loja e mantem balconistas globais para autocomplete operacional. */
export function userListScopeWhere(
  session: { role: string },
  userStoreScope: string[] | null,
): Prisma.UserWhereInput | undefined {
  if (!isStoreLoginRole(session.role)) return undefined;
  if (!userStoreScope?.length) return { id: { in: [] } };

  return {
    OR: [{ storeId: { in: userStoreScope } }, { role: "MOTOBOY" }, { role: "BALCONISTA_CAIXA" }],
  };
}

/** Escopa listagem REST para login de loja e mantem balconistas globais para autocomplete operacional. */
export function userListScopeRestFilter(
  session: { role: string },
  userStoreScope: string[] | null,
) {
  if (!isStoreLoginRole(session.role)) return "";
  if (!userStoreScope?.length) return "&id=eq.__no_user_scope__";

  const storeFilter =
    userStoreScope.length === 1
      ? `storeId.eq.${userStoreScope[0]}`
      : `storeId.in.(${userStoreScope.join(",")})`;
  return `&or=(${storeFilter},role.eq.MOTOBOY,role.eq.BALCONISTA_CAIXA)`;
}

/** Busca usuario da sessao pelo fallback REST durante renovacao/validacao de token. */
async function findSupabaseSessionUser(userId: string) {
  const users = await supabaseRest<SupabaseUser[]>("User", {
    query: `select=*,Store(id,name,code),Courier(*)&id=eq.${userId}&limit=1`,
  });
  return users[0] ?? null;
}

/** Normaliza usuario vindo do Supabase REST para o mesmo formato de sessao/listagem. */
function mapSupabaseUser(user: SupabaseUser) {
  return {
    id: user.id,
    name: user.name,
    phone: user.phone,
    email: user.email,
    role: user.role,
    active: user.active,
    store: user.Store
      ? {
          id: user.Store.id,
          name: user.Store.name,
          code: user.Store.code,
        }
      : null,
    courier: user.Courier
      ? {
          id: user.Courier.id,
          baseStoreName: user.Courier.baseStoreName,
          available: user.Courier.available,
          currentLat: user.Courier.currentLat,
          currentLng: user.Courier.currentLng,
          lastLocationAt: user.Courier.lastLocationAt,
        }
      : null,
    createdAt: user.createdAt,
    source: "supabase-rest",
  };
}

/** Normaliza motoboy vindo do Supabase REST para o contrato da fila/mapa. */
function mapSupabaseCourier(courier: SupabaseCourier) {
  return {
    id: courier.id,
    name: courier.User?.name ?? "Motoboy",
    phone: courier.User?.phone ?? null,
    baseStoreName: courier.baseStoreName,
    available: courier.available,
    currentLat: courier.currentLat,
    currentLng: courier.currentLng,
    lastLocationAt: courier.lastLocationAt,
    active: true,
    source: "supabase-rest",
  };
}

/** Atualiza GPS/disponibilidade do motoboy pelo fallback REST. */
async function updateCourierLocationWithSupabaseRest(data: typeof updateCourierLocationSchema._output) {
  const couriers = await supabaseRest<SupabaseCourier[]>("Courier", {
    method: "PATCH",
    query: `id=eq.${data.courierId}&select=*,User(id,name,phone)`,
    prefer: "return=representation",
    body: {
      currentLat: data.latitude,
      currentLng: data.longitude,
      available: data.available,
      lastLocationAt: new Date().toISOString(),
    },
  });
  const courier = couriers[0];
  if (!courier) throw new Error("Courier was not returned by Supabase REST.");
  return mapSupabaseCourier(courier);
}

/** Atualiza apenas a disponibilidade do motoboy pelo fallback REST. */
async function updateCourierAvailabilityWithSupabaseRest(data: typeof updateCourierAvailabilitySchema._output) {
  const couriers = await supabaseRest<SupabaseCourier[]>("Courier", {
    method: "PATCH",
    query: `id=eq.${data.courierId}&select=*,User(id,name,phone)`,
    prefer: "return=representation",
    body: {
      available: data.available,
    },
  });
  const courier = couriers[0];
  if (!courier) throw new Error("Courier was not returned by Supabase REST.");
  return mapSupabaseCourier(courier);
}
