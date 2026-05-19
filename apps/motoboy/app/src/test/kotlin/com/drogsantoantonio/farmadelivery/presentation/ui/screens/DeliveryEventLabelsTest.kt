package com.drogsantoantonio.farmadelivery.presentation.ui.screens

import kotlin.test.Test
import kotlin.test.assertEquals

class DeliveryEventLabelsTest {
  @Test
  fun `maps known delivery event types to readable labels`() {
    assertEquals("Saiu para entrega", deliveryEventTypeLabel("SAIU_PARA_ENTREGA"))
    assertEquals("Rota recalculada", deliveryEventTypeLabel("ROTA_RECALCULADA"))
    assertEquals("Notificacao enviada", deliveryEventTypeLabel("NOTIFICACAO_ENVIADA"))
  }

  @Test
  fun `formats unknown delivery event types without exposing raw underscores`() {
    assertEquals("Evento novo", deliveryEventTypeLabel("EVENTO_NOVO"))
  }

  @Test
  fun `uses a safe fallback for blank delivery event types`() {
    assertEquals("Evento", deliveryEventTypeLabel("   "))
  }
}
