package com.drogsantoantonio.farmadelivery.presentation.ui.screens

import kotlin.test.Test
import kotlin.test.assertEquals

class DeliveryPriorityLabelsTest {
  @Test
  fun `maps known delivery priorities to readable labels`() {
    assertEquals("Normal", deliveryPriorityLabel("NORMAL"))
    assertEquals("Urgente", deliveryPriorityLabel("URGENTE"))
    assertEquals("Retorno", deliveryPriorityLabel("RETORNO"))
  }

  @Test
  fun `formats unknown delivery priorities without raw underscores`() {
    assertEquals("Muito urgente", deliveryPriorityLabel("MUITO_URGENTE"))
  }

  @Test
  fun `uses a safe fallback for blank delivery priorities`() {
    assertEquals("Prioridade desconhecida", deliveryPriorityLabel("   "))
  }
}
