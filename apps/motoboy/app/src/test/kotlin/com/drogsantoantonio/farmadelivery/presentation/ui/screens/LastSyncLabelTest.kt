package com.drogsantoantonio.farmadelivery.presentation.ui.screens

import java.time.Instant
import kotlin.test.Test
import kotlin.test.assertEquals

class LastSyncLabelTest {
  @Test
  fun `shows first update message before sync`() {
    assertEquals("Aguardando primeira atualizacao.", lastSyncLabel(null))
  }

  @Test
  fun `shows current update message for recent sync`() {
    val now = Instant.parse("2026-05-18T15:00:30Z")
    val syncedAt = Instant.parse("2026-05-18T15:00:00Z")

    assertEquals("Atualizado agora.", lastSyncLabel(syncedAt, now))
  }

  @Test
  fun `formats last sync in Sao Paulo timezone`() {
    val now = Instant.parse("2026-05-18T15:10:00Z")
    val syncedAt = Instant.parse("2026-05-18T14:00:00Z")

    assertEquals("Ultima atualizacao as 11:00.", lastSyncLabel(syncedAt, now))
  }
}
