package com.drogsantoantonio.farmadelivery.data.models

import kotlinx.serialization.Serializable

@Serializable
data class LoginRequest(
  val identifier: String,
  val password: String,
)

@Serializable
data class AuthSession(
  val id: String,
  val name: String,
  val phone: String? = null,
  val email: String? = null,
  val role: String,
  val active: Boolean,
  val store: StoreRef? = null,
  val courier: CourierRef? = null,
  val createdAt: String,
  val token: String,
)

@Serializable
data class StoreRef(
  val id: String,
  val name: String,
  val code: String? = null,
)

@Serializable
data class CourierRef(
  val id: String,
  val baseStoreName: String,
  val available: Boolean,
  val preferredServiceArea: String? = null,
  val currentLat: Double? = null,
  val currentLng: Double? = null,
  val lastLocationAt: String? = null,
)
