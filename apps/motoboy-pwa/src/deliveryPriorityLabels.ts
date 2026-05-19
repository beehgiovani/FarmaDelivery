const DELIVERY_PRIORITY_LABELS: Record<string, string> = {
  NORMAL: "Normal",
  URGENTE: "Urgente",
  RETORNO: "Retorno",
};

export function deliveryPriorityLabel(priority: string): string {
  return DELIVERY_PRIORITY_LABELS[priority] ?? fallbackPriorityLabel(priority);
}

function fallbackPriorityLabel(priority: string): string {
  const normalized = priority.trim().replaceAll("_", " ").toLowerCase();
  if (!normalized) return "Prioridade desconhecida";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}
