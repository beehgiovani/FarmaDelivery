package com.drogsantoantonio.farmadelivery.presentation.ui.screens

import com.drogsantoantonio.farmadelivery.data.models.DeliveryEventDto

fun deliveryEventNotesText(event: DeliveryEventDto): String? {
  return event.notes?.trim()?.takeIf { it.isNotBlank() }
}
