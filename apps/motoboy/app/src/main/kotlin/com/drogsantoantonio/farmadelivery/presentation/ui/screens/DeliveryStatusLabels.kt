package com.drogsantoantonio.farmadelivery.presentation.ui.screens

/** Traduz o status bruto da API para o texto exibido ao motoboy. */
fun deliveryStatusLabel(status: String): String {
  return DELIVERY_STATUS_LABELS[status] ?: fallbackStatusLabel(status)
}

/** Mantem status novos legiveis enquanto o app ainda nao conhece o enum. */
private fun fallbackStatusLabel(status: String): String {
  val normalized = status.trim().replace("_", " ").lowercase()
  if (normalized.isBlank()) return "Status desconhecido"
  return normalized.replaceFirstChar { it.uppercase() }
}

private val DELIVERY_STATUS_LABELS = mapOf(
  "RASCUNHO" to "Rascunho",
  "AGUARDANDO_MOTOBOY" to "Disponivel",
  "ACEITA_PELO_MOTOBOY" to "Aceita",
  "COLETADA" to "Coletada",
  "EM_ROTA" to "Em rota",
  "ENTREGUE" to "Entregue",
  "PROBLEMA" to "Problema",
  "CANCELADA" to "Cancelada",
)
