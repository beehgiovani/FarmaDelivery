package com.drogsantoantonio.farmadelivery.data.preferences

import android.content.Context
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

private val Context.sessionDataStore by preferencesDataStore(name = "farmadelivery_session")

class SessionPreferences(private val context: Context) {
  private val tokenKey = stringPreferencesKey("session_token")
  private val courierIdKey = stringPreferencesKey("courier_id")
  private val locationTrackingKey = booleanPreferencesKey("location_tracking_enabled")
  private val courierAvailableKey = booleanPreferencesKey("courier_available")
  private val lastLocationSentAtKey = longPreferencesKey("last_location_sent_at")

  suspend fun saveToken(token: String) {
    context.sessionDataStore.edit { preferences ->
      preferences[tokenKey] = token
    }
  }

  suspend fun saveCourierId(courierId: String?) {
    context.sessionDataStore.edit { preferences ->
      if (courierId.isNullOrBlank()) {
        preferences.remove(courierIdKey)
      } else {
        preferences[courierIdKey] = courierId
      }
    }
  }

  suspend fun token(): String? {
    return context.sessionDataStore.data.map { preferences -> preferences[tokenKey] }.first()
  }

  suspend fun courierId(): String? {
    return context.sessionDataStore.data.map { preferences -> preferences[courierIdKey] }.first()
  }

  suspend fun setLocationTrackingEnabled(enabled: Boolean) {
    context.sessionDataStore.edit { preferences ->
      preferences[locationTrackingKey] = enabled
    }
  }

  suspend fun setCourierAvailable(available: Boolean) {
    context.sessionDataStore.edit { preferences ->
      preferences[courierAvailableKey] = available
    }
  }

  suspend fun courierAvailable(): Boolean {
    return context.sessionDataStore.data.map { preferences -> preferences[courierAvailableKey] ?: false }.first()
  }

  suspend fun courierAvailablePreference(): Boolean? {
    return context.sessionDataStore.data.map { preferences -> preferences[courierAvailableKey] }.first()
  }

  suspend fun locationTrackingEnabled(): Boolean {
    return context.sessionDataStore.data.map { preferences -> preferences[locationTrackingKey] ?: false }.first()
  }

  suspend fun setLastLocationSentAt(sentAt: Long) {
    context.sessionDataStore.edit { preferences ->
      preferences[lastLocationSentAtKey] = sentAt
    }
  }

  suspend fun lastLocationSentAt(): Long? {
    return context.sessionDataStore.data.map { preferences -> preferences[lastLocationSentAtKey] }.first()
  }

  suspend fun clear() {
    context.sessionDataStore.edit { preferences ->
      preferences.remove(tokenKey)
      preferences.remove(courierIdKey)
      preferences.remove(locationTrackingKey)
      preferences.remove(courierAvailableKey)
      preferences.remove(lastLocationSentAtKey)
    }
  }
}
