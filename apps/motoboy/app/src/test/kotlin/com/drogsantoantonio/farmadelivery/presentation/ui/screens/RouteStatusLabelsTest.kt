package com.drogsantoantonio.farmadelivery.presentation.ui.screens

import kotlin.test.Test
import kotlin.test.assertEquals

class RouteStatusLabelsTest {
  @Test
  fun `maps known route statuses to readable labels`() {
    assertEquals("Aberta", routeStatusLabel("ABERTA"))
    assertEquals("Em andamento", routeStatusLabel("EM_ANDAMENTO"))
    assertEquals("Finalizada", routeStatusLabel("FINALIZADA"))
    assertEquals("Cancelada", routeStatusLabel("CANCELADA"))
  }

  @Test
  fun `formats unknown route statuses without raw underscores`() {
    assertEquals("Pausada temporaria", routeStatusLabel("PAUSADA_TEMPORARIA"))
  }

  @Test
  fun `uses a safe fallback for blank route statuses`() {
    assertEquals("Status desconhecido", routeStatusLabel("   "))
  }
}
