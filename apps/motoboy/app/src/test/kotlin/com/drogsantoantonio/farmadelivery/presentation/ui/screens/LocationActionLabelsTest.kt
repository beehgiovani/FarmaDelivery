package com.drogsantoantonio.farmadelivery.presentation.ui.screens

import kotlin.test.Test
import kotlin.test.assertEquals

class LocationActionLabelsTest {
  @Test
  fun `labels availability action by current state`() {
    assertEquals("Ativar corridas", availabilityActionLabel(available = false, loading = false))
    assertEquals("Pausar corridas", availabilityActionLabel(available = true, loading = false))
  }

  @Test
  fun `labels availability action while saving`() {
    assertEquals("Salvando...", availabilityActionLabel(available = true, loading = true))
  }

  @Test
  fun `labels automatic location action without duplicating pause wording`() {
    assertEquals("Ligar auto", automaticLocationActionLabel(trackingEnabled = false))
    assertEquals("Parar auto", automaticLocationActionLabel(trackingEnabled = true))
  }

  @Test
  fun `labels manual location action`() {
    assertEquals("Enviar GPS", sendLocationActionLabel(loading = false))
    assertEquals("Enviando...", sendLocationActionLabel(loading = true))
  }
}
