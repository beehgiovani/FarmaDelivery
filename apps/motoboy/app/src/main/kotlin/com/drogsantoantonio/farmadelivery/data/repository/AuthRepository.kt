package com.drogsantoantonio.farmadelivery.data.repository

import com.drogsantoantonio.farmadelivery.data.api.AuthService
import com.drogsantoantonio.farmadelivery.data.models.AuthSession
import com.drogsantoantonio.farmadelivery.data.models.LoginRequest
import com.drogsantoantonio.farmadelivery.data.preferences.SessionPreferences

class AuthRepository(
  private val service: AuthService,
  private val preferences: SessionPreferences,
) {
  suspend fun login(identifier: String, password: String): AuthSession {
    val session = service.login(LoginRequest(identifier = identifier, password = password))
    preferences.saveSession(session)
    return session
  }

  suspend fun savedToken(): String? = preferences.token()

  suspend fun currentSession(): AuthSession? {
    return try {
      val session = service.me()
      preferences.saveSession(session)
      session
    } catch (_: Exception) {
      preferences.clear()
      null
    }
  }

  suspend fun logout() {
    preferences.clear()
  }
}

private suspend fun SessionPreferences.saveSession(session: AuthSession) {
  saveToken(session.token)
  saveCourierId(session.courier?.id)
  setCourierAvailable(session.courier?.available == true)
}
