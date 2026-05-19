const DELIVERY_STATUS_LABELS: Record<string, string> = {
  RASCUNHO: "Rascunho",
  AGUARDANDO_MOTOBOY: "Disponivel",
  ACEITA_PELO_MOTOBOY: "Aceita",
  COLETADA: "Coletada",
  EM_ROTA: "Em rota",
  ENTREGUE: "Entregue",
  PROBLEMA: "Problema",
  CANCELADA: "Cancelada",
};

export function deliveryStatusLabel(status: string): string {
  return DELIVERY_STATUS_LABELS[status] ?? fallbackStatusLabel(status);
}

function fallbackStatusLabel(status: string): string {
  const normalized = status.trim().replaceAll("_", " ").toLowerCase();
  if (!normalized) return "Status desconhecido";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}
