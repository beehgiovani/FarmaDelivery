package com.drogsantoantonio.farmadelivery.presentation.ui.screens

/** Traduz o tipo de evento do historico para texto curto no app do motoboy. */
fun deliveryEventTypeLabel(type: String): String {
  return EVENT_TYPE_LABELS[type] ?: fallbackEventTypeLabel(type)
}

/** Mantem eventos novos legiveis sem expor underline ou caixa alta tecnica. */
private fun fallbackEventTypeLabel(type: String): String {
  val normalized = type.trim().replace("_", " ").lowercase()
  if (normalized.isBlank()) return "Evento"
  return normalized.replaceFirstChar { it.uppercase() }
}

private val EVENT_TYPE_LABELS = mapOf(
  "CRIADA" to "Criada",
  "AGENDADA" to "Agendada",
  "REDIRECIONADA" to "Redirecionada",
  "ACEITA" to "Aceita",
  "COLETADA" to "Coletada",
  "SAIU_PARA_ENTREGA" to "Saiu para entrega",
  "ENTREGUE" to "Entregue",
  "PROBLEMA" to "Problema",
  "CANCELADA" to "Cancelada",
  "ROTA_RECALCULADA" to "Rota recalculada",
  "NOTIFICACAO_ENVIADA" to "Notificacao enviada",
)
