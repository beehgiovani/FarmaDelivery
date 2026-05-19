package com.drogsantoantonio.farmadelivery.notifications

import android.Manifest
import android.app.PendingIntent
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.drogsantoantonio.farmadelivery.DELIVERY_NOTIFICATION_CHANNEL_ID
import com.drogsantoantonio.farmadelivery.MainActivity
import com.drogsantoantonio.farmadelivery.R
import com.drogsantoantonio.farmadelivery.data.api.ApiClient
import com.drogsantoantonio.farmadelivery.data.preferences.SessionPreferences
import com.drogsantoantonio.farmadelivery.data.repository.CourierRepository
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

class FarmaMessagingService : FirebaseMessagingService() {
  private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

  override fun onMessageReceived(message: RemoteMessage) {
    val title = message.notification?.title ?: message.data["title"] ?: "FarmaDelivery"
    val body = message.notification?.body ?: resolveBody(message.data["type"])
    showDeliveryNotification(title = title, body = body)
  }

  override fun onNewToken(token: String) {
    scope.launch {
      val preferences = SessionPreferences(applicationContext)
      val sessionToken = preferences.token()
      val courierId = preferences.courierId()
      if (sessionToken.isNullOrBlank() || courierId.isNullOrBlank()) return@launch

      runCatching {
        val api = ApiClient.create { sessionToken }
        CourierRepository(api.courierService).registerDeviceToken(courierId, token)
      }
    }
  }

  private fun showDeliveryNotification(title: String, body: String) {
    if (
      Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
      ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
    ) {
      return
    }

    val intent = Intent(this, MainActivity::class.java).apply {
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
    }
    val pendingIntent = PendingIntent.getActivity(
      this,
      0,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    val notification = NotificationCompat.Builder(this, DELIVERY_NOTIFICATION_CHANNEL_ID)
      .setSmallIcon(R.drawable.ic_logo)
      .setContentTitle(title)
      .setContentText(body)
      .setStyle(NotificationCompat.BigTextStyle().bigText(body))
      .setAutoCancel(true)
      .setPriority(NotificationCompat.PRIORITY_HIGH)
      .setContentIntent(pendingIntent)
      .build()

    NotificationManagerCompat.from(this).notify(System.currentTimeMillis().toInt(), notification)
  }

  private fun resolveBody(type: String?): String {
    return when (type) {
      "NEW_DELIVERY_AVAILABLE" -> "Uma nova entrega esta aguardando aceite."
      "DELIVERY_CANCELED" -> "Uma entrega da sua rota foi cancelada."
      else -> "Voce tem uma atualizacao de entrega."
    }
  }
}
