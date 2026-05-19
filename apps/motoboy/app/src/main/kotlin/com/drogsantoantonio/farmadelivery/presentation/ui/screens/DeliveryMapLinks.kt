package com.drogsantoantonio.farmadelivery.presentation.ui.screens

import android.net.Uri
import com.drogsantoantonio.farmadelivery.data.models.DeliveryDto
import java.net.URLEncoder

fun deliveryMapUri(delivery: DeliveryDto): Uri? {
  return deliveryMapUriString(delivery)?.let(Uri::parse)
}

fun deliveryMapUriString(delivery: DeliveryDto): String? {
  val coordinates = delivery.coordinates
  val query = if (coordinates != null) {
    "${coordinates.lat},${coordinates.lng}"
  } else {
    delivery.address.trim()
  }

  if (query.isBlank()) return null

  return "geo:0,0?q=${urlEncode(query)}"
}

private fun urlEncode(value: String): String {
  return URLEncoder.encode(value, "UTF-8").replace("+", "%20")
}
