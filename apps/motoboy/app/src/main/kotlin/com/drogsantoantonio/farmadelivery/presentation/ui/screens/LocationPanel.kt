package com.drogsantoantonio.farmadelivery.presentation.ui.screens

import android.Manifest
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.drogsantoantonio.farmadelivery.data.location.DeviceLocationProvider
import com.drogsantoantonio.farmadelivery.data.models.AuthSession
import com.drogsantoantonio.farmadelivery.data.preferences.SessionPreferences
import com.drogsantoantonio.farmadelivery.data.repository.CourierRepository
import com.drogsantoantonio.farmadelivery.location.LocationTrackingService
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@Composable
fun LocationPanel(
  session: AuthSession,
  courierRepository: CourierRepository,
  available: Boolean,
  trackingAllowed: Boolean,
  onAvailabilityChanged: (Boolean) -> Unit,
) {
  val context = LocalContext.current
  val scope = rememberCoroutineScope()
  val locationProvider = remember { DeviceLocationProvider(context) }
  val sessionPreferences = remember { SessionPreferences(context) }
  var feedback by remember { mutableStateOf<String?>(null) }
  var availabilityLoading by remember { mutableStateOf(false) }
  var tracking by remember { mutableStateOf(false) }
  var lastLocationSentAt by remember { mutableStateOf<Long?>(null) }

  LaunchedEffect(session.courier?.id, trackingAllowed) {
    val courierId = session.courier?.id
    if (!trackingAllowed) {
      sessionPreferences.setLocationTrackingEnabled(false)
      LocationTrackingService.stop(context)
      tracking = false
      return@LaunchedEffect
    }

    if (courierId != null && locationProvider.hasLocationPermission()) {
      sessionPreferences.setLocationTrackingEnabled(true)
      tracking = true
      LocationTrackingService.start(context, courierId)
      feedback = "GPS ao vivo ligado enquanto voce estiver recebendo corridas ou em atendimento."
    } else if (courierId != null) {
      sessionPreferences.setLocationTrackingEnabled(false)
      tracking = false
      feedback = "Libere a localizacao para a loja acompanhar voce no mapa."
    }
  }

  LaunchedEffect(tracking, trackingAllowed) {
    while (tracking && trackingAllowed) {
      lastLocationSentAt = sessionPreferences.lastLocationSentAt()
      delay(LOCATION_WATCH_INTERVAL_MS)
    }
  }

  val permissionLauncher = rememberLauncherForActivityResult(
    contract = ActivityResultContracts.RequestMultiplePermissions(),
  ) { permissions ->
    val granted = permissions[Manifest.permission.ACCESS_FINE_LOCATION] == true ||
      permissions[Manifest.permission.ACCESS_COARSE_LOCATION] == true
    val courierId = session.courier?.id
    if (granted && trackingAllowed && courierId != null) {
      scope.launch {
        sessionPreferences.setLocationTrackingEnabled(true)
      }
      LocationTrackingService.start(context, courierId)
      tracking = true
      feedback = "Permissao liberada. GPS ao vivo ligado."
    } else {
      feedback = if (granted) "Permissao concedida." else "Permissao de localizacao negada."
    }
  }

  Surface(color = MaterialTheme.colorScheme.surface) {
    Column(
      verticalArrangement = Arrangement.spacedBy(10.dp),
      modifier = Modifier
        .fillMaxWidth()
        .padding(horizontal = 16.dp, vertical = 8.dp),
    ) {
      val operationalStatus = motoboyOperationalStatus(available = available, trackingEnabled = tracking)
      val hasCourierLink = session.courier?.id != null
      Text(operationalStatus.title, style = MaterialTheme.typography.titleSmall)
      Text(
        locationWatchMessage(
          feedback = feedback,
          tracking = tracking,
          trackingAllowed = trackingAllowed,
          lastLocationSentAt = lastLocationSentAt,
          now = System.currentTimeMillis(),
        ) ?: if (hasCourierLink) {
          operationalStatus.text
        } else {
          "Este login ainda nao esta ligado a um motoboy. Ajuste o cadastro no painel para liberar corridas e localizacao."
        },
        style = MaterialTheme.typography.bodySmall,
        color = if (hasCourierLink) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.error,
      )
      Spacer(Modifier.height(2.dp))
      Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
        Button(
          modifier = Modifier.weight(1f),
          enabled = !availabilityLoading && hasCourierLink,
          onClick = {
            val courierId = session.courier?.id
            if (courierId == null) {
              feedback = "Nao encontrei o cadastro deste motoboy."
              return@Button
            }

            scope.launch {
              availabilityLoading = true
              feedback = null
              try {
                val nextAvailable = !available
                val updatedCourier = courierRepository.updateAvailability(courierId, nextAvailable)
                onAvailabilityChanged(updatedCourier.available)
                sessionPreferences.setCourierAvailable(updatedCourier.available)
                if (!updatedCourier.available) {
                  sessionPreferences.setLocationTrackingEnabled(false)
                  LocationTrackingService.stop(context)
                  tracking = false
                } else if (locationProvider.hasLocationPermission()) {
                  sessionPreferences.setLocationTrackingEnabled(true)
                  LocationTrackingService.start(context, courierId)
                  tracking = true
                } else {
                  permissionLauncher.launch(locationPermissions)
                }
                feedback = if (updatedCourier.available) {
                  "Corridas ligadas. As novas entregas vao aparecer aqui."
                } else {
                  "Corridas paradas. Voce nao recebera novas entregas."
                }
              } catch (failure: Exception) {
                feedback = courierFacingError(failure, "Nao consegui mudar seu status agora.")
              } finally {
                availabilityLoading = false
              }
            }
          },
        ) {
          Text(availabilityActionLabel(available = available, loading = availabilityLoading))
        }
        if (trackingAllowed && hasCourierLink && !locationProvider.hasLocationPermission()) {
          Button(
            modifier = Modifier.weight(1f),
            onClick = { permissionLauncher.launch(locationPermissions) },
          ) {
            Text("Liberar localizacao")
          }
        }
      }
    }
  }
}

fun locationWatchMessage(
  feedback: String?,
  tracking: Boolean,
  trackingAllowed: Boolean,
  lastLocationSentAt: Long?,
  now: Long,
): String? {
  if (feedback != null) return feedback
  if (!trackingAllowed) return null
  if (!tracking) return "GPS ao vivo ainda nao ligou. Confira a permissao de localizacao."
  if (lastLocationSentAt == null) return "Aguardando o primeiro envio automatico de localizacao."

  val ageSeconds = (now - lastLocationSentAt).coerceAtLeast(0L) / 1000
  return when {
    ageSeconds <= LOCATION_STALE_WARNING_SECONDS -> "GPS ao vivo atualizado ha ${ageSeconds}s."
    else -> "A loja esta sem localizacao nova ha ${ageSeconds}s. Mantenha o app aberto e confira o GPS."
  }
}

private val locationPermissions = arrayOf(
  Manifest.permission.ACCESS_FINE_LOCATION,
  Manifest.permission.ACCESS_COARSE_LOCATION,
)

private const val LOCATION_WATCH_INTERVAL_MS = 15_000L
private const val LOCATION_STALE_WARNING_SECONDS = 75L
