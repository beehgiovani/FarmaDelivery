const ROUTE_STOP_TYPE_LABELS: Record<string, string> = {
  COLETA: "Coleta",
  ENTREGA: "Entrega",
};

export function routeStopTypeLabel(type: string): string {
  return ROUTE_STOP_TYPE_LABELS[type] ?? fallbackRouteStopTypeLabel(type);
}

function fallbackRouteStopTypeLabel(type: string): string {
  const normalized = type.trim().replaceAll("_", " ").toLowerCase();
  if (!normalized) return "Parada";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}
