const technicalTerms = [
  "api",
  "banco",
  "database",
  "supabase",
  "rest",
  "prisma",
  "token",
  "jwt",
  "fetch",
  "network",
  "timeout",
  "econnrefused",
  "etimedout",
  "enotfound",
  "payload",
  "status",
  "500",
  "404",
  "403",
  "401",
];

export function userFacingError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message.trim() : "";
  if (!message) return fallback;
  const normalized = message.toLowerCase();
  if (technicalTerms.some((term) => normalized.includes(term))) return fallback;
  return message;
}
