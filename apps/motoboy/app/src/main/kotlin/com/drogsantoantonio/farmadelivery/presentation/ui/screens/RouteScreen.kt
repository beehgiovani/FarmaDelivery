package com.drogsantoantonio.farmadelivery.presentation.ui.screens

import android.content.ActivityNotFoundException
import android.content.Intent
import androidx.core.net.toUri
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
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
import com.drogsantoantonio.farmadelivery.data.models.CourierRouteDto
import com.drogsantoantonio.farmadelivery.data.models.RouteStopDto
import com.drogsantoantonio.farmadelivery.data.repository.RouteRepository
import com.drogsantoantonio.farmadelivery.presentation.navigation.ActiveRouteWithPendingStops
import com.drogsantoantonio.farmadelivery.presentation.navigation.activeRoutesWithPendingStops
import com.drogsantoantonio.farmadelivery.presentation.navigation.buildDirectionsSegment
import com.drogsantoantonio.farmadelivery.presentation.navigation.routeMapsButtonLabel
import com.drogsantoantonio.farmadelivery.presentation.navigation.routeMapsUnavailableText
import com.drogsantoantonio.farmadelivery.presentation.navigation.routeSegmentNoticeText
import kotlinx.coroutines.launch
import java.time.Instant

@Composable
fun RouteScreen(
  routeRepository: RouteRepository,
  onLogout: () -> Unit,
) {
  val scope = rememberCoroutineScope()
  var routes by remember { mutableStateOf<List<CourierRouteDto>>(emptyList()) }
  var loading by remember { mutableStateOf(true) }
  var error by remember { mutableStateOf<String?>(null) }
  var lastSyncedAt by remember { mutableStateOf<Instant?>(null) }

  fun refresh() {
    scope.launch {
      loading = true
      error = null
      try {
        routes = routeRepository.activeRoutes()
        lastSyncedAt = Instant.now()
      } catch (failure: Exception) {
        error = failure.message ?: "Nao foi possivel carregar a rota."
      } finally {
        loading = false
      }
    }
  }

  LaunchedEffect(Unit) {
    refresh()
  }

  Surface {
    Column(
      modifier = Modifier
        .fillMaxSize()
        .padding(16.dp),
    ) {
      val activeRoutes = remember(routes) { activeRoutesWithPendingStops(routes) }
      Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
        Column {
          Text("Rota atual", style = MaterialTheme.typography.headlineSmall)
          Text("Paradas em andamento", style = MaterialTheme.typography.bodyMedium)
          Text(
            lastSyncLabel(lastSyncedAt),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodySmall,
          )
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
          OutlinedButton(enabled = !loading, onClick = { refresh() }) {
            Text("Atualizar")
          }
          OutlinedButton(onClick = onLogout) {
            Text("Sair")
          }
        }
      }

      Spacer(Modifier.height(16.dp))

      when {
        loading -> RouteLoadingState("Carregando rota...")
        error != null -> RouteErrorState(
          message = error ?: "Nao foi possivel carregar a rota.",
          onRetry = { refresh() },
        )
        activeRoutes.isEmpty() -> RouteEmptyState(
          message = "Nenhuma parada pendente na rota.",
          onRefresh = { refresh() },
        )
        else -> LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
          items(activeRoutes, key = { it.route.id }) { activeRoute ->
            RouteCard(activeRoute = activeRoute)
          }
        }
      }
    }
  }
}

@Composable
private fun RouteLoadingState(message: String) {
  OperationalStateLayout(
    title = "Carregando rota",
    description = message,
    tone = OperationalStateTone.Loading,
  )
}

@Composable
private fun RouteErrorState(message: String, onRetry: () -> Unit) {
  OperationalStateLayout(
    title = "Nao foi possivel carregar a rota",
    description = message,
    tone = OperationalStateTone.Error,
    actionLabel = "Tentar novamente",
    onAction = onRetry,
  )
}

@Composable
private fun RouteEmptyState(message: String, onRefresh: () -> Unit) {
  OperationalStateLayout(
    title = message,
    actionLabel = "Atualizar",
    onAction = onRefresh,
  )
}

@Composable
private fun RouteCard(activeRoute: ActiveRouteWithPendingStops) {
  val context = LocalContext.current
  val route = activeRoute.route
  val pendingStops = activeRoute.pendingStops
  val mapsSegment = remember(pendingStops) { buildDirectionsSegment(pendingStops) }
  val routeSegmentNotice = remember(mapsSegment) { routeSegmentNoticeText(mapsSegment) }
  val routeMapsUnavailable = remember(mapsSegment) { routeMapsUnavailableText(mapsSegment) }
  val mapsButtonLabel = remember(mapsSegment) { routeMapsButtonLabel(mapsSegment) }
  var mapError by remember { mutableStateOf<String?>(null) }

  Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
    Column(Modifier.padding(14.dp)) {
      Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.weight(1f)) {
          Text(route.courier.name, style = MaterialTheme.typography.titleMedium)
          Text(routeStatusLabel(route.status), color = MaterialTheme.colorScheme.primary)
        }
        if (routeMapsUnavailable == null) {
          OutlinedButton(
            onClick = {
              try {
                mapError = null
                context.startActivity(Intent(Intent.ACTION_VIEW, mapsSegment.url.toUri()))
              } catch (_: ActivityNotFoundException) {
                mapError = "Nenhum app de mapas encontrado."
              }
            },
          ) {
            Text(mapsButtonLabel)
          }
        }
      }
      Spacer(Modifier.height(10.dp))
      routeMapsUnavailable?.let { notice ->
        Text(
          text = notice,
          style = MaterialTheme.typography.bodySmall,
          color = MaterialTheme.colorScheme.primary,
        )
        Spacer(Modifier.height(8.dp))
      }
      mapError?.let {
        Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
        Spacer(Modifier.height(8.dp))
      }
      routeSegmentNotice?.let { notice ->
        Text(
          text = notice,
          style = MaterialTheme.typography.bodySmall,
          color = MaterialTheme.colorScheme.primary,
        )
        Spacer(Modifier.height(8.dp))
      }

      if (pendingStops.isEmpty()) {
        Text("Sem paradas pendentes.")
      } else {
        pendingStops.forEach { stop ->
          RouteStopRow(stop)
        }
      }
    }
  }
}

@Composable
private fun RouteStopRow(stop: RouteStopDto) {
  Column(Modifier.padding(vertical = 6.dp)) {
    Text("${stop.sequence}. ${routeStopTitle(stop)}", style = MaterialTheme.typography.titleSmall)
    routeStopDetails(stop)?.let {
      Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.primary)
    }
    Text(stop.address, style = MaterialTheme.typography.bodyMedium)
    routeStopScheduleLabel(stop.earliestAt)?.let {
      Text(it, style = MaterialTheme.typography.bodySmall)
    }
  }
}
