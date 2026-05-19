package com.drogsantoantonio.farmadelivery.domain.usecase

import com.drogsantoantonio.farmadelivery.data.repository.DeliveryRepository

/** Caso de uso para buscar a fila visivel do motoboy conforme o escopo definido pela API. */
class FetchDeliveriesUseCase(private val repository: DeliveryRepository) {
  suspend operator fun invoke() = repository.list()
}
