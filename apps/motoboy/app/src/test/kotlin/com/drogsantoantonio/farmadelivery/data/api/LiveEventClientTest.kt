package com.drogsantoantonio.farmadelivery.data.api

import kotlin.test.Test
import kotlin.test.assertContains

class LiveEventClientTest {
  @Test
  fun `builds live event url with encoded token`() {
    val url = liveEventsUrl("token with spaces")

    assertContains(url, "/live/events?token=token+with+spaces")
  }
}
