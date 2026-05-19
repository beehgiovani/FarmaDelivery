package com.drogsantoantonio.farmadelivery.data.api

import com.drogsantoantonio.farmadelivery.BuildConfig
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory

data class ApiClient(
  val authService: AuthService,
  val deliveryService: DeliveryService,
  val courierService: CourierService,
  val routeService: RouteService,
) {
  companion object {
    fun create(tokenProvider: () -> String?): ApiClient {
      val json = Json {
        ignoreUnknownKeys = true
      }

      val logging = HttpLoggingInterceptor().apply {
        level = HttpLoggingInterceptor.Level.BASIC
      }

      val http = OkHttpClient.Builder()
        .addInterceptor { chain ->
          val token = tokenProvider()
          val request = chain.request().newBuilder().apply {
            if (!token.isNullOrBlank()) {
              header("Authorization", "Bearer $token")
            }
          }.build()
          chain.proceed(request)
        }
        .addInterceptor(logging)
        .build()

      val retrofit = Retrofit.Builder()
        .baseUrl(normalizeBaseUrl(BuildConfig.FARMADELIVERY_API_URL))
        .client(http)
        .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
        .build()

      return ApiClient(
        authService = retrofit.create(AuthService::class.java),
        deliveryService = retrofit.create(DeliveryService::class.java),
        courierService = retrofit.create(CourierService::class.java),
        routeService = retrofit.create(RouteService::class.java),
      )
    }

    private fun normalizeBaseUrl(url: String): String {
      return if (url.endsWith("/")) url else "$url/"
    }
  }
}
