package com.drogsantoantonio.farmadelivery

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Application

class FarmaDeliveryApp : Application() {
  override fun onCreate() {
    super.onCreate()
    createNotificationChannels()
  }

  private fun createNotificationChannels() {
    val deliveriesChannel = NotificationChannel(
      DELIVERY_NOTIFICATION_CHANNEL_ID,
      "Entregas",
      NotificationManager.IMPORTANCE_HIGH,
    ).apply {
      description = "Avisos operacionais de entregas e cancelamentos"
    }
    val locationChannel = NotificationChannel(
      LOCATION_NOTIFICATION_CHANNEL_ID,
      "Localizacao",
      NotificationManager.IMPORTANCE_LOW,
    ).apply {
      description = "Envio de localizacao durante expediente e rota"
    }

    getSystemService(NotificationManager::class.java).createNotificationChannels(
      listOf(deliveriesChannel, locationChannel),
    )
  }
}

const val DELIVERY_NOTIFICATION_CHANNEL_ID = "deliveries"
const val LOCATION_NOTIFICATION_CHANNEL_ID = "location"
