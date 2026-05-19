import type { FastifyReply } from "fastify";
import type { ZodError } from "zod";

/** Responde erro de validacao sempre no mesmo formato antes de qualquer regra de banco. */
export function validationError(reply: FastifyReply, error: ZodError) {
  return reply.status(400).send({
    error: "VALIDATION_ERROR",
    issues: error.issues,
  });
}
