package com.drogsantoantonio.farmadelivery.location

import android.Manifest
import android.app.Notification
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import androidx.core.content.ContextCompat.startForegroundService
import com.drogsantoantonio.farmadelivery.LOCATION_NOTIFICATION_CHANNEL_ID
import com.drogsantoantonio.farmadelivery.MainActivity
import com.drogsantoantonio.farmadelivery.R
import com.drogsantoantonio.farmadelivery.data.api.ApiClient
import com.drogsantoantonio.farmadelivery.data.location.DeviceLocationProvider
import com.drogsantoantonio.farmadelivery.data.preferences.SessionPreferences
import com.drogsantoantonio.farmadelivery.data.repository.CourierRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

class LocationTrackingService : Service() {
  private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
  private var trackingJob: Job? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      ACTION_STOP -> stopTracking()
      ACTION_START -> startTracking(intent.getStringExtra(EXTRA_COURIER_ID))
      else -> stopSelf()
    }

    return START_STICKY
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onDestroy() {
    trackingJob?.cancel()
    scope.cancel()
    super.onDestroy()
  }

  private fun startTracking(courierId: String?) {
    if (courierId.isNullOrBlank() || !hasLocationPermission()) {
      scope.launch {
        SessionPreferences(applicationContext).setLocationTrackingEnabled(false)
        stopSelf()
      }
      return
    }

    val foregroundServiceType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION
    } else {
      0
    }

    ServiceCompat.startForeground(
      this,
      LOCATION_NOTIFICATION_ID,
      buildNotification(),
      foregroundServiceType,
    )

    trackingJob?.cancel()
    trackingJob = scope.launch {
      val sessionPreferences = SessionPreferences(applicationContext)
      var token = sessionPreferences.token()
      val api = ApiClient.create { token }
      val courierRepository = CourierRepository(api.courierService)
      val locationProvider = DeviceLocationProvider(applicationContext)

      while (true) {
        val location = locationProvider.currentLocation()
        if (location != null) {
          runCatching {
            if (token.isNullOrBlank()) token = sessionPreferences.token()
            courierRepository.updateLocation(
              courierId = courierId,
              latitude = location.latitude,
              longitude = location.longitude,
              available = null,
            )
          }
        }
        delay(LOCATION_SEND_INTERVAL_MS)
      }
    }
  }

  private fun stopTracking() {
    trackingJob?.cancel()
    trackingJob = null
    scope.launch {
      SessionPreferences(applicationContext).setLocationTrackingEnabled(false)
      stopSelf()
    }
    stopForeground(STOP_FOREGROUND_REMOVE)
  }

  private fun buildNotification(): Notification {
    val intent = Intent(this, MainActivity::class.java)
    val pendingIntent = PendingIntent.getActivity(
      this,
      0,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    return NotificationCompat.Builder(this, LOCATION_NOTIFICATION_CHANNEL_ID)
      .setSmallIcon(R.drawable.ic_logo)
      .setContentTitle("Localizacao ativa")
      .setContentText("Atualizando sua posicao para a loja.")
      .setOngoing(true)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .setContentIntent(pendingIntent)
      .build()
  }

  private fun hasLocationPermission(): Boolean {
    val fine = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
    val coarse = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION)
    return fine == PackageManager.PERMISSION_GRANTED || coarse == PackageManager.PERMISSION_GRANTED
  }

  companion object {
    private const val ACTION_START = "com.drogsantoantonio.farmadelivery.location.START"
    private const val ACTION_STOP = "com.drogsantoantonio.farmadelivery.location.STOP"
    private const val EXTRA_COURIER_ID = "courier_id"
    private const val LOCATION_NOTIFICATION_ID = 3001
    private const val LOCATION_SEND_INTERVAL_MS = 60_000L

    fun start(context: Context, courierId: String) {
      val intent = Intent(context, LocationTrackingService::class.java).apply {
        action = ACTION_START
        putExtra(EXTRA_COURIER_ID, courierId)
      }
      startForegroundService(context, intent)
    }

    fun stop(context: Context) {
      val intent = Intent(context, LocationTrackingService::class.java).apply {
        action = ACTION_STOP
      }
      context.startService(intent)
    }
  }
}
