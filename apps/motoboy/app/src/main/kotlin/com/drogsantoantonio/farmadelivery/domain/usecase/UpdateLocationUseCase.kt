package com.drogsantoantonio.farmadelivery.domain.usecase

import com.drogsantoantonio.farmadelivery.data.location.DeviceLocation
import com.drogsantoantonio.farmadelivery.data.repository.CourierRepository

/** Caso de uso para enviar posicao atual e, quando pedido, atualizar disponibilidade do motoboy. */
class UpdateLocationUseCase(private val repository: CourierRepository) {
  suspend operator fun invoke(courierId: String, location: DeviceLocation, available: Boolean?) {
    repository.updateLocation(
      courierId = courierId,
      latitude = location.latitude,
      longitude = location.longitude,
      available = available,
    )
  }
}
