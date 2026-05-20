const technicalTerms = [
  "api",
  "backend",
  "database",
  "supabase",
  "rest",
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

export function userFacingError(error: unknown, fallback = "Nao foi possivel concluir agora.") {
  const message = error instanceof Error ? error.message.trim() : "";
  if (!message) return fallback;
  const normalized = message.toLowerCase();
  if (technicalTerms.some((term) => normalized.includes(term))) return fallback;
  return message;
}
