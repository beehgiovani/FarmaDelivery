import { createApp } from "./app";
import { prisma } from "./prisma";

const app = await createApp();
const port = Number(process.env.API_PORT ?? 3333);

try {
  await app.listen({ port, host: "0.0.0.0" });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}

const close = async () => {
  await prisma.$disconnect();
  await app.close();
  process.exit(0);
};

process.on("SIGINT", close);
process.on("SIGTERM", close);
