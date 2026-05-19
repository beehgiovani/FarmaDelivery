package com.drogsantoantonio.farmadelivery.presentation.ui.screens

import com.drogsantoantonio.farmadelivery.data.models.DeliveryDto
import kotlin.test.Test
import kotlin.test.assertEquals

class DeliverySectionsTest {
  @Test
  fun `groups only waiting deliveries as available`() {
    val sections = deliverySections(
      listOf(
        delivery(id = "waiting", status = "AGUARDANDO_MOTOBOY"),
        delivery(id = "accepted", status = "ACEITA_PELO_MOTOBOY"),
      ),
    )

    assertEquals(listOf("waiting"), sections.available.map { it.id })
  }

  @Test
  fun `groups only operational in-progress deliveries as active`() {
    val sections = deliverySections(
      listOf(
        delivery(id = "accepted", status = "ACEITA_PELO_MOTOBOY"),
        delivery(id = "collected", status = "COLETADA"),
        delivery(id = "route", status = "EM_ROTA"),
        delivery(id = "problem", status = "PROBLEMA"),
        delivery(id = "delivered", status = "ENTREGUE"),
        delivery(id = "canceled", status = "CANCELADA"),
        delivery(id = "draft", status = "RASCUNHO"),
      ),
    )

    assertEquals(listOf("accepted", "collected", "route", "problem"), sections.active.map { it.id })
  }

  private fun delivery(id: String, status: String): DeliveryDto {
    return DeliveryDto(
      id = id,
      publicCode = "FD-$id",
      store = "Drogaria Santo Antonio",
      customer = "Cliente Teste",
      phone = "11999999999",
      address = "Rua Teste, 123",
      status = status,
      courier = "",
      createdAt = "2026-05-15T00:00:00.000Z",
      priority = "NORMAL",
    )
  }
}
