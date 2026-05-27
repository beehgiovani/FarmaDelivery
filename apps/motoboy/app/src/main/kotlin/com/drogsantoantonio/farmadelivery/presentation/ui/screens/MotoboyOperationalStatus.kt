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
      title = "Corridas paradas",
      text = "Voce nao recebera novas entregas ate tocar em Comecar corridas.",
    )
  }

  if (trackingEnabled) {
    return MotoboyOperationalStatus(
      title = "Recebendo corridas",
      text = "Novas entregas podem aparecer aqui. Sua localizacao ajuda a loja a acompanhar o atendimento.",
    )
  }

  return MotoboyOperationalStatus(
    title = "Recebendo corridas",
    text = "Novas entregas podem aparecer aqui. Ligue o GPS ao vivo para a loja acompanhar sua posicao.",
  )
}
