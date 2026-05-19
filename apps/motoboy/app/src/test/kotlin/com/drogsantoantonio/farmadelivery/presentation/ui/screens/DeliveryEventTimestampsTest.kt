package com.drogsantoantonio.farmadelivery.presentation.ui.screens

import kotlin.test.Test
import kotlin.test.assertEquals

class DeliveryEventTimestampsTest {
  @Test
  fun `formats ISO delivery event timestamps for display`() {
    assertEquals("15/05 09:30", deliveryEventTimestampLabel("2026-05-15T12:30:00.000Z"))
  }

  @Test
  fun `falls back to a compact raw timestamp when parsing fails`() {
    assertEquals("2026-05-15 12:30", deliveryEventTimestampLabel("2026-05-15T12:30 sem timezone"))
  }
}
