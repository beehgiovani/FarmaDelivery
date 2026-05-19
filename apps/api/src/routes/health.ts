import type { FastifyInstance } from "fastify";
import { checkDeliveryProofStorage } from "../deliveryProofStorage";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/health", async () => {
    const deliveryProofStorage = await checkDeliveryProofStorage();

    return {
      ok: deliveryProofStorage.writable,
      service: "farmadelivery-api",
      dependencies: {
        deliveryProofStorage,
      },
    };
  });
}
