package com.drogsantoantonio.farmadelivery

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import com.drogsantoantonio.farmadelivery.data.api.ApiClient
import com.drogsantoantonio.farmadelivery.data.models.AuthSession
import com.drogsantoantonio.farmadelivery.data.preferences.SessionPreferences
import com.drogsantoantonio.farmadelivery.data.repository.AuthRepository
import com.drogsantoantonio.farmadelivery.data.repository.CourierRepository
import com.drogsantoantonio.farmadelivery.data.repository.DeliveryRepository
import com.drogsantoantonio.farmadelivery.data.repository.RouteRepository
import com.drogsantoantonio.farmadelivery.location.LocationTrackingService
import com.drogsantoantonio.farmadelivery.presentation.ui.screens.LoginScreen
import com.drogsantoantonio.farmadelivery.presentation.ui.screens.MotoboyHomeScreen
import com.drogsantoantonio.farmadelivery.presentation.ui.theme.FarmaDeliveryTheme
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    val sessionPreferences = SessionPreferences(applicationContext)
    var tokenHolder: String? = null
    val api = ApiClient.create { tokenHolder }
    val authRepository = AuthRepository(api.authService, sessionPreferences)
    val deliveryRepository = DeliveryRepository(api.deliveryService)
    val courierRepository = CourierRepository(api.courierService)
    val routeRepository = RouteRepository(api.routeService)

    setContent {
      FarmaDeliveryTheme {
        MotoboyApp(
          authRepository = authRepository,
          deliveryRepository = deliveryRepository,
          courierRepository = courierRepository,
          routeRepository = routeRepository,
          onTokenChanged = { token ->
            tokenHolder = token
          },
        )
      }
    }
  }
}

@Composable
private fun MotoboyApp(
  authRepository: AuthRepository,
  deliveryRepository: DeliveryRepository,
  courierRepository: CourierRepository,
  routeRepository: RouteRepository,
  onTokenChanged: (String?) -> Unit,
) {
  val scope = rememberCoroutineScope()
  var session by remember { mutableStateOf<AuthSession?>(null) }
  var bootstrapping by remember { mutableStateOf(true) }
  val context = LocalContext.current

  LaunchedEffect(Unit) {
    val token = authRepository.savedToken()
    onTokenChanged(token)
    session = token?.let { authRepository.currentSession() }
    bootstrapping = false
  }

  val currentSession = session
  if (currentSession == null) {
    LoginScreen(
      loading = bootstrapping,
      onLogin = { identifier, password, onError ->
        scope.launch {
          try {
            val logged = authRepository.login(identifier, password)
            onTokenChanged(logged.token)
            session = logged
          } catch (error: Exception) {
            onError(error.message ?: "Nao foi possivel entrar.")
          }
        }
      },
    )
  } else {
    MotoboyHomeScreen(
      session = currentSession,
      deliveryRepository = deliveryRepository,
      courierRepository = courierRepository,
      routeRepository = routeRepository,
      onLogout = {
        scope.launch {
          currentSession.courier?.id?.let { courierId ->
            runCatching {
              courierRepository.updateAvailability(courierId = courierId, available = false)
            }
          }
          LocationTrackingService.stop(context)
          authRepository.logout()
          onTokenChanged(null)
          session = null
        }
      },
    )
  }
}
