package com.drogsantoantonio.farmadelivery.presentation.ui.screens

import com.drogsantoantonio.farmadelivery.data.models.DeliveryDto
import kotlin.test.Test
import kotlin.test.assertEquals

class DeliveryAutoRefreshTest {
  @Test
  fun `does not notify on the first delivery snapshot`() {
    val notice = deliveryAutoRefreshNotice(
      previous = emptyList(),
      next = listOf(delivery(id = "new")),
      hasPreviousSnapshot = false,
    )

    assertEquals(null, notice)
  }

  @Test
  fun `notifies when delivery becomes available after an empty loaded state`() {
    val notice = deliveryAutoRefreshNotice(
      previous = emptyList(),
      next = listOf(delivery(id = "new", publicCode = "AST-20260527-004", storeDailyNumber = 4)),
      hasPreviousSnapshot = true,
    )

    assertEquals("Nova entrega: N. dia 004.", notice)
  }

  @Test
  fun `does not notify when available delivery was already visible`() {
    val previous = listOf(delivery(id = "same"))
    val next = listOf(delivery(id = "same"))

    assertEquals(null, deliveryAutoRefreshNotice(previous, next, hasPreviousSnapshot = true))
  }

  @Test
  fun `counts multiple new available deliveries`() {
    val notice = deliveryAutoRefreshNotice(
      previous = listOf(delivery(id = "old")),
      next = listOf(delivery(id = "old"), delivery(id = "new-1"), delivery(id = "new-2")),
      hasPreviousSnapshot = true,
    )

    assertEquals("2 novas entregas.", notice)
  }

  private fun delivery(
    id: String,
    publicCode: String = "FD-$id",
    storeDailyNumber: Int? = null,
  ): DeliveryDto {
    return DeliveryDto(
      id = id,
      publicCode = publicCode,
      storeDailyNumber = storeDailyNumber,
      store = "Drogaria Santo Antonio",
      customer = "Cliente Teste",
      phone = "11999999999",
      address = "Rua Teste, 123",
      status = "AGUARDANDO_MOTOBOY",
      courier = "",
      createdAt = "2026-05-27T00:00:00.000Z",
      priority = "NORMAL",
    )
  }
}
