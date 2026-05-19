package com.drogsantoantonio.farmadelivery.presentation.ui.screens

import com.drogsantoantonio.farmadelivery.data.models.RouteStopDeliveryDto
import com.drogsantoantonio.farmadelivery.data.models.RouteStopDto
import kotlin.test.Test
import kotlin.test.assertEquals

class RouteStopDisplayTest {
  @Test
  fun `uses delivery public code as route stop title when available`() {
    assertEquals("FD-123", routeStopTitle(stop(delivery = delivery(publicCode = "FD-123"))))
  }

  @Test
  fun `uses store daily number as route stop title when available`() {
    assertEquals("N. dia 009", routeStopTitle(stop(delivery = delivery(publicCode = "AST-20260517-009", storeDailyNumber = 9))))
  }

  @Test
  fun `falls back to route stop type when delivery context is unavailable`() {
    assertEquals("Entrega", routeStopTitle(stop(delivery = null)))
  }

  @Test
  fun `shows customer and delivery status as route stop details`() {
    assertEquals("Maria - Em rota", routeStopDetails(stop(delivery = delivery(customer = "Maria", status = "EM_ROTA"))))
  }

  @Test
  fun `keeps full public code in route stop details when title uses daily number`() {
    assertEquals(
      "AST-20260517-009 - Maria - Em rota",
      routeStopDetails(stop(delivery = delivery(publicCode = "AST-20260517-009", storeDailyNumber = 9, customer = "Maria", status = "EM_ROTA"))),
    )
  }

  @Test
  fun `falls back to delivery status when customer is blank`() {
    assertEquals("Disponivel", routeStopDetails(stop(delivery = delivery(customer = "  ", status = "AGUARDANDO_MOTOBOY"))))
  }

  @Test
  fun `omits route stop details when delivery context is unavailable`() {
    assertEquals(null, routeStopDetails(stop(delivery = null)))
  }

  private fun stop(delivery: RouteStopDeliveryDto?): RouteStopDto {
    return RouteStopDto(
      id = "stop-1",
      sequence = 1,
      type = "ENTREGA",
      status = "PENDENTE",
      address = "Rua Teste",
      delivery = delivery,
    )
  }

  private fun delivery(
    publicCode: String = "FD-001",
    storeDailyNumber: Int? = null,
    customer: String = "Cliente Teste",
    status: String = "AGUARDANDO_MOTOBOY",
  ): RouteStopDeliveryDto {
    return RouteStopDeliveryDto(
      id = "delivery-1",
      publicCode = publicCode,
      storeDailyNumber = storeDailyNumber,
      customer = customer,
      status = status,
    )
  }
}
