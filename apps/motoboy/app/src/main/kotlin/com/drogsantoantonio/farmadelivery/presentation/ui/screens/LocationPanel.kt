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
import kotlinx.coroutines.launch

@Composable
fun LocationPanel(
  session: AuthSession,
  courierRepository: CourierRepository,
  available: Boolean,
  onAvailabilityChanged: (Boolean) -> Unit,
) {
  val context = LocalContext.current
  val scope = rememberCoroutineScope()
  val locationProvider = remember { DeviceLocationProvider(context) }
  val sessionPreferences = remember { SessionPreferences(context) }
  var feedback by remember { mutableStateOf<String?>(null) }
  var loading by remember { mutableStateOf(false) }
  var availabilityLoading by remember { mutableStateOf(false) }
  var tracking by remember { mutableStateOf(false) }

  LaunchedEffect(session.courier?.id, available) {
    val courierId = session.courier?.id
    val enabled = sessionPreferences.locationTrackingEnabled()
    tracking = enabled && available
    if (tracking && courierId != null && locationProvider.hasLocationPermission()) {
      LocationTrackingService.start(context, courierId)
    } else if (!available) {
      sessionPreferences.setLocationTrackingEnabled(false)
      LocationTrackingService.stop(context)
      tracking = false
    }
  }

  val permissionLauncher = rememberLauncherForActivityResult(
    contract = ActivityResultContracts.RequestMultiplePermissions(),
  ) { permissions ->
    val granted = permissions[Manifest.permission.ACCESS_FINE_LOCATION] == true ||
      permissions[Manifest.permission.ACCESS_COARSE_LOCATION] == true
    feedback = if (granted) "Permissao concedida. Envie a localizacao." else "Permissao de localizacao negada."
  }

  Surface(color = MaterialTheme.colorScheme.surface) {
    Column(
      verticalArrangement = Arrangement.spacedBy(10.dp),
      modifier = Modifier
        .fillMaxWidth()
        .padding(horizontal = 16.dp, vertical = 8.dp),
    ) {
      val operationalStatus = motoboyOperationalStatus(available = available, trackingEnabled = tracking)
      Text(operationalStatus.title, style = MaterialTheme.typography.titleSmall)
      Text(
        feedback ?: operationalStatus.text,
        style = MaterialTheme.typography.bodySmall,
      )
      Spacer(Modifier.height(2.dp))
      Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
        Button(
          modifier = Modifier.weight(1f),
          enabled = !availabilityLoading && session.courier?.id != null,
          onClick = {
            val courierId = session.courier?.id
            if (courierId == null) {
              feedback = "Sessao de motoboy indisponivel."
              return@Button
            }

            scope.launch {
              availabilityLoading = true
              feedback = null
              try {
                val nextAvailable = !available
                val updatedCourier = courierRepository.updateAvailability(courierId, nextAvailable)
                onAvailabilityChanged(updatedCourier.available)
                if (!updatedCourier.available) {
                  sessionPreferences.setLocationTrackingEnabled(false)
                  LocationTrackingService.stop(context)
                  tracking = false
                }
                feedback = if (updatedCourier.available) {
                  "Disponivel para receber corridas."
                } else {
                  "Indisponivel. Novas corridas nao serao direcionadas para voce."
                }
              } catch (failure: Exception) {
                feedback = failure.message ?: "Nao foi possivel atualizar disponibilidade."
              } finally {
                availabilityLoading = false
              }
            }
          },
        ) {
          Text(availabilityActionLabel(available = available, loading = availabilityLoading))
        }
        Button(
          modifier = Modifier.weight(1f),
          enabled = available && session.courier?.id != null,
          onClick = {
            val courierId = session.courier?.id
            if (courierId == null) {
              feedback = "Sessao de motoboy indisponivel."
              return@Button
            }
            if (!locationProvider.hasLocationPermission()) {
              permissionLauncher.launch(locationPermissions)
              return@Button
            }

            if (tracking) {
              scope.launch {
                sessionPreferences.setLocationTrackingEnabled(false)
              }
              LocationTrackingService.stop(context)
              tracking = false
              feedback = "Atualizacao automatica pausada."
            } else {
              scope.launch {
                sessionPreferences.setLocationTrackingEnabled(true)
              }
              LocationTrackingService.start(context, courierId)
              tracking = true
              feedback = "Atualizacao automatica ativa."
            }
          },
        ) {
          Text(automaticLocationActionLabel(trackingEnabled = tracking))
        }
        Button(
          modifier = Modifier.weight(1f),
          enabled = available && !loading && session.courier?.id != null,
          onClick = {
            if (!locationProvider.hasLocationPermission()) {
              permissionLauncher.launch(locationPermissions)
              return@Button
            }

            scope.launch {
              loading = true
              feedback = null
              try {
                val location = locationProvider.currentLocation()
                val courierId = session.courier?.id
                if (location == null || courierId == null) {
                  feedback = "Localizacao indisponivel agora."
                } else {
                  courierRepository.updateLocation(courierId, location.latitude, location.longitude, available = null)
                  feedback = "Localizacao enviada."
                }
              } catch (failure: Exception) {
                feedback = failure.message ?: "Nao foi possivel enviar."
              } finally {
                loading = false
              }
            }
          },
        ) {
          Text(sendLocationActionLabel(loading = loading))
        }
      }
    }
  }
}

private val locationPermissions = arrayOf(
  Manifest.permission.ACCESS_FINE_LOCATION,
  Manifest.permission.ACCESS_COARSE_LOCATION,
)
