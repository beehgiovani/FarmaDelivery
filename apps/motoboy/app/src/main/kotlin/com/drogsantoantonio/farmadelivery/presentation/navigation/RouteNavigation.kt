package com.drogsantoantonio.farmadelivery.presentation.navigation

import com.drogsantoantonio.farmadelivery.data.models.CourierRouteDto
import com.drogsantoantonio.farmadelivery.data.models.RouteStopDto
import java.net.URLEncoder

data class ActiveRouteWithPendingStops(
  val route: CourierRouteDto,
  val pendingStops: List<RouteStopDto>,
)

data class RouteMapsSegment(
  val url: String,
  val includedStops: List<RouteStopDto>,
  val remainingStopsCount: Int,
)

/** Monta uma URL simples do Google Maps usando o primeiro trecho navegavel da rota. */
fun buildDirectionsUrl(stops: List<RouteStopDto>): String {
  return buildDirectionsSegment(stops).url
}

/** Retorna somente rotas abertas/em andamento que ainda tenham parada pendente para o motoboy executar. */
fun activeRoutesWithPendingStops(routes: List<CourierRouteDto>): List<ActiveRouteWithPendingStops> {
  return routes
    .filter { it.status in ACTIVE_ROUTE_STATUSES }
    .map { route -> ActiveRouteWithPendingStops(route, pendingStopsInSequence(route.stops)) }
    .filter { it.pendingStops.isNotEmpty() }
}

/** Ordena as paradas pendentes pela sequencia definida no backend. */
fun pendingStopsInSequence(stops: List<RouteStopDto>): List<RouteStopDto> {
  return stops
    .filter { it.status == "PENDENTE" }
    .sortedBy { it.sequence }
}

/** Divide rotas longas no primeiro trecho compativel com o limite de waypoints do Google Maps. */
fun buildDirectionsSegment(stops: List<RouteStopDto>): RouteMapsSegment {
  val pendingStops = navigableStopsInSequence(stops)
  val includedStops = pendingStops.take(MAX_GOOGLE_MAPS_STOPS_PER_URL)
  val url = buildDirectionsUrlForIncludedStops(includedStops)

  return RouteMapsSegment(
    url = url,
    includedStops = includedStops,
    remainingStopsCount = (pendingStops.size - includedStops.size).coerceAtLeast(0),
  )
}

/** Explica para o motoboy quando ainda ficarem paradas para abrir depois no Maps. */
fun routeSegmentNoticeText(segment: RouteMapsSegment): String? {
  if (segment.remainingStopsCount <= 0) return null
  val suffix = if (segment.remainingStopsCount == 1) "parada" else "paradas"
  return "Maps abre as proximas ${segment.includedStops.size} paradas. Depois restam ${segment.remainingStopsCount} $suffix."
}

/** Ajusta o label do botao conforme a rota abre inteira ou apenas em trecho. */
fun routeMapsButtonLabel(segment: RouteMapsSegment): String {
  if (segment.includedStops.isEmpty()) return "Enderecos pendentes"
  return if (segment.remainingStopsCount > 0) "Abrir trecho no Maps" else "Abrir Maps"
}

/** Explica quando nenhuma parada pendente tem endereco suficiente para abrir no Maps. */
fun routeMapsUnavailableText(segment: RouteMapsSegment): String? {
  return if (segment.includedStops.isEmpty()) {
    "Nenhuma parada pendente tem endereco confirmado para abrir no Maps."
  } else {
    null
  }
}

/** Monta a URL final para o Google Maps a partir das paradas ja cortadas no limite seguro. */
private fun buildDirectionsUrlForIncludedStops(includedStops: List<RouteStopDto>): String {
  val destination = includedStops.lastOrNull()
    ?: return "https://www.google.com/maps/dir/?api=1&travelmode=driving"
  val waypoints = includedStops
    .dropLast(1)
    .joinToString("|") { it.mapsPoint() }

  return buildString {
    append("https://www.google.com/maps/dir/?api=1")
    append("&origin=").append(urlEncode("Current Location"))
    append("&destination=").append(urlEncode(destination.mapsPoint()))
    if (waypoints.isNotBlank()) {
      append("&waypoints=").append(urlEncode(waypoints))
    }
    append("&travelmode=driving")
  }
}

/** Usa coordenadas quando existem; senao usa endereco textual limpo para o Maps. */
fun RouteStopDto.mapsPoint(): String {
  return if (latitude != null && longitude != null) {
    "$latitude,$longitude"
  } else {
    address.trim()
  }
}

/** Remove paradas sem status pendente ou sem ponto navegavel antes de montar a URL. */
private fun navigableStopsInSequence(stops: List<RouteStopDto>): List<RouteStopDto> {
  return pendingStopsInSequence(stops).filter { it.hasNavigableMapsPoint() }
}

/** Confirma se a parada tem coordenada ou endereco suficiente para abrir no mapa. */
private fun RouteStopDto.hasNavigableMapsPoint(): Boolean {
  return (latitude != null && longitude != null) || address.trim().isNotEmpty()
}

/** Codifica partes da URL preservando espacos como %20 para o Google Maps. */
private fun urlEncode(value: String): String {
  return URLEncoder.encode(value, "UTF-8").replace("+", "%20")
}

private val ACTIVE_ROUTE_STATUSES = setOf("ABERTA", "EM_ANDAMENTO")
private const val MAX_GOOGLE_MAPS_WAYPOINTS = 8
private const val MAX_GOOGLE_MAPS_STOPS_PER_URL = MAX_GOOGLE_MAPS_WAYPOINTS + 1
