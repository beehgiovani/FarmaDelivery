import type { FastifyInstance } from "fastify";
import { verifySessionToken } from "./auth";

export type LiveEventType = "deliveries" | "couriers" | "routes";

export type LiveEvent = {
  type: LiveEventType;
  reason: string;
  at: string;
};

type LiveClient = {
  id: string;
  send: (event: LiveEvent) => void;
  close: () => void;
};

const clients = new Map<string, LiveClient>();

export async function liveEventRoutes(app: FastifyInstance) {
  app.get("/live/events", async (request, reply) => {
    const query = request.query as { token?: string };
    const payload = query.token ? verifySessionToken(query.token) : null;
    if (!payload) {
      return reply.status(401).send({
        error: "UNAUTHENTICATED",
        message: "Entre novamente para continuar.",
      });
    }

    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });

    const clientId = `${payload.sub}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
    const heartbeat = setInterval(() => {
      reply.raw.write(`event: ping\ndata: ${JSON.stringify({ at: new Date().toISOString() })}\n\n`);
    }, 25_000);

    const client: LiveClient = {
      id: clientId,
      send: (event) => {
        reply.raw.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
      },
      close: () => {
        clearInterval(heartbeat);
        clients.delete(clientId);
      },
    };

    clients.set(clientId, client);
    client.send({ type: "deliveries", reason: "connected", at: new Date().toISOString() });

    request.raw.on("close", client.close);
  });
}

export function broadcastLiveEvent(type: LiveEventType, reason: string) {
  const event: LiveEvent = {
    type,
    reason,
    at: new Date().toISOString(),
  };

  for (const client of clients.values()) {
    client.send(event);
  }
}
