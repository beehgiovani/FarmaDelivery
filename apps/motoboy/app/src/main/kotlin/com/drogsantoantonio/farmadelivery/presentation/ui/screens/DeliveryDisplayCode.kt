package com.drogsantoantonio.farmadelivery.presentation.ui.screens

/**
 * Mostra o numero curto do dia quando a API ja trouxe a sequencia da loja.
 */
fun deliveryDailyNumberLabel(storeDailyNumber: Int?): String? {
  val number = storeDailyNumber ?: return null
  return "N. dia ${number.toString().padStart(3, '0')}"
}

/**
 * Mantem o codigo publico completo como fallback para entregas antigas sem numeracao diaria.
 */
fun deliveryPrimaryCodeLabel(publicCode: String, storeDailyNumber: Int?): String {
  return deliveryDailyNumberLabel(storeDailyNumber) ?: publicCode
}
