import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/** Gera hash scrypt com salt por usuario para senha criada ou resetada pelo admin. */
export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

/** Valida senha usando comparacao segura contra tempo quando o hash tem formato esperado. */
export function verifyPassword(password: string, passwordHash: string) {
  const [algorithm, salt, storedHash] = passwordHash.split(":");
  if (algorithm !== "scrypt" || !salt || !storedHash) return false;

  const calculated = Buffer.from(scryptSync(password, salt, 64).toString("hex"), "hex");
  const stored = Buffer.from(storedHash, "hex");
  if (calculated.length !== stored.length) return false;
  return timingSafeEqual(calculated, stored);
}
