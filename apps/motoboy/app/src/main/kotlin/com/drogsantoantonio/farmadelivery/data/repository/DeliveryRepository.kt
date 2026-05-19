package com.drogsantoantonio.farmadelivery.data.repository

import com.drogsantoantonio.farmadelivery.data.api.DeliveryService
import com.drogsantoantonio.farmadelivery.data.models.AcceptDeliveryRequest
import com.drogsantoantonio.farmadelivery.data.models.DeliveryActionRequest
import com.drogsantoantonio.farmadelivery.data.models.DeliveryDto
import com.drogsantoantonio.farmadelivery.data.models.DeliveryEventDto
import com.drogsantoantonio.farmadelivery.data.models.DeliveryProofDto
import com.drogsantoantonio.farmadelivery.data.models.UploadDeliveryProofRequest

class DeliveryRepository(private val service: DeliveryService) {
  /** Lista as entregas visiveis para o motoboy logado. */
  suspend fun list(): List<DeliveryDto> = service.listDeliveries()

  /** Carrega o historico auditavel de uma entrega especifica. */
  suspend fun events(deliveryId: String): List<DeliveryEventDto> = service.listEvents(deliveryId)

  /** Aceita uma entrega para o motoboy informado. */
  suspend fun accept(deliveryId: String, courierId: String) {
    service.accept(AcceptDeliveryRequest(deliveryId = deliveryId, courierId = courierId))
  }

  /** Marca que a entrega foi coletada na loja. */
  suspend fun collect(deliveryId: String, notes: String? = null) {
    service.collect(DeliveryActionRequest(deliveryId = deliveryId, notes = notes))
  }

  /** Marca que o motoboy saiu em rota com a entrega. */
  suspend fun startRoute(deliveryId: String, notes: String? = null) {
    service.startRoute(DeliveryActionRequest(deliveryId = deliveryId, notes = notes))
  }

  /** Conclui a entrega; proofId e opcional para nao bloquear a operacao sem foto. */
  suspend fun deliver(deliveryId: String, notes: String? = null, proofId: String? = null) {
    service.deliver(DeliveryActionRequest(deliveryId = deliveryId, notes = notes, proofId = proofId))
  }

  /** Registra uma ocorrencia quando a entrega nao pode ser concluida normalmente. */
  suspend fun problem(deliveryId: String, notes: String) {
    service.problem(DeliveryActionRequest(deliveryId = deliveryId, notes = notes))
  }

  /** Envia uma foto opcional de comprovante e devolve o registro criado pela API. */
  suspend fun uploadProof(
    deliveryId: String,
    fileName: String,
    mimeType: String,
    contentBase64: String,
  ): DeliveryProofDto {
    return service.uploadProof(
      deliveryId,
      UploadDeliveryProofRequest(
        fileName = fileName,
        mimeType = mimeType,
        contentBase64 = contentBase64,
      ),
    )
  }
}
