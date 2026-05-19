package com.drogsantoantonio.farmadelivery.presentation.ui.screens

import kotlin.test.Test
import kotlin.test.assertEquals

class DeliveryStatusLabelsTest {
  @Test
  fun `maps known delivery statuses to readable labels`() {
    assertEquals("Disponivel", deliveryStatusLabel("AGUARDANDO_MOTOBOY"))
    assertEquals("Aceita", deliveryStatusLabel("ACEITA_PELO_MOTOBOY"))
    assertEquals("Em rota", deliveryStatusLabel("EM_ROTA"))
  }

  @Test
  fun `formats unknown delivery statuses without raw underscores`() {
    assertEquals("Novo status", deliveryStatusLabel("NOVO_STATUS"))
  }

  @Test
  fun `uses a safe fallback for blank delivery statuses`() {
    assertEquals("Status desconhecido", deliveryStatusLabel("   "))
  }
}
