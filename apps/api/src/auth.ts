import type { FastifyReply, FastifyRequest } from "fastify";
import { createHmac, timingSafeEqual } from "node:crypto";

export type SessionPayload = {
  sub: string;
  role: string;
  exp: number;
  storeId?: string | null;
  courierId?: string | null;
};

export type SessionRole = "ADMIN" | "GERENTE" | "BALCONISTA_CAIXA" | "MOTOBOY";

/** Valida bearer token e papel antes da rota encostar no banco ou em servicos externos. */
export async function requireAuth(request: FastifyRequest, reply: FastifyReply, roles?: SessionRole[]) {
  const token = readBearerToken(request.headers.authorization);
  const payload = token ? verifySessionToken(token) : null;

  if (!payload) {
    reply.status(401).send({
      error: "UNAUTHENTICATED",
      message: "Entre novamente para continuar.",
    });
    return null;
  }

  if (roles && !roles.includes(payload.role as (typeof roles)[number])) {
    reply.status(403).send({
      error: "FORBIDDEN",
      message: "Seu usuario nao tem permissao para esta acao.",
    });
    return null;
  }

  return payload;
}

/** Assina a sessao interna usada pelos apps depois do login validado pela API. */
export function signSessionToken(payload: SessionPayload) {
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = createHmac("sha256", sessionSecret()).update(encodedPayload).digest("base64url");
  return `${encodedPayload}.${signature}`;
}

/** Verifica assinatura, formato e expiracao para impedir sessao adulterada ou vencida. */
export function verifySessionToken(token: string): SessionPayload | null {
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return null;

  const expected = createHmac("sha256", sessionSecret()).update(encodedPayload).digest("base64url");
  if (!safeEqual(signature, expected)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as SessionPayload;
    if (!payload.sub || !payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Extrai apenas tokens no formato Authorization: Bearer <token>. */
export function readBearerToken(authorization?: string) {
  if (!authorization?.startsWith("Bearer ")) return null;
  return authorization.slice("Bearer ".length).trim();
}

/** Codifica payload em base64url para compor o token assinado. */
function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

/** Compara assinaturas sem vazar diferenca de tempo em strings do mesmo tamanho. */
function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Define o segredo da sessao, usando chave local apenas para desenvolvimento. */
function sessionSecret() {
  return readEnv("API_SESSION_SECRET") ?? readEnv("SUPABASE_JWT_SECRET") ?? "farmadelivery-local-session-secret";
}

/** Le variavel de ambiente aceitando valores colados com aspas no .env. */
function readEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) return undefined;
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}
