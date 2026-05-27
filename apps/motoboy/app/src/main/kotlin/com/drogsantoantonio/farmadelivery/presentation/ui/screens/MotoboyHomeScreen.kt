package com.drogsantoantonio.farmadelivery.presentation.ui.screens

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import com.drogsantoantonio.farmadelivery.R
import com.drogsantoantonio.farmadelivery.data.models.AuthSession
import com.drogsantoantonio.farmadelivery.data.preferences.SessionPreferences
import com.drogsantoantonio.farmadelivery.data.repository.CourierRepository
import com.drogsantoantonio.farmadelivery.data.repository.DeliveryRepository
import com.drogsantoantonio.farmadelivery.data.repository.RouteRepository
import com.google.firebase.messaging.FirebaseMessaging
import kotlinx.coroutines.tasks.await

@Composable
fun MotoboyHomeScreen(
  session: AuthSession,
  deliveryRepository: DeliveryRepository,
  courierRepository: CourierRepository,
  routeRepository: RouteRepository,
  onLogout: () -> Unit,
) {
  var tab by remember { mutableStateOf(HomeTab.Deliveries) }
  var available by remember { mutableStateOf(session.courier?.available == true) }
  var hasActiveDelivery by remember { mutableStateOf(false) }
  var backgroundLocationGranted by remember { mutableStateOf(false) }
  val courierId = session.courier?.id
  val context = LocalContext.current
  val sessionPreferences = remember { SessionPreferences(context) }
  val permissionLauncher = rememberLauncherForActivityResult(
    contract = ActivityResultContracts.RequestMultiplePermissions(),
    onResult = {
      backgroundLocationGranted = hasBackgroundLocationPermission(context)
    },
  )
  val backgroundPermissionLauncher = rememberLauncherForActivityResult(
    contract = ActivityResultContracts.RequestPermission(),
    onResult = { granted ->
      backgroundLocationGranted = granted || hasBackgroundLocationPermission(context)
    },
  )

  LaunchedEffect(Unit) {
    backgroundLocationGranted = hasBackgroundLocationPermission(context)
    val permissions = mutableListOf(
      Manifest.permission.ACCESS_FINE_LOCATION,
      Manifest.permission.ACCESS_COARSE_LOCATION,
    )

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      permissions += Manifest.permission.POST_NOTIFICATIONS
    }

    permissionLauncher.launch(permissions.toTypedArray())
  }

  LaunchedEffect(courierId) {
    if (courierId == null) return@LaunchedEffect

    val preferredAvailable = sessionPreferences.courierAvailablePreference() ?: true
    if (available != preferredAvailable) {
      available = preferredAvailable
    }

    runCatching {
      val updatedCourier = courierRepository.updateAvailability(courierId, preferredAvailable)
      available = updatedCourier.available
      sessionPreferences.setCourierAvailable(updatedCourier.available)
    }

    runCatching {
      val deviceToken = FirebaseMessaging.getInstance().token.await()
      courierRepository.registerDeviceToken(courierId = courierId, deviceToken = deviceToken)
    }
  }

  Surface(modifier = Modifier.fillMaxSize()) {
    Column {
      Row(
        modifier = Modifier
          .fillMaxWidth()
          .padding(horizontal = 16.dp, vertical = 12.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically,
      ) {
        Image(
          painter = painterResource(R.drawable.drogaria_santo_antonio_logo),
          contentDescription = "Drogaria Santo Antonio",
          modifier = Modifier.size(56.dp),
        )
        Column {
          Text("Drogaria Santo Antonio", style = MaterialTheme.typography.titleMedium)
          Text(
            session.courier?.baseStoreName ?: "Drogaria Santo Antonio",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.primary,
          )
        }
      }

      HomeTabSelector(
        selectedTab = tab,
        onSelected = { tab = it },
      )

      LocationPanel(
        session = session,
        courierRepository = courierRepository,
        available = available,
        trackingAllowed = available || hasActiveDelivery,
        onAvailabilityChanged = { available = it },
      )

      BackgroundLocationPermissionPanel(
        granted = backgroundLocationGranted,
        onRequestPermission = {
          if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            backgroundLocationGranted = true
          } else if (Build.VERSION.SDK_INT == Build.VERSION_CODES.Q) {
            backgroundPermissionLauncher.launch(Manifest.permission.ACCESS_BACKGROUND_LOCATION)
          } else {
            context.startActivity(
              Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                data = Uri.fromParts("package", context.packageName, null)
              },
            )
          }
        },
      )

      when (tab) {
        HomeTab.Deliveries -> DeliveriesScreen(
          session = session,
          deliveryRepository = deliveryRepository,
          courierRepository = courierRepository,
          available = available,
          onAvailabilityChanged = { available = it },
          onActiveDeliveryPresenceChanged = { hasActiveDelivery = it },
          onLogout = onLogout,
        )

        HomeTab.Route -> RouteScreen(
          routeRepository = routeRepository,
          onLogout = onLogout,
        )
      }
    }
  }
}

@Composable
private fun BackgroundLocationPermissionPanel(
  granted: Boolean,
  onRequestPermission: () -> Unit,
) {
  if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q || granted) return

  Surface(
    color = MaterialTheme.colorScheme.secondaryContainer,
    modifier = Modifier
      .fillMaxWidth()
      .padding(horizontal = 16.dp, vertical = 6.dp),
  ) {
    Column(
      verticalArrangement = Arrangement.spacedBy(8.dp),
      modifier = Modifier.padding(12.dp),
    ) {
      Text("Localizacao ao vivo", style = MaterialTheme.typography.titleSmall)
      Text(
        "Para a loja ver voce no mapa enquanto estiver em atendimento, permita a localizacao o tempo todo nas configuracoes do app.",
        style = MaterialTheme.typography.bodySmall,
      )
      OutlinedButton(onClick = onRequestPermission) {
        Text("Abrir permissoes")
      }
    }
  }
}

private enum class HomeTab {
  Deliveries,
  Route,
}

private fun hasBackgroundLocationPermission(context: android.content.Context): Boolean {
  if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return true
  return ContextCompat.checkSelfPermission(
    context,
    Manifest.permission.ACCESS_BACKGROUND_LOCATION,
  ) == PackageManager.PERMISSION_GRANTED
}

@Composable
private fun HomeTabSelector(
  selectedTab: HomeTab,
  onSelected: (HomeTab) -> Unit,
) {
  Row(
    horizontalArrangement = Arrangement.spacedBy(8.dp),
    modifier = Modifier
      .fillMaxWidth()
      .padding(horizontal = 16.dp, vertical = 10.dp),
  ) {
    if (selectedTab == HomeTab.Deliveries) {
      Button(modifier = Modifier.weight(1f), onClick = { onSelected(HomeTab.Deliveries) }) {
        Text("Entregas")
      }
    } else {
      OutlinedButton(modifier = Modifier.weight(1f), onClick = { onSelected(HomeTab.Deliveries) }) {
        Text("Entregas")
      }
    }

    if (selectedTab == HomeTab.Route) {
      Button(modifier = Modifier.weight(1f), onClick = { onSelected(HomeTab.Route) }) {
        Text("Rota")
      }
    } else {
      OutlinedButton(modifier = Modifier.weight(1f), onClick = { onSelected(HomeTab.Route) }) {
        Text("Rota")
      }
    }
  }
}
