package com.drogsantoantonio.farmadelivery.presentation.ui.screens

import kotlin.test.Test
import kotlin.test.assertEquals

class DeliveryCardDateLabelsTest {
  @Test
  fun `formats ISO delivery card dates in Sao Paulo timezone`() {
    assertEquals("15/05 09:30", deliveryCardDateLabel("2026-05-15T12:30:00.000Z"))
  }

  @Test
  fun `falls back to a compact raw timestamp when parsing fails`() {
    assertEquals("2026-05-15 12:30", deliveryCardDateLabel("2026-05-15T12:30 sem timezone"))
  }

  @Test
  fun `returns an empty label for blank delivery card dates`() {
    assertEquals("", deliveryCardDateLabel("   "))
  }
}
