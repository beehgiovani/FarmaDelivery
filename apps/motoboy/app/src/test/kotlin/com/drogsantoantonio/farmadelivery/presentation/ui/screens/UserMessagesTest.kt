package com.drogsantoantonio.farmadelivery.presentation.ui.screens

import kotlin.test.Test
import kotlin.test.assertEquals

class UserMessagesTest {
  @Test
  fun `keeps readable courier facing errors`() {
    assertEquals(
      "Ative sua disponibilidade antes de aceitar corridas.",
      courierFacingError(
        IllegalStateException("Ative sua disponibilidade antes de aceitar corridas."),
        "Nao foi possivel atualizar agora.",
      ),
    )
  }

  @Test
  fun `hides technical backend and connection errors`() {
    val fallback = "Nao foi possivel atualizar agora."

    assertEquals(fallback, courierFacingError(IllegalStateException("HTTP 500 Internal Server Error"), fallback))
    assertEquals(fallback, courierFacingError(IllegalStateException("java.net.UnknownHostException"), fallback))
    assertEquals(fallback, courierFacingError(IllegalStateException("connect ECONNREFUSED 127.0.0.1:3333"), fallback))
    assertEquals(fallback, courierFacingError(IllegalStateException("timeout after 12000ms"), fallback))
  }

  @Test
  fun `uses fallback for blank failures`() {
    assertEquals(
      "Nao foi possivel concluir agora.",
      courierFacingError(IllegalStateException("   "), "Nao foi possivel concluir agora."),
    )
  }
}
