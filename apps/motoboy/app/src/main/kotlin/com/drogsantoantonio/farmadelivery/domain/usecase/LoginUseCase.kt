package com.drogsantoantonio.farmadelivery.domain.usecase

import com.drogsantoantonio.farmadelivery.data.repository.AuthRepository

/** Caso de uso para autenticar o motoboy e receber a sessao assinada pela API. */
class LoginUseCase(private val repository: AuthRepository) {
  suspend operator fun invoke(identifier: String, password: String) = repository.login(identifier, password)
}
