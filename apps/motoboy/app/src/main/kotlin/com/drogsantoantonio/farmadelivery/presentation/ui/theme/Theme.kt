package com.drogsantoantonio.farmadelivery.presentation.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val BrandBlue = Color(0xFF275397)
private val BrandRed = Color(0xFFEF2B2D)
private val BrandInk = Color(0xFF172033)

private val LightColors: ColorScheme = lightColorScheme(
  primary = BrandBlue,
  secondary = BrandRed,
  background = Color(0xFFF7F9FC),
  surface = Color.White,
  onPrimary = Color.White,
  onSecondary = Color.White,
  onBackground = BrandInk,
  onSurface = BrandInk,
)

private val DarkColors: ColorScheme = darkColorScheme(
  primary = Color(0xFF8EA8E8),
  secondary = Color(0xFFFF8B8D),
  background = Color(0xFF101624),
  surface = Color(0xFF172033),
  onPrimary = Color(0xFF0D1730),
  onSecondary = Color(0xFF320708),
  onBackground = Color.White,
  onSurface = Color.White,
)

@Composable
fun FarmaDeliveryTheme(
  darkTheme: Boolean = isSystemInDarkTheme(),
  content: @Composable () -> Unit,
) {
  MaterialTheme(
    colorScheme = if (darkTheme) DarkColors else LightColors,
    content = content,
  )
}
