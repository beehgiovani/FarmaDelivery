package com.drogsantoantonio.farmadelivery.presentation.ui.screens

import com.drogsantoantonio.farmadelivery.data.models.DeliveryDto

fun deliveryAutoRefreshNotice(
  previous: List<DeliveryDto>,
  next: List<DeliveryDto>,
  hasPreviousSnapshot: Boolean,
): String? {
  if (!hasPreviousSnapshot) return null

  val previousAvailableIds = deliverySections(previous).available.map { it.id }.toSet()
  val newAvailable = deliverySections(next).available.filterNot { it.id in previousAvailableIds }
  if (newAvailable.isEmpty()) return null

  return if (newAvailable.size == 1) {
    "Nova entrega: ${deliveryPrimaryCodeLabel(newAvailable.first().publicCode, newAvailable.first().storeDailyNumber)}."
  } else {
    "${newAvailable.size} novas entregas."
  }
}
