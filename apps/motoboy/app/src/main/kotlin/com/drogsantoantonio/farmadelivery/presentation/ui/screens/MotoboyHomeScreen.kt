package com.drogsantoantonio.farmadelivery.presentation.ui.screens

import android.Manifest
import android.os.Build
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
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import com.drogsantoantonio.farmadelivery.R
import com.drogsantoantonio.farmadelivery.data.models.AuthSession
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
  val courierId = session.courier?.id
  val notificationPermissionLauncher = rememberLauncherForActivityResult(
    contract = ActivityResultContracts.RequestPermission(),
    onResult = {},
  )

  LaunchedEffect(Unit) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
    }
  }

  LaunchedEffect(courierId) {
    if (courierId == null) return@LaunchedEffect

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
        onAvailabilityChanged = { available = it },
      )

      when (tab) {
        HomeTab.Deliveries -> DeliveriesScreen(
          session = session,
          deliveryRepository = deliveryRepository,
          courierRepository = courierRepository,
          available = available,
          onAvailabilityChanged = { available = it },
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

private enum class HomeTab {
  Deliveries,
  Route,
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
