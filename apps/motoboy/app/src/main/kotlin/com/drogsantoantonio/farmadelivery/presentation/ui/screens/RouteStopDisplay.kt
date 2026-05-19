package com.drogsantoantonio.farmadelivery.presentation.ui.screens

import com.drogsantoantonio.farmadelivery.data.models.RouteStopDto

/**
 * Define o titulo principal da parada na rota.
 * Usa o codigo da entrega quando existir; sem entrega vinculada, mostra o tipo da parada.
 */
fun routeStopTitle(stop: RouteStopDto): String {
  val delivery = stop.delivery ?: return routeStopTypeLabel(stop.type)
  return deliveryPrimaryCodeLabel(delivery.publicCode, delivery.storeDailyNumber)
}

/**
 * Monta o detalhe da parada com cliente e status da entrega.
 * Retorna null quando nao ha entrega para nao poluir a tela com texto vazio.
 */
fun routeStopDetails(stop: RouteStopDto): String? {
  val delivery = stop.delivery ?: return null
  val customer = delivery.customer.trim()
  val status = deliveryStatusLabel(delivery.status)
  val code = if (deliveryDailyNumberLabel(delivery.storeDailyNumber) != null) delivery.publicCode else null
  val parts = listOfNotNull(code, customer.takeIf { it.isNotEmpty() }, status)

  return parts.joinToString(" - ")
}
