package com.drogsantoantonio.farmadelivery.data.models

import kotlinx.serialization.Serializable

@Serializable
data class CourierDto(
  val id: String,
  val name: String,
  val phone: String? = null,
  val baseStoreName: String,
  val available: Boolean,
  val preferredServiceArea: String? = null,
  val currentLat: Double? = null,
  val currentLng: Double? = null,
  val lastLocationAt: String? = null,
  val active: Boolean,
)

@Serializable
data class CourierLocationRequest(
  val courierId: String,
  val latitude: Double,
  val longitude: Double,
  val available: Boolean? = null,
  val serviceArea: String? = null,
)

@Serializable
data class CourierAvailabilityRequest(
  val courierId: String,
  val available: Boolean,
  val serviceArea: String? = null,
)

@Serializable
data class DeviceTokenRequest(
  val deviceToken: String,
  val platform: String = "android",
)

@Serializable
data class DeviceTokenResponse(
  val id: String,
  val courierId: String,
  val platform: String,
  val active: Boolean,
  val lastSeenAt: String,
)
