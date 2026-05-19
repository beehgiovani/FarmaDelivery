package com.drogsantoantonio.farmadelivery.presentation.ui.screens

import com.drogsantoantonio.farmadelivery.data.models.DeliveryEventActorDto
import com.drogsantoantonio.farmadelivery.data.models.DeliveryEventDto
import kotlin.test.Test
import kotlin.test.assertEquals

class DeliveryEventActorsTest {
  @Test
  fun `uses the event actor name when present`() {
    assertEquals(
      "Balconista Teste",
      deliveryEventActorLabel(event(actorName = "Balconista Teste")),
    )
  }

  @Test
  fun `trims event actor names`() {
    assertEquals(
      "Motoboy Teste",
      deliveryEventActorLabel(event(actorName = "  Motoboy Teste  ")),
    )
  }

  @Test
  fun `returns null when the event has no actor name`() {
    assertEquals(null, deliveryEventActorLabel(event(actorName = null)))
    assertEquals(null, deliveryEventActorLabel(event(actorName = "   ")))
  }

  private fun event(actorName: String?): DeliveryEventDto {
    return DeliveryEventDto(
      id = "event-1",
      deliveryId = "delivery-1",
      type = "CRIADA",
      actor = actorName?.let {
        DeliveryEventActorDto(
          id = "user-1",
          name = it,
          role = "MOTOBOY",
        )
      },
      createdAt = "2026-05-15T12:00:00.000Z",
    )
  }
}
