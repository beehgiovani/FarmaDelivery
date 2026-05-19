package com.drogsantoantonio.farmadelivery.data.api

import com.drogsantoantonio.farmadelivery.data.models.CourierDto
import com.drogsantoantonio.farmadelivery.data.models.CourierAvailabilityRequest
import com.drogsantoantonio.farmadelivery.data.models.CourierLocationRequest
import com.drogsantoantonio.farmadelivery.data.models.DeviceTokenRequest
import com.drogsantoantonio.farmadelivery.data.models.DeviceTokenResponse
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Path
import retrofit2.http.POST

interface CourierService {
  @GET("couriers")
  suspend fun listCouriers(): List<CourierDto>

  @POST("couriers/location")
  suspend fun updateLocation(@Body body: CourierLocationRequest): CourierDto

  @POST("couriers/availability")
  suspend fun updateAvailability(@Body body: CourierAvailabilityRequest): CourierDto

  @POST("couriers/{courierId}/device-token")
  suspend fun registerDeviceToken(
    @Path("courierId") courierId: String,
    @Body body: DeviceTokenRequest,
  ): DeviceTokenResponse
}
