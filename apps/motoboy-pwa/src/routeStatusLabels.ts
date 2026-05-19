const ROUTE_STATUS_LABELS: Record<string, string> = {
  ABERTA: "Aberta",
  EM_ANDAMENTO: "Em andamento",
  FINALIZADA: "Finalizada",
  CANCELADA: "Cancelada",
};

export function routeStatusLabel(status: string): string {
  return ROUTE_STATUS_LABELS[status] ?? fallbackRouteStatusLabel(status);
}

function fallbackRouteStatusLabel(status: string): string {
  const normalized = status.trim().replaceAll("_", " ").toLowerCase();
  if (!normalized) return "Status desconhecido";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}
