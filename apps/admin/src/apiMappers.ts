import type { DeliveryDeadlineTier, DeliveryPriority, DeliveryStatus } from "./types";

export type ApiDeliveryStatus =
  | "RASCUNHO"
  | "AGUARDANDO_MOTOBOY"
  | "ACEITA_PELO_MOTOBOY"
  | "COLETADA"
  | "EM_ROTA"
  | "ENTREGUE"
  | "PROBLEMA"
  | "CANCELADA";

export type ApiDeliveryPriority = "NORMAL" | "URGENTE" | "RETORNO";

export type ApiDeliveryDeadlineTier = "PERTO" | "MEDIO" | "LONGE";

export type ApiCourierRouteStatus = "ABERTA" | "EM_ANDAMENTO" | "FINALIZADA" | "CANCELADA";

export type ApiRouteStopStatus = "PENDENTE" | "CONCLUIDA" | "PULADA" | "CANCELADA";

export type ApiRouteStopType = "COLETA" | "ENTREGA";

export type ApiDeliveryEventType =
  | "CRIADA"
  | "AGENDADA"
  | "REDIRECIONADA"
  | "ACEITA"
  | "COLETADA"
  | "ROTA_RECALCULADA"
  | "OCORRENCIA_REGISTRADA"
  | "ENTREGUE"
  | "CANCELADA"
  | "NOTIFICACAO_ENVIADA";

/** Traduz o status bruto da API para o texto usado no painel, mantendo a tela desacoplada dos enums do banco. */
export function mapDeliveryStatus(status: ApiDeliveryStatus): DeliveryStatus {
  const map: Record<ApiDeliveryStatus, DeliveryStatus> = {
    RASCUNHO: "Aguardando",
    AGUARDANDO_MOTOBOY: "Aguardando",
    ACEITA_PELO_MOTOBOY: "Aceita",
    COLETADA: "Coletada",
    EM_ROTA: "Em rota",
    ENTREGUE: "Entregue",
    PROBLEMA: "Problema",
    CANCELADA: "Cancelada",
  };

  return map[status];
}

/** Traduz a prioridade da API para o mesmo vocabulário operacional exibido para admin e loja. */
export function mapDeliveryPriority(priority: ApiDeliveryPriority): DeliveryPriority {
  const map: Record<ApiDeliveryPriority, DeliveryPriority> = {
    NORMAL: "Normal",
    URGENTE: "Urgente",
    RETORNO: "Retorno",
  };

  return map[priority];
}

/** Converte o prazo manual da API para o label usado nos filtros e cards do painel. */
export function mapDeliveryDeadlineTier(tier: ApiDeliveryDeadlineTier): DeliveryDeadlineTier {
  const map: Record<ApiDeliveryDeadlineTier, DeliveryDeadlineTier> = {
    PERTO: "Perto",
    MEDIO: "Medio",
    LONGE: "Longe",
  };

  return map[tier];
}

/** Volta o prazo manual escolhido no painel para o valor esperado pelo contrato da API. */
export function apiDeadlineTierFromDeliveryDeadlineTier(tier: DeliveryDeadlineTier): ApiDeliveryDeadlineTier {
  const map: Record<DeliveryDeadlineTier, ApiDeliveryDeadlineTier> = {
    Perto: "PERTO",
    Medio: "MEDIO",
    Longe: "LONGE",
  };

  return map[tier];
}

/** Volta o status filtrado no painel para o enum aceito pela API. */
export function apiStatusFromDeliveryStatus(status: DeliveryStatus) {
  const map: Record<DeliveryStatus, ApiDeliveryStatus> = {
    Aguardando: "AGUARDANDO_MOTOBOY",
    Aceita: "ACEITA_PELO_MOTOBOY",
    Coletada: "COLETADA",
    "Em rota": "EM_ROTA",
    Entregue: "ENTREGUE",
    Problema: "PROBLEMA",
    Cancelada: "CANCELADA",
  };
  return map[status];
}

/** Volta a prioridade filtrada no painel para o enum aceito pela API. */
export function apiPriorityFromDeliveryPriority(priority: DeliveryPriority) {
  const map: Record<DeliveryPriority, ApiDeliveryPriority> = {
    Normal: "NORMAL",
    Urgente: "URGENTE",
    Retorno: "RETORNO",
  };
  return map[priority];
}

