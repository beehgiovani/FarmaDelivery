package com.drogsantoantonio.farmadelivery.domain.usecase

import com.drogsantoantonio.farmadelivery.data.repository.DeliveryRepository

/** Caso de uso para o motoboy aceitar uma entrega disponivel para o proprio cadastro. */
class AcceptDeliveryUseCase(private val repository: DeliveryRepository) {
  suspend operator fun invoke(deliveryId: String, courierId: String) = repository.accept(deliveryId, courierId)
}
