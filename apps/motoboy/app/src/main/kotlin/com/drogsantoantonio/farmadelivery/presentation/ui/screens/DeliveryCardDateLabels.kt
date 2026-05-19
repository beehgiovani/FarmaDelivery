package com.drogsantoantonio.farmadelivery.presentation.ui.screens

import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

/** Formata a data do card no fuso de Sao Paulo e usa fallback simples se vier valor inesperado. */
fun deliveryCardDateLabel(value: String): String {
  val trimmed = value.trim()
  return runCatching {
    OffsetDateTime.parse(trimmed)
      .atZoneSameInstant(SAO_PAULO_ZONE)
      .format(DELIVERY_CARD_DATE_FORMATTER)
  }.getOrElse {
    trimmed.take(16).replace("T", " ")
  }
}

private val SAO_PAULO_ZONE = ZoneId.of("America/Sao_Paulo")
private val DELIVERY_CARD_DATE_FORMATTER = DateTimeFormatter.ofPattern("dd/MM HH:mm", Locale.forLanguageTag("pt-BR"))
