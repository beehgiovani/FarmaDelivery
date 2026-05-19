package com.drogsantoantonio.farmadelivery.data.api

import com.drogsantoantonio.farmadelivery.data.models.CourierRouteDto
import retrofit2.http.GET

interface RouteService {
  @GET("courier-routes")
  suspend fun activeRoutes(): List<CourierRouteDto>
}
