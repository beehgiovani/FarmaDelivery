package com.drogsantoantonio.farmadelivery.presentation.ui.screens

import java.time.Duration
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

fun lastSyncLabel(value: Instant?, now: Instant = Instant.now()): String {
  if (value == null) return "Aguardando primeira atualizacao."

  val diff = Duration.between(value, now).coerceAtLeast(Duration.ZERO)
  if (diff < Duration.ofMinutes(1)) return "Atualizado agora."

  return "Ultima atualizacao as ${LAST_SYNC_FORMATTER.format(value.atZone(SAO_PAULO_ZONE))}."
}

private val SAO_PAULO_ZONE = ZoneId.of("America/Sao_Paulo")
private val LAST_SYNC_FORMATTER = DateTimeFormatter.ofPattern("HH:mm", Locale.forLanguageTag("pt-BR"))
