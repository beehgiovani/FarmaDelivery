package com.drogsantoantonio.farmadelivery.presentation.ui.screens

fun phoneDialUriString(phone: String): String {
  return "tel:${phone.filter { it.isDigit() }}"
}
