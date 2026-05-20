package com.drogsantoantonio.farmadelivery.presentation.ui.screens

import kotlin.test.Test
import kotlin.test.assertEquals

class MotoboyOperationalStatusTest {
  @Test
  fun `shows paused status when courier is unavailable`() {
    val status = motoboyOperationalStatus(available = false, trackingEnabled = true)

    assertEquals("Pausado", status.title)
  }

  @Test
  fun `shows available status when courier can accept deliveries`() {
    val status = motoboyOperationalStatus(available = true, trackingEnabled = false)

    assertEquals("Disponivel para corridas", status.title)
  }

  @Test
  fun `shows automatic GPS status without promising background location`() {
    val status = motoboyOperationalStatus(available = true, trackingEnabled = true)

    assertEquals("Disponivel com GPS automatico", status.title)
    assertEquals(
      "Voce esta recebendo entregas e sua localizacao sera enviada enquanto o servico de GPS estiver ativo.",
      status.text,
    )
  }
}
