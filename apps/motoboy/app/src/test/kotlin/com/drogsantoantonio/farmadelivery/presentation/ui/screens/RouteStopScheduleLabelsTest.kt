package com.drogsantoantonio.farmadelivery.presentation.ui.screens

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class RouteStopScheduleLabelsTest {
  @Test
  fun `formats ISO route stop schedule timestamps for display`() {
    assertEquals("A partir de 15/05 09:30", routeStopScheduleLabel("2026-05-15T12:30:00.000Z"))
  }

  @Test
  fun `falls back to a compact raw timestamp when parsing fails`() {
    assertEquals("A partir de 2026-05-15 12:30", routeStopScheduleLabel("2026-05-15T12:30 sem timezone"))
  }

  @Test
  fun `returns null for blank route stop schedule timestamps`() {
    assertNull(routeStopScheduleLabel("   "))
    assertNull(routeStopScheduleLabel(null))
  }
}
