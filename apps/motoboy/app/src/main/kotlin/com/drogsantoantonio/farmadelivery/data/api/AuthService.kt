package com.drogsantoantonio.farmadelivery.data.api

import com.drogsantoantonio.farmadelivery.data.models.AuthSession
import com.drogsantoantonio.farmadelivery.data.models.LoginRequest
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST

interface AuthService {
  @POST("auth/login")
  suspend fun login(@Body body: LoginRequest): AuthSession

  @GET("auth/me")
  suspend fun me(): AuthSession
}
