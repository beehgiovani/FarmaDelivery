package com.drogsantoantonio.farmadelivery.data.location

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import androidx.core.content.ContextCompat
import com.google.android.gms.location.LocationServices
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume

data class DeviceLocation(
  val latitude: Double,
  val longitude: Double,
)

class DeviceLocationProvider(private val context: Context) {
  private val fusedLocationClient = LocationServices.getFusedLocationProviderClient(context)

  fun hasLocationPermission(): Boolean {
    val fine = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION)
    val coarse = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION)
    return fine == PackageManager.PERMISSION_GRANTED || coarse == PackageManager.PERMISSION_GRANTED
  }

  @SuppressLint("MissingPermission")
  suspend fun currentLocation(): DeviceLocation? {
    if (!hasLocationPermission()) return null

    return suspendCancellableCoroutine { continuation ->
      fusedLocationClient.lastLocation
        .addOnSuccessListener { location ->
          continuation.resume(
            location?.let {
              DeviceLocation(latitude = it.latitude, longitude = it.longitude)
            },
          )
        }
        .addOnFailureListener {
          continuation.resume(null)
        }
    }
  }
}
