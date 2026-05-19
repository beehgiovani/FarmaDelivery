package com.drogsantoantonio.farmadelivery.domain.usecase

import com.drogsantoantonio.farmadelivery.data.api.DeliveryService
import com.drogsantoantonio.farmadelivery.data.models.AcceptDeliveryRequest
import com.drogsantoantonio.farmadelivery.data.models.DeliveryActionRequest
import com.drogsantoantonio.farmadelivery.data.models.DeliveryDto
import com.drogsantoantonio.farmadelivery.data.models.DeliveryEventDto
import com.drogsantoantonio.farmadelivery.data.models.DeliveryMutationResponse
import com.drogsantoantonio.farmadelivery.data.models.DeliveryProofDto
import com.drogsantoantonio.farmadelivery.data.models.UploadDeliveryProofRequest
import com.drogsantoantonio.farmadelivery.data.repository.DeliveryRepository
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals

class DeliveryUseCasesTest {
  @Test
  fun `fetch deliveries returns repository deliveries`() = runTest {
    val service = FakeDeliveryService(
      deliveries = listOf(
        delivery(id = "delivery-1", publicCode = "FD-001"),
        delivery(id = "delivery-2", publicCode = "FD-002"),
      ),
    )
    val useCase = FetchDeliveriesUseCase(DeliveryRepository(service))

    val deliveries = useCase()

    assertEquals(listOf("delivery-1", "delivery-2"), deliveries.map { it.id })
    assertEquals(1, service.listDeliveriesCalls)
  }

  @Test
  fun `accept delivery forwards delivery and courier ids`() = runTest {
    val service = FakeDeliveryService()
    val useCase = AcceptDeliveryUseCase(DeliveryRepository(service))

    useCase(deliveryId = "delivery-1", courierId = "courier-1")

    assertEquals(AcceptDeliveryRequest(deliveryId = "delivery-1", courierId = "courier-1"), service.accepted)
  }

  @Test
  fun `deliver can be completed without proof image`() = runTest {
    val service = FakeDeliveryService()
    val repository = DeliveryRepository(service)

    repository.deliver(deliveryId = "delivery-1", notes = "Recebido por Maria")

    assertEquals(
      DeliveryActionRequest(
        deliveryId = "delivery-1",
        notes = "Recebido por Maria",
        proofId = null,
      ),
      service.delivered,
    )
  }

  private class FakeDeliveryService(
    private val deliveries: List<DeliveryDto> = emptyList(),
  ) : DeliveryService {
    var listDeliveriesCalls = 0
    var accepted: AcceptDeliveryRequest? = null
    var delivered: DeliveryActionRequest? = null

    override suspend fun listDeliveries(): List<DeliveryDto> {
      listDeliveriesCalls += 1
      return deliveries
    }

    override suspend fun accept(body: AcceptDeliveryRequest): DeliveryMutationResponse {
      accepted = body
      return mutationResponse(status = "ACEITA_PELO_MOTOBOY")
    }

    override suspend fun listEvents(deliveryId: String): List<DeliveryEventDto> = emptyList()

    override suspend fun uploadProof(
      deliveryId: String,
      body: UploadDeliveryProofRequest,
    ): DeliveryProofDto {
      error("Not needed for this test")
    }

    override suspend fun collect(body: DeliveryActionRequest): DeliveryMutationResponse = mutationResponse("COLETADA")

    override suspend fun startRoute(body: DeliveryActionRequest): DeliveryMutationResponse = mutationResponse("EM_ROTA")

    override suspend fun deliver(body: DeliveryActionRequest): DeliveryMutationResponse {
      delivered = body
      return mutationResponse("ENTREGUE")
    }

    override suspend fun problem(body: DeliveryActionRequest): DeliveryMutationResponse = mutationResponse("PROBLEMA")
  }
}

private fun delivery(id: String, publicCode: String) = DeliveryDto(
  id = id,
  publicCode = publicCode,
  store = "Drogaria Santo Antonio",
  customer = "Cliente Teste",
  phone = "11999999999",
  address = "Rua Teste, 123",
  status = "AGUARDANDO_MOTOBOY",
  courier = "",
  createdAt = "2026-05-15T00:00:00.000Z",
  priority = "NORMAL",
)

private fun mutationResponse(status: String) = DeliveryMutationResponse(
  id = "delivery-1",
  publicCode = "FD-001",
  status = status,
)
