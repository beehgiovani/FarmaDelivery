package com.drogsantoantonio.farmadelivery.presentation.ui.screens

data class MotoboyOperationalStatus(
  val title: String,
  val text: String,
)

fun motoboyOperationalStatus(
  available: Boolean,
  trackingEnabled: Boolean,
): MotoboyOperationalStatus {
  if (!available) {
    return MotoboyOperationalStatus(
      title = "Pausado",
      text = "Novas entregas nao serao direcionadas para voce ate ativar a disponibilidade.",
    )
  }

  if (trackingEnabled) {
    return MotoboyOperationalStatus(
      title = "Disponivel com GPS automatico",
      text = "Voce esta recebendo entregas e sua localizacao sera enviada enquanto o servico de GPS estiver ativo.",
    )
  }

  return MotoboyOperationalStatus(
    title = "Disponivel para corridas",
    text = "Voce pode aceitar entregas. Ligue o Auto para enviar localizacao sem apertar Enviar toda vez.",
  )
}
