package com.drogsantoantonio.farmadelivery.data.repository

import com.drogsantoantonio.farmadelivery.data.api.RouteService
import com.drogsantoantonio.farmadelivery.data.models.CourierRouteDto

class RouteRepository(private val service: RouteService) {
  suspend fun activeRoutes(): List<CourierRouteDto> = service.activeRoutes()
}
