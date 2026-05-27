package com.drogsantoantonio.farmadelivery.data.api

import com.drogsantoantonio.farmadelivery.BuildConfig
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.sse.EventSource
import okhttp3.sse.EventSourceListener
import okhttp3.sse.EventSources
import java.net.URLEncoder
import java.nio.charset.StandardCharsets

class LiveEventClient(
  private val client: OkHttpClient = OkHttpClient(),
) {
  fun connect(token: String, onOperationalEvent: () -> Unit): EventSource {
    val request = Request.Builder()
      .url(liveEventsUrl(token))
      .build()

    return EventSources.createFactory(client).newEventSource(
      request,
      object : EventSourceListener() {
        override fun onEvent(eventSource: EventSource, id: String?, type: String?, data: String) {
          if (type == "deliveries" || type == "routes") {
            onOperationalEvent()
          }
        }

        override fun onFailure(eventSource: EventSource, t: Throwable?, response: Response?) {
          eventSource.cancel()
        }
      },
    )
  }
}

fun liveEventsUrl(token: String): String {
  val encodedToken = URLEncoder.encode(token, StandardCharsets.UTF_8.toString())
  return "${BuildConfig.FARMADELIVERY_API_URL.trimEnd('/')}/live/events?token=$encodedToken"
}
