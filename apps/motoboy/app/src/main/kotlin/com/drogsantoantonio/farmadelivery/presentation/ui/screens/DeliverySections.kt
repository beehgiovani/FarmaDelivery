package com.drogsantoantonio.farmadelivery.presentation.ui.screens

import com.drogsantoantonio.farmadelivery.data.models.DeliveryDto

data class DeliverySections(
  val active: List<DeliveryDto>,
  val available: List<DeliveryDto>,
)

fun deliverySections(deliveries: List<DeliveryDto>): DeliverySections {
  return DeliverySections(
    active = deliveries.filter { it.status in ACTIVE_DELIVERY_STATUSES },
    available = deliveries.filter { it.status == AVAILABLE_DELIVERY_STATUS },
  )
}

private val ACTIVE_DELIVERY_STATUSES = setOf(
  "ACEITA_PELO_MOTOBOY",
  "COLETADA",
  "EM_ROTA",
  "PROBLEMA",
)

private const val AVAILABLE_DELIVERY_STATUS = "AGUARDANDO_MOTOBOY"
