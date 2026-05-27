package com.drogsantoantonio.farmadelivery.presentation.ui.screens

import kotlin.test.Test
import kotlin.test.assertEquals

class MotoboyOperationalStatusTest {
  @Test
  fun `shows paused status when courier is unavailable`() {
    val status = motoboyOperationalStatus(available = false, trackingEnabled = true)

    assertEquals("Corridas paradas", status.title)
  }

  @Test
  fun `shows available status when courier can accept deliveries`() {
    val status = motoboyOperationalStatus(available = true, trackingEnabled = false)

    assertEquals("Recebendo corridas", status.title)
  }

  @Test
  fun `shows automatic GPS status without promising background location`() {
    val status = motoboyOperationalStatus(available = true, trackingEnabled = true)

    assertEquals("Recebendo corridas", status.title)
    assertEquals(
      "Novas entregas podem aparecer aqui. Sua localizacao ajuda a loja a acompanhar o atendimento.",
      status.text,
    )
  }
}
