package com.drogsantoantonio.farmadelivery.presentation.ui.screens

/** Traduz a prioridade da API para o texto exibido no card da entrega. */
fun deliveryPriorityLabel(priority: String): String {
  return DELIVERY_PRIORITY_LABELS[priority] ?: fallbackPriorityLabel(priority)
}

/** Mantem prioridades novas legiveis enquanto o app ainda nao conhece o enum. */
private fun fallbackPriorityLabel(priority: String): String {
  val normalized = priority.trim().replace("_", " ").lowercase()
  if (normalized.isBlank()) return "Prioridade desconhecida"
  return normalized.replaceFirstChar { it.uppercase() }
}

private val DELIVERY_PRIORITY_LABELS = mapOf(
  "NORMAL" to "Normal",
  "URGENTE" to "Urgente",
  "RETORNO" to "Retorno",
)
