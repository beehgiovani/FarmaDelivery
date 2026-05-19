package com.drogsantoantonio.farmadelivery.presentation.ui.screens

fun availabilityActionLabel(available: Boolean, loading: Boolean): String {
  if (loading) return "Salvando..."
  return if (available) "Pausar corridas" else "Ativar corridas"
}

fun automaticLocationActionLabel(trackingEnabled: Boolean): String {
  return if (trackingEnabled) "Parar auto" else "Ligar auto"
}

fun sendLocationActionLabel(loading: Boolean): String {
  return if (loading) "Enviando..." else "Enviar GPS"
}