/** Exibe status vindo de relatorio/exportacao com fallback legivel para valores novos. */
export function mapRawStatusLabel(status: string) {
  const map: Record<string, DeliveryStatus> = {
    RASCUNHO: "Aguardando",
    AGUARDANDO_MOTOBOY: "Aguardando",
    ACEITA_PELO_MOTOBOY: "Aceita",
    COLETADA: "Coletada",
    EM_ROTA: "Em rota",
    ENTREGUE: "Entregue",
    PROBLEMA: "Problema",
    CANCELADA: "Cancelada",
  };

  return map[status] ?? status;
}

/** Exibe prioridade vinda de relatorio/exportacao sem quebrar quando a API evoluir. */
export function mapRawPriorityLabel(priority: string) {
  const map: Record<string, DeliveryPriority> = {
    NORMAL: "Normal",
    URGENTE: "Urgente",
    RETORNO: "Retorno",
  };

  return map[priority] ?? priority;
}

/** Exibe prazo manual cru com fallback seguro para relatórios antigos ou valores novos. */
export function mapRawDeadlineTierLabel(tier: string) {
  const map: Record<string, DeliveryDeadlineTier> = {
    PERTO: "Perto",
    MEDIO: "Medio",
    LONGE: "Longe",
  };

  return map[tier] ?? fallbackRawLabel(tier, "Prazo desconhecido");
}

/** Exibe status de rota com ou sem prefixo, conforme o contexto visual pedir. */
export function mapRawRouteStatusLabel(status: string, options?: { withPrefix?: boolean }) {
  const labels: Record<ApiCourierRouteStatus, string> = {
    ABERTA: options?.withPrefix ? "Rota aberta" : "Aberta",
    EM_ANDAMENTO: options?.withPrefix ? "Rota em andamento" : "Em andamento",
    FINALIZADA: options?.withPrefix ? "Rota finalizada" : "Finalizada",
    CANCELADA: options?.withPrefix ? "Rota cancelada" : "Cancelada",
  };

  return labels[status as ApiCourierRouteStatus] ?? fallbackRawLabel(status, "Status desconhecido");
}

/** Exibe o estado operacional de cada parada dentro da rota do motoboy. */
export function mapRawRouteStopStatusLabel(status: string) {
  const labels: Record<ApiRouteStopStatus, string> = {
    PENDENTE: "Pendente",
    CONCLUIDA: "Concluida",
    PULADA: "Pulada",
    CANCELADA: "Cancelada",
  };

  return labels[status as ApiRouteStopStatus] ?? fallbackRawLabel(status, "Status desconhecido");
}

/** Exibe o tipo da parada mantendo fallback neutro para tipos ainda nao conhecidos pelo painel. */
export function mapRawRouteStopTypeLabel(type: string) {
  const labels: Record<ApiRouteStopType, string> = {
    COLETA: "Coleta",
    ENTREGA: "Entrega",
  };

  return labels[type as ApiRouteStopType] ?? fallbackRawLabel(type, "Parada");
}

/** Traduz eventos auditaveis da entrega para leitura humana no historico. */
export function mapRawDeliveryEventTypeLabel(type: string) {
  const labels: Record<ApiDeliveryEventType, string> = {
    CRIADA: "Entrega criada",
    AGENDADA: "Entrega agendada",
    REDIRECIONADA: "Redirecionada",
    ACEITA: "Aceita pelo motoboy",
    COLETADA: "Coletada",
    ROTA_RECALCULADA: "Saiu para rota",
    OCORRENCIA_REGISTRADA: "Problema registrado",
    ENTREGUE: "Entregue",
    CANCELADA: "Cancelada",
    NOTIFICACAO_ENVIADA: "Notificacao enviada",
  };

  return labels[type as ApiDeliveryEventType] ?? fallbackRawLabel(type, "Evento desconhecido");
}

/** Normaliza enums crus para um texto amigavel sem expor underline ou caixa alta tecnica. */
function fallbackRawLabel(value: string, emptyLabel: string) {
  const normalized = value.trim().replaceAll("_", " ").toLowerCase();
  if (!normalized) return emptyLabel;
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}
