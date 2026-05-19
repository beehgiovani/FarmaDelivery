package com.drogsantoantonio.farmadelivery.presentation.ui.screens

import com.drogsantoantonio.farmadelivery.data.models.DeliveryEventDto

fun deliveryEventActorLabel(event: DeliveryEventDto): String? {
  return event.actor?.name?.trim()?.takeIf { it.isNotBlank() }
}
