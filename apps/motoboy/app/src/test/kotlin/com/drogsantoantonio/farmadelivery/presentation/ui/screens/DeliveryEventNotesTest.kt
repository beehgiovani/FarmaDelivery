package com.drogsantoantonio.farmadelivery.presentation.ui.screens

import com.drogsantoantonio.farmadelivery.data.models.DeliveryEventDto
import kotlin.test.Test
import kotlin.test.assertEquals

class DeliveryEventNotesTest {
  @Test
  fun `trims delivery event notes before rendering`() {
    assertEquals("entregue na portaria", deliveryEventNotesText(event(notes = "  entregue na portaria  ")))
  }

  @Test
  fun `returns null for blank or missing delivery event notes`() {
    assertEquals(null, deliveryEventNotesText(event(notes = "   ")))
    assertEquals(null, deliveryEventNotesText(event(notes = null)))
  }

  private fun event(notes: String?): DeliveryEventDto {
    return DeliveryEventDto(
      id = "event-1",
      deliveryId = "delivery-1",
      type = "CRIADA",
      notes = notes,
      createdAt = "2026-05-15T12:00:00.000Z",
    )
  }
}
