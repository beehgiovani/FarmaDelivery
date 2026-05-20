package com.drogsantoantonio.farmadelivery.presentation.ui.screens

private val technicalErrorTerms = listOf(
  "api",
  "backend",
  "database",
  "supabase",
  "rest",
  "token",
  "jwt",
  "http",
  "json",
  "timeout",
  "connectexception",
  "unknownhost",
  "econnrefused",
  "etimedout",
  "enotfound",
  "status",
  "500",
  "404",
  "403",
  "401",
)

fun courierFacingError(failure: Throwable, fallback: String): String {
  val message = failure.message?.trim().orEmpty()
  if (message.isBlank()) return fallback
  val normalized = message.lowercase()
  return if (technicalErrorTerms.any { normalized.contains(it) }) fallback else message
}
