package com.drogsantoantonio.farmadelivery.data.repository

import com.drogsantoantonio.farmadelivery.data.api.RouteService
import com.drogsantoantonio.farmadelivery.data.models.CourierRouteDto
import com.drogsantoantonio.farmadelivery.data.models.RouteCourierDto
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals

class RouteRepositoryTest {
  @Test
  fun `active routes delegates to route service`() = runTest {
    val routes = listOf(route("route-1"), route("route-2"))
    val service = FakeRouteService(routes)
    val repository = RouteRepository(service)

    assertEquals(routes, repository.activeRoutes())
    assertEquals(1, service.activeRoutesCalls)
  }

  private class FakeRouteService(
    private val routes: List<CourierRouteDto>,
  ) : RouteService {
    var activeRoutesCalls = 0

    override suspend fun activeRoutes(): List<CourierRouteDto> {
      activeRoutesCalls += 1
      return routes
    }
  }
}

private fun route(id: String) = CourierRouteDto(
  id = id,
  status = "ATIVA",
  courier = RouteCourierDto(
    id = "courier-1",
    name = "Motoboy Teste",
    baseStoreName = "Drogaria Santo Antonio",
  ),
  createdAt = "2026-05-15T00:00:00.000Z",
  stops = emptyList(),
)
