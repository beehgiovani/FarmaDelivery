package com.drogsantoantonio.farmadelivery.presentation.ui.screens

import kotlin.test.Test
import kotlin.test.assertEquals

class PhoneDialTest {
  @Test
  fun `keeps only digits in phone dial uri`() {
    assertEquals("tel:13991234567", phoneDialUriString("(13) 99123-4567"))
  }

  @Test
  fun `returns an empty tel uri when phone has no digits`() {
    assertEquals("tel:", phoneDialUriString("sem telefone"))
  }
}
