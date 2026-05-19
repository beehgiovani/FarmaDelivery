package com.drogsantoantonio.farmadelivery.presentation.navigation

import com.drogsantoantonio.farmadelivery.data.models.CourierRouteDto
import com.drogsantoantonio.farmadelivery.data.models.RouteCourierDto
import com.drogsantoantonio.farmadelivery.data.models.RouteStopDto
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class RouteNavigationTest {
  @Test
  fun `keeps pending stops grouped by active route`() {
    val routes = activeRoutesWithPendingStops(
      listOf(
        route(id = "route-1", status = "ABERTA", stops = listOf(stop(sequence = 2, address = "Rua 2"), stop(sequence = 1, address = "Rua 1"))),
        route(id = "route-2", status = "EM_ANDAMENTO", stops = listOf(stop(sequence = 1, address = "Rua 3"), stop(sequence = 2, address = "Rua 4", status = "CONCLUIDA"))),
        route(id = "route-3", status = "FINALIZADA", stops = listOf(stop(sequence = 1, address = "Rua ignorada"))),
        route(id = "route-4", status = "ABERTA", stops = listOf(stop(sequence = 1, address = "Rua concluida", status = "CONCLUIDA"))),
      ),
    )

    assertEquals(2, routes.size)
    assertEquals("route-1", routes[0].route.id)
    assertEquals(listOf("Rua 1", "Rua 2"), routes[0].pendingStops.map { it.address })
    assertEquals("route-2", routes[1].route.id)
    assertEquals(listOf("Rua 3"), routes[1].pendingStops.map { it.address })
  }

  @Test
  fun `keeps only pending stops ordered by route sequence`() {
    val stops = pendingStopsInSequence(
      listOf(
        stop(sequence = 3, address = "Rua 3"),
        stop(sequence = 1, address = "Rua concluida", status = "CONCLUIDA"),
        stop(sequence = 2, address = "Rua 2"),
        stop(sequence = 1, address = "Rua 1"),
      ),
    )

    assertEquals(listOf("Rua 1", "Rua 2", "Rua 3"), stops.map { it.address })
  }

  @Test
  fun `uses last pending stop as maps destination and previous stops as waypoints`() {
    val url = buildDirectionsUrl(
      listOf(
        stop(sequence = 2, address = "Rua 2"),
        stop(sequence = 1, address = "Rua 1"),
        stop(sequence = 3, address = "Rua 3"),
      ),
    )

    assertTrue(url.contains("origin=Current%20Location"))
    assertTrue(url.contains("destination=Rua%203"))
    assertTrue(url.contains("waypoints=Rua%201%7CRua%202"))
    assertTrue(url.contains("travelmode=driving"))
  }

  @Test
  fun `ignores completed route stops when building maps sequence`() {
    val url = buildDirectionsUrl(
      listOf(
        stop(sequence = 1, address = "Rua concluida", status = "CONCLUIDA"),
        stop(sequence = 2, address = "Rua pendente"),
      ),
    )

    assertTrue(url.contains("destination=Rua%20pendente"))
    assertTrue(!url.contains("waypoints="))
  }

  @Test
  fun `builds a safe maps URL when there are no pending stops`() {
    val segment = buildDirectionsSegment(
      listOf(
        stop(sequence = 1, address = "Rua concluida", status = "CONCLUIDA"),
      ),
    )

    assertEquals("https://www.google.com/maps/dir/?api=1&travelmode=driving", segment.url)
    assertEquals(0, segment.includedStops.size)
    assertEquals(0, segment.remainingStopsCount)
  }

  @Test
  fun `limits Google Maps to a continuous first route segment`() {
    val url = buildDirectionsUrl(
      (1..12).map { sequence -> stop(sequence = sequence, address = "Rua $sequence") },
    )

    assertTrue(url.contains("destination=Rua%209"))
    assertTrue(url.contains("waypoints=Rua%201%7CRua%202%7CRua%203%7CRua%204%7CRua%205%7CRua%206%7CRua%207%7CRua%208"))
    assertTrue(!url.contains("Rua%2012"))
  }

  @Test
  fun `reports route stops left out of the current Google Maps segment`() {
    val segment = buildDirectionsSegment(
      (1..12).map { sequence -> stop(sequence = sequence, address = "Rua $sequence") },
    )

    assertEquals(9, segment.includedStops.size)
    assertEquals(3, segment.remainingStopsCount)
    assertTrue(segment.url.contains("destination=Rua%209"))
  }

  @Test
  fun `keeps direct maps URL and route segment URL equivalent`() {
    val stops = (1..12).map { sequence -> stop(sequence = sequence, address = "Rua $sequence") }

    assertEquals(buildDirectionsSegment(stops).url, buildDirectionsUrl(stops))
  }

  @Test
  fun `builds route segment notice only when stops remain`() {
    val completeSegment = buildDirectionsSegment(
      (1..3).map { sequence -> stop(sequence = sequence, address = "Rua $sequence") },
    )
    val longSegment = buildDirectionsSegment(
      (1..12).map { sequence -> stop(sequence = sequence, address = "Rua $sequence") },
    )
    val oneRemainingSegment = buildDirectionsSegment(
      (1..10).map { sequence -> stop(sequence = sequence, address = "Rua $sequence") },
    )

    assertEquals(null, routeSegmentNoticeText(completeSegment))
    assertEquals("Maps abre as proximas 9 paradas. Depois restam 3 paradas.", routeSegmentNoticeText(longSegment))
    assertEquals("Maps abre as proximas 9 paradas. Depois restam 1 parada.", routeSegmentNoticeText(oneRemainingSegment))
  }

  @Test
  fun `uses a route maps button label that matches full or partial segments`() {
    val completeSegment = buildDirectionsSegment(
      (1..3).map { sequence -> stop(sequence = sequence, address = "Rua $sequence") },
    )
    val longSegment = buildDirectionsSegment(
      (1..12).map { sequence -> stop(sequence = sequence, address = "Rua $sequence") },
    )
    val emptySegment = buildDirectionsSegment(
      listOf(stop(sequence = 1, address = "   ")),
    )

    assertEquals("Abrir Maps", routeMapsButtonLabel(completeSegment))
    assertEquals("Abrir trecho no Maps", routeMapsButtonLabel(longSegment))
    assertEquals("Enderecos pendentes", routeMapsButtonLabel(emptySegment))
  }

  @Test
  fun `explains when a route has no pending stop that can open in Maps`() {
    val emptySegment = buildDirectionsSegment(
      listOf(stop(sequence = 1, address = "   ")),
    )
    val completeSegment = buildDirectionsSegment(
      listOf(stop(sequence = 1, address = "Rua 1")),
    )

    assertEquals("Nenhuma parada pendente tem endereco confirmado para abrir no Maps.", routeMapsUnavailableText(emptySegment))
    assertEquals(null, routeMapsUnavailableText(completeSegment))
  }

  @Test
  fun `prefers coordinates over address for maps points`() {
    assertEquals(
      "-23.961,-46.333",
      stop(sequence = 1, address = "Rua Teste", latitude = -23.961, longitude = -46.333).mapsPoint(),
    )
  }

  @Test
  fun `trims address maps points when coordinates are unavailable`() {
    assertEquals(
      "Rua Teste",
      stop(sequence = 1, address = "  Rua Teste  ").mapsPoint(),
    )
  }

  @Test
  fun `skips pending stops without coordinates or address when building maps route`() {
    val segment = buildDirectionsSegment(
      listOf(
        stop(sequence = 1, address = "  "),
        stop(sequence = 2, address = "Rua Valida"),
      ),
    )

    assertEquals(listOf("Rua Valida"), segment.includedStops.map { it.address })
    assertTrue(segment.url.contains("destination=Rua%20Valida"))
    assertTrue(!segment.url.contains("waypoints="))
  }

  private fun stop(
    sequence: Int,
    address: String,
    status: String = "PENDENTE",
    latitude: Double? = null,
    longitude: Double? = null,
  ): RouteStopDto {
    return RouteStopDto(
      id = "stop-$sequence",
      sequence = sequence,
      type = "ENTREGA",
      status = status,
      address = address,
      latitude = latitude,
      longitude = longitude,
    )
  }

  private fun route(
    id: String,
    status: String,
    stops: List<RouteStopDto>,
  ): CourierRouteDto {
    return CourierRouteDto(
      id = id,
      status = status,
      courier = RouteCourierDto(
        id = "courier-1",
        name = "Motoboy Teste",
        baseStoreName = "Drogaria Santo Antonio",
      ),
      createdAt = "2026-05-15T12:00:00.000Z",
      stops = stops,
    )
  }
}
