package com.drogsantoantonio.farmadelivery.data.api

import com.drogsantoantonio.farmadelivery.data.models.AcceptDeliveryRequest
import com.drogsantoantonio.farmadelivery.data.models.DeliveryActionRequest
import com.drogsantoantonio.farmadelivery.data.models.DeliveryDto
import com.drogsantoantonio.farmadelivery.data.models.DeliveryEventDto
import com.drogsantoantonio.farmadelivery.data.models.DeliveryMutationResponse
import com.drogsantoantonio.farmadelivery.data.models.DeliveryProofDto
import com.drogsantoantonio.farmadelivery.data.models.UploadDeliveryProofRequest
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Path
import retrofit2.http.POST

interface DeliveryService {
  @GET("deliveries")
  suspend fun listDeliveries(): List<DeliveryDto>

  @GET("deliveries/{deliveryId}/events")
  suspend fun listEvents(@Path("deliveryId") deliveryId: String): List<DeliveryEventDto>

  @POST("deliveries/{deliveryId}/proofs")
  suspend fun uploadProof(
    @Path("deliveryId") deliveryId: String,
    @Body body: UploadDeliveryProofRequest,
  ): DeliveryProofDto

  @POST("deliveries/accept")
  suspend fun accept(@Body body: AcceptDeliveryRequest): DeliveryMutationResponse

  @POST("deliveries/collect")
  suspend fun collect(@Body body: DeliveryActionRequest): DeliveryMutationResponse

  @POST("deliveries/start-route")
  suspend fun startRoute(@Body body: DeliveryActionRequest): DeliveryMutationResponse

  @POST("deliveries/deliver")
  suspend fun deliver(@Body body: DeliveryActionRequest): DeliveryMutationResponse

  @POST("deliveries/problem")
  suspend fun problem(@Body body: DeliveryActionRequest): DeliveryMutationResponse
}
