import type { DeliveryEvent } from "./types";

const eventTypeLabels: Record<string, string> = {
  CRIADA: "Criada",
  AGENDADA: "Agendada",
  REDIRECIONADA: "Redirecionada",
  ACEITA: "Aceita",
  COLETADA: "Coletada",
  SAIU_PARA_ENTREGA: "Saiu para entrega",
  ENTREGUE: "Entregue",
  PROBLEMA: "Problema",
  CANCELADA: "Cancelada",
  ROTA_RECALCULADA: "Rota recalculada",
  NOTIFICACAO_ENVIADA: "Notificacao enviada",
};

export function deliveryEventTypeLabel(type: DeliveryEvent["type"]) {
  return eventTypeLabels[type] ?? fallbackEventTypeLabel(type);
}

function fallbackEventTypeLabel(type: string) {
  const normalized = type.trim().replace(/_/g, " ").toLowerCase();
  if (!normalized) return "Evento";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}
