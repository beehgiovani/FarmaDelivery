package com.drogsantoantonio.farmadelivery.data.models

import kotlinx.serialization.Serializable

@Serializable
data class DeliveryDto(
  val id: String,
  val publicCode: String,
  val storeDailyDate: String? = null,
  val storeDailyNumber: Int? = null,
  val store: String,
  val customer: String,
  val phone: String,
  val address: String,
  val status: String,
  val courier: String,
  val createdAt: String,
  val acceptedAt: String? = null,
  val collectedAt: String? = null,
  val deliveredAt: String? = null,
  val canceledAt: String? = null,
  val earliestDispatchAt: String? = null,
  val priority: String,
  val deadlineTier: String = "MEDIO",
  val coordinates: CoordinatesDto? = null,
)

@Serializable
data class CoordinatesDto(
  val lat: Double,
  val lng: Double,
)

@Serializable
data class AcceptDeliveryRequest(
  val deliveryId: String,
  val courierId: String,
)

@Serializable
data class DeliveryActionRequest(
  val deliveryId: String,
  val notes: String? = null,
  val proofId: String? = null,
)

@Serializable
data class UploadDeliveryProofRequest(
  val fileName: String,
  val mimeType: String,
  val contentBase64: String,
)

@Serializable
data class DeliveryProofDto(
  val id: String,
  val deliveryId: String,
  val fileName: String,
  val mimeType: String,
  val sizeBytes: Int,
  val sha256: String,
  val createdAt: String,
)

@Serializable
data class DeliveryMutationResponse(
  val id: String,
  val publicCode: String,
  val storeDailyDate: String? = null,
  val storeDailyNumber: Int? = null,
  val status: String,
  val courier: String? = null,
  val acceptedAt: String? = null,
  val collectedAt: String? = null,
  val deliveredAt: String? = null,
  val canceledAt: String? = null,
)

@Serializable
data class DeliveryEventDto(
  val id: String,
  val deliveryId: String,
  val type: String,
  val notes: String? = null,
  val actor: DeliveryEventActorDto? = null,
  val createdAt: String,
)

@Serializable
data class DeliveryEventActorDto(
  val id: String,
  val name: String,
  val role: String,
)
