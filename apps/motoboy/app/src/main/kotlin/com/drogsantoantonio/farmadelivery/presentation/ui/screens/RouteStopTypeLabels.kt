package com.drogsantoantonio.farmadelivery.presentation.ui.screens

/** Traduz o tipo da parada para o texto exibido na rota do motoboy. */
fun routeStopTypeLabel(type: String): String {
  return ROUTE_STOP_TYPE_LABELS[type] ?: fallbackRouteStopTypeLabel(type)
}

/** Mantem tipos de parada novos legiveis enquanto o app ainda nao conhece o enum. */
private fun fallbackRouteStopTypeLabel(type: String): String {
  val normalized = type.trim().replace("_", " ").lowercase()
  if (normalized.isBlank()) return "Parada"
  return normalized.replaceFirstChar { it.uppercase() }
}

private val ROUTE_STOP_TYPE_LABELS = mapOf(
  "COLETA" to "Coleta",
  "ENTREGA" to "Entrega",
)
