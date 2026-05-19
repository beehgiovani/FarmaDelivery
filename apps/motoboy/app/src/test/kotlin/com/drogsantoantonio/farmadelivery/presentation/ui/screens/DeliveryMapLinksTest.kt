package com.drogsantoantonio.farmadelivery.presentation.ui.screens

import com.drogsantoantonio.farmadelivery.data.models.CoordinatesDto
import com.drogsantoantonio.farmadelivery.data.models.DeliveryDto
import kotlin.test.Test
import kotlin.test.assertEquals

class DeliveryMapLinksTest {
  @Test
  fun `uses delivery coordinates when opening the map`() {
    val uri = deliveryMapUriString(
      delivery(
        address = "Rua Teste, 123",
        coordinates = CoordinatesDto(lat = -24.003825377135037, lng = -46.27390399967142),
      ),
    )

    assertEquals("geo:0,0?q=-24.003825377135037%2C-46.27390399967142", uri)
  }

  @Test
  fun `uses trimmed delivery address when coordinates are unavailable`() {
    val uri = deliveryMapUriString(
      delivery(
        address = "  Rua Teste, 123  ",
        coordinates = null,
      ),
    )

    assertEquals("geo:0,0?q=Rua%20Teste%2C%20123", uri)
  }

  @Test
  fun `does not build map uri without coordinates or address`() {
    val uri = deliveryMapUriString(
      delivery(
        address = "   ",
        coordinates = null,
      ),
    )

    assertEquals(null, uri)
  }

  private fun delivery(address: String, coordinates: CoordinatesDto?): DeliveryDto {
    return DeliveryDto(
      id = "delivery-1",
      publicCode = "FD-001",
      store = "Drogaria Santo Antonio",
      customer = "Cliente Teste",
      phone = "11999999999",
      address = address,
      status = "AGUARDANDO_MOTOBOY",
      courier = "",
      createdAt = "2026-05-15T00:00:00.000Z",
      priority = "NORMAL",
      coordinates = coordinates,
    )
  }
}
