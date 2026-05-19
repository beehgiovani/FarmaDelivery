package com.drogsantoantonio.farmadelivery.presentation.ui.screens

import kotlin.test.Test
import kotlin.test.assertEquals

class DeliveryDisplayCodeTest {
  @Test
  fun `formats store daily number with leading zeros`() {
    assertEquals("N. dia 009", deliveryDailyNumberLabel(9))
  }

  @Test
  fun `uses daily number as primary label when available`() {
    assertEquals("N. dia 009", deliveryPrimaryCodeLabel("AST-20260517-009", 9))
  }

  @Test
  fun `falls back to public code for older deliveries`() {
    assertEquals(null, deliveryDailyNumberLabel(null))
    assertEquals("ENT-000001", deliveryPrimaryCodeLabel("ENT-000001", null))
  }
}
