package com.drogsantoantonio.farmadelivery.domain.usecase

import com.drogsantoantonio.farmadelivery.data.api.CourierService
import com.drogsantoantonio.farmadelivery.data.location.DeviceLocation
import com.drogsantoantonio.farmadelivery.data.models.CourierDto
import com.drogsantoantonio.farmadelivery.data.models.CourierAvailabilityRequest
import com.drogsantoantonio.farmadelivery.data.models.CourierLocationRequest
import com.drogsantoantonio.farmadelivery.data.models.DeviceTokenRequest
import com.drogsantoantonio.farmadelivery.data.models.DeviceTokenResponse
import com.drogsantoantonio.farmadelivery.data.repository.CourierRepository
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals

class UpdateLocationUseCaseTest {
  @Test
  fun `update location forwards coordinates and availability`() = runTest {
    val service = FakeCourierService()
    val useCase = UpdateLocationUseCase(CourierRepository(service))

    useCase(
      courierId = "courier-1",
      location = DeviceLocation(latitude = -23.961, longitude = -46.333),
      available = true,
    )

    assertEquals(
      CourierLocationRequest(
        courierId = "courier-1",
        latitude = -23.961,
        longitude = -46.333,
        available = true,
      ),
      service.updatedLocation,
    )
  }

  @Test
  fun `update location can avoid changing availability`() = runTest {
    val service = FakeCourierService()
    val useCase = UpdateLocationUseCase(CourierRepository(service))

    useCase(
      courierId = "courier-1",
      location = DeviceLocation(latitude = -23.961, longitude = -46.333),
      available = null,
    )

    assertEquals(
      CourierLocationRequest(
        courierId = "courier-1",
        latitude = -23.961,
        longitude = -46.333,
        available = null,
      ),
      service.updatedLocation,
    )
  }

  @Test
  fun `repository updates courier availability separately from location`() = runTest {
    val service = FakeCourierService()
    val repository = CourierRepository(service)

    val courier = repository.updateAvailability(courierId = "courier-1", available = false)

    assertEquals(CourierAvailabilityRequest(courierId = "courier-1", available = false), service.updatedAvailability)
    assertEquals(false, courier.available)
  }

  private class FakeCourierService : CourierService {
    var updatedLocation: CourierLocationRequest? = null
    var updatedAvailability: CourierAvailabilityRequest? = null

    override suspend fun listCouriers(): List<CourierDto> = emptyList()

    override suspend fun updateLocation(body: CourierLocationRequest): CourierDto {
      updatedLocation = body
      return CourierDto(
        id = body.courierId,
        name = "Motoboy Teste",
        baseStoreName = "Drogaria Santo Antonio",
        available = body.available == true,
        currentLat = body.latitude,
        currentLng = body.longitude,
        active = true,
      )
    }

    override suspend fun updateAvailability(body: CourierAvailabilityRequest): CourierDto {
      updatedAvailability = body
      return CourierDto(
        id = body.courierId,
        name = "Motoboy Teste",
        baseStoreName = "Drogaria Santo Antonio",
        available = body.available,
        active = true,
      )
    }

    override suspend fun registerDeviceToken(
      courierId: String,
      body: DeviceTokenRequest,
    ): DeviceTokenResponse {
      error("Not needed for this test")
    }
  }
}
