package com.drogsantoantonio.farmadelivery.data.models

import kotlinx.serialization.Serializable

@Serializable
data class CourierRouteDto(
  val id: String,
  val status: String,
  val courier: RouteCourierDto,
  val startedAt: String? = null,
  val finishedAt: String? = null,
  val recalculatedAt: String? = null,
  val createdAt: String,
  val stops: List<RouteStopDto>,
)

@Serializable
data class RouteCourierDto(
  val id: String,
  val name: String,
  val baseStoreName: String,
)

@Serializable
data class RouteStopDto(
  val id: String,
  val sequence: Int,
  val type: String,
  val status: String,
  val address: String,
  val latitude: Double? = null,
  val longitude: Double? = null,
  val earliestAt: String? = null,
  val completedAt: String? = null,
  val delivery: RouteStopDeliveryDto? = null,
)

@Serializable
data class RouteStopDeliveryDto(
  val id: String,
  val publicCode: String,
  val storeDailyDate: String? = null,
  val storeDailyNumber: Int? = null,
  val customer: String,
  val status: String,
)
