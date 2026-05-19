import cors from "@fastify/cors";
import Fastify from "fastify";
import { randomUUID } from "node:crypto";
import { deliveryRoutes } from "./routes/deliveries";
import { geocodingRoutes } from "./routes/geocoding";
import { healthRoutes } from "./routes/health";
import { notificationRoutes } from "./routes/notifications";
import { courierRouteRoutes } from "./routes/routes";
import { storeRoutes } from "./routes/stores";
import { userRoutes } from "./routes/users";

export async function createApp(options: { logger?: boolean } = {}) {
  const app = Fastify({
    logger: options.logger ?? true,
    genReqId: (request) => {
      const incomingId = request.headers["x-request-id"];
      return typeof incomingId === "string" && incomingId.trim() ? incomingId.trim() : randomUUID();
    },
  });

  await app.register(cors, {
    origin: true,
  });

  app.addHook("onRequest", async (request, reply) => {
    reply.header("x-request-id", request.id);
    request.log.info(
      {
        request_id: request.id,
        timestamp_utc: new Date().toISOString(),
        method: request.method,
        url: request.url,
      },
      "request received",
    );
  });

  app.addHook("onResponse", async (request, reply) => {
    request.log.info(
      {
        request_id: request.id,
        timestamp_utc: new Date().toISOString(),
        status_code: reply.statusCode,
        response_time_ms: reply.elapsedTime,
      },
      "request completed",
    );
  });

  app.addHook("onError", async (request, _reply, error) => {
    request.log.error(
      {
        request_id: request.id,
        timestamp_utc: new Date().toISOString(),
        error,
      },
      "request failed",
    );
  });

  await app.register(healthRoutes);
  await app.register(storeRoutes);
  await app.register(userRoutes);
  await app.register(deliveryRoutes);
  await app.register(courierRouteRoutes);
  await app.register(notificationRoutes);
  await app.register(geocodingRoutes);

  return app;
}
