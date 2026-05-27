package com.drogsantoantonio.farmadelivery.presentation.ui.screens

import kotlin.test.Test
import kotlin.test.assertEquals

class LocationWatchMessageTest {
  @Test
  fun `warns while waiting first automatic location`() {
    assertEquals(
      "Aguardando o primeiro envio automatico de localizacao.",
      locationWatchMessage(
        feedback = null,
        tracking = true,
        trackingAllowed = true,
        lastLocationSentAt = null,
        now = 1000L,
      ),
    )
  }

  @Test
  fun `shows recent automatic location age`() {
    assertEquals(
      "GPS ao vivo atualizado ha 30s.",
      locationWatchMessage(
        feedback = null,
        tracking = true,
        trackingAllowed = true,
        lastLocationSentAt = 70_000L,
        now = 100_000L,
      ),
    )
  }

  @Test
  fun `warns when location is stale`() {
    assertEquals(
      "A loja esta sem localizacao nova ha 90s. Mantenha o app aberto e confira o GPS.",
      locationWatchMessage(
        feedback = null,
        tracking = true,
        trackingAllowed = true,
        lastLocationSentAt = 10_000L,
        now = 100_000L,
      ),
    )
  }
}
