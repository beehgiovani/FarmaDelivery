package com.drogsantoantonio.farmadelivery.presentation.ui.screens

import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

fun deliveryEventTimestampLabel(createdAt: String): String {
  return runCatching {
    OffsetDateTime.parse(createdAt)
      .atZoneSameInstant(SAO_PAULO_ZONE)
      .format(EVENT_TIMESTAMP_FORMATTER)
  }.getOrElse {
    createdAt.take(16).replace("T", " ")
  }
}

private val SAO_PAULO_ZONE = ZoneId.of("America/Sao_Paulo")
private val EVENT_TIMESTAMP_FORMATTER = DateTimeFormatter.ofPattern("dd/MM HH:mm", Locale.forLanguageTag("pt-BR"))
