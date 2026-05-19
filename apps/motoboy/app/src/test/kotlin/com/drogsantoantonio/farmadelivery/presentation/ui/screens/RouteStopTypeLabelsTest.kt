package com.drogsantoantonio.farmadelivery.presentation.ui.screens

import kotlin.test.Test
import kotlin.test.assertEquals

class RouteStopTypeLabelsTest {
  @Test
  fun `maps known route stop types to readable labels`() {
    assertEquals("Coleta", routeStopTypeLabel("COLETA"))
    assertEquals("Entrega", routeStopTypeLabel("ENTREGA"))
  }

  @Test
  fun `formats unknown route stop types without raw underscores`() {
    assertEquals("Retirada extra", routeStopTypeLabel("RETIRADA_EXTRA"))
  }

  @Test
  fun `uses a safe fallback for blank route stop types`() {
    assertEquals("Parada", routeStopTypeLabel("   "))
  }
}
