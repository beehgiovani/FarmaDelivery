package com.drogsantoantonio.farmadelivery.presentation.ui.screens

import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

/** Formata o agendamento da parada no fuso de Sao Paulo e omite quando nao existir horario. */
fun routeStopScheduleLabel(earliestAt: String?): String? {
  val trimmed = earliestAt?.trim().orEmpty()
  if (trimmed.isBlank()) return null

  val formatted = runCatching {
    OffsetDateTime.parse(trimmed)
      .atZoneSameInstant(SAO_PAULO_ZONE)
      .format(ROUTE_STOP_SCHEDULE_FORMATTER)
  }.getOrElse {
    trimmed.take(16).replace("T", " ")
  }

  return "A partir de $formatted"
}

private val SAO_PAULO_ZONE = ZoneId.of("America/Sao_Paulo")
private val ROUTE_STOP_SCHEDULE_FORMATTER = DateTimeFormatter.ofPattern("dd/MM HH:mm", Locale.forLanguageTag("pt-BR"))
