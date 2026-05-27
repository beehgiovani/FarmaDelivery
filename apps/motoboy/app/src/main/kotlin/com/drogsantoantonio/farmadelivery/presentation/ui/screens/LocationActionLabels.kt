package com.drogsantoantonio.farmadelivery.presentation.ui.screens

fun availabilityActionLabel(available: Boolean, loading: Boolean): String {
  if (loading) return "Salvando..."
  return if (available) "Parar corridas" else "Comecar corridas"
}

fun automaticLocationActionLabel(trackingEnabled: Boolean): String {
  return if (trackingEnabled) "Parar GPS ao vivo" else "Ligar GPS ao vivo"
}

fun sendLocationActionLabel(loading: Boolean): String {
  return if (loading) "Enviando..." else "Enviar minha posicao"
}
