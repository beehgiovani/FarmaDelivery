package com.drogsantoantonio.farmadelivery.presentation.ui.screens

/** Traduz o status da rota para texto curto na tela de rota atual. */
fun routeStatusLabel(status: String): String {
  return ROUTE_STATUS_LABELS[status] ?: fallbackRouteStatusLabel(status)
}

/** Mantem status de rota novos legiveis enquanto o app ainda nao conhece o enum. */
private fun fallbackRouteStatusLabel(status: String): String {
  val normalized = status.trim().replace("_", " ").lowercase()
  if (normalized.isBlank()) return "Status desconhecido"
  return normalized.replaceFirstChar { it.uppercase() }
}

private val ROUTE_STATUS_LABELS = mapOf(
  "ABERTA" to "Aberta",
  "EM_ANDAMENTO" to "Em andamento",
  "FINALIZADA" to "Finalizada",
  "CANCELADA" to "Cancelada",
)
