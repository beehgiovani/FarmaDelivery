package com.drogsantoantonio.farmadelivery.presentation.ui.screens

import kotlin.test.Test
import kotlin.test.assertEquals

class LocationActionLabelsTest {
  @Test
  fun `labels availability action by current state`() {
    assertEquals("Comecar corridas", availabilityActionLabel(available = false, loading = false))
    assertEquals("Parar corridas", availabilityActionLabel(available = true, loading = false))
  }

  @Test
  fun `labels availability action while saving`() {
    assertEquals("Salvando...", availabilityActionLabel(available = true, loading = true))
  }

  @Test
  fun `labels automatic location action without duplicating pause wording`() {
    assertEquals("Ligar GPS ao vivo", automaticLocationActionLabel(trackingEnabled = false))
    assertEquals("Parar GPS ao vivo", automaticLocationActionLabel(trackingEnabled = true))
  }

  @Test
  fun `labels manual location action`() {
    assertEquals("Enviar minha posicao", sendLocationActionLabel(loading = false))
    assertEquals("Enviando...", sendLocationActionLabel(loading = true))
  }
}
