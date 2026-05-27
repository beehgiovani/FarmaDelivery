import java.util.Properties

plugins {
  id("com.android.application")
  id("org.jetbrains.kotlin.plugin.compose")
  id("org.jetbrains.kotlin.plugin.serialization")
  id("com.google.gms.google-services")
}

val localProperties = Properties().apply {
  val file = rootProject.file("local.properties")
  if (file.exists()) {
    file.inputStream().use(::load)
  }
}

android {
  namespace = "com.drogsantoantonio.farmadelivery"
  compileSdk = 36

  defaultConfig {
    applicationId = "com.drogsantoantonio.farmadelivery"
    minSdk = 26
    targetSdk = 36
    versionCode = 1
    versionName = "0.1.0"

    val apiUrl = localProperties.getProperty("farmadelivery.apiUrl") ?: "http://10.0.2.2:3433"
    buildConfigField("String", "FARMADELIVERY_API_URL", "\"$apiUrl\"")
  }

  buildFeatures {
    compose = true
    buildConfig = true
  }
}

dependencies {
  val composeBom = platform("androidx.compose:compose-bom:2026.05.00")
  implementation(composeBom)
  androidTestImplementation(composeBom)

  implementation("androidx.activity:activity-compose:1.13.0")
  implementation("androidx.core:core-ktx:1.18.0")
  implementation("androidx.compose.material3:material3")
  implementation("androidx.compose.ui:ui")
  implementation("androidx.compose.ui:ui-tooling-preview")
  implementation("androidx.lifecycle:lifecycle-runtime-compose:2.10.0")
  implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.10.0")
  implementation("androidx.navigation:navigation-compose:2.9.8")
  implementation("androidx.datastore:datastore-preferences:1.2.1")

  implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.11.0")
  implementation("org.jetbrains.kotlinx:kotlinx-coroutines-play-services:1.11.0")
  implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.11.0")

  implementation("com.google.android.gms:play-services-location:21.3.0")

  implementation("com.squareup.okhttp3:okhttp:5.3.2")
  implementation("com.squareup.okhttp3:okhttp-sse:5.3.2")
  implementation("com.squareup.okhttp3:logging-interceptor:5.3.2")
  implementation("com.squareup.retrofit2:retrofit:3.0.0")
  implementation("com.squareup.retrofit2:converter-kotlinx-serialization:3.0.0")

  implementation(platform("com.google.firebase:firebase-bom:34.13.0"))
  implementation("com.google.firebase:firebase-messaging")

  testImplementation("org.jetbrains.kotlin:kotlin-test-junit")
  testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.11.0")

  debugImplementation("androidx.compose.ui:ui-tooling")
}
