package com.drogsantoantonio.farmadelivery.data.repository

import com.drogsantoantonio.farmadelivery.data.api.CourierService
import com.drogsantoantonio.farmadelivery.data.models.CourierAvailabilityRequest
import com.drogsantoantonio.farmadelivery.data.models.CourierDto
import com.drogsantoantonio.farmadelivery.data.models.CourierLocationRequest
import com.drogsantoantonio.farmadelivery.data.models.DeviceTokenRequest

class CourierRepository(private val service: CourierService) {
  suspend fun updateLocation(courierId: String, latitude: Double, longitude: Double, available: Boolean?) {
    service.updateLocation(
      CourierLocationRequest(
        courierId = courierId,
        latitude = latitude,
        longitude = longitude,
        available = available,
      ),
    )
  }

  suspend fun updateAvailability(courierId: String, available: Boolean): CourierDto {
    return service.updateAvailability(
      CourierAvailabilityRequest(
        courierId = courierId,
        available = available,
      ),
    )
  }

  suspend fun registerDeviceToken(courierId: String, deviceToken: String) {
    service.registerDeviceToken(
      courierId = courierId,
      body = DeviceTokenRequest(deviceToken = deviceToken),
    )
  }
}
