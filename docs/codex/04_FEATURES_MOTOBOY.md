# Feature do Motoboy - Plano de Implementação

**Status**: ✅ Implementada (falta smoke test em device e offline-first)  
**Escopo**: App Android Kotlin + PWA iPhone + Endpoints Backend + Notificações  
**Versoes reais**: Kotlin 2.2.21, Compose, SDK 36, Gradle 9.5.1, JBR Android Studio

---

## 1. Visão Geral

### 1.1 O que Falta

Conforme `docs/implementation-checklist.md` — estado atualizado:
- ✅ App Kotlin Android em `apps/motoboy` com login, entregas, rota, acoes operacionais
- ✅ Envio periodico de localizacao via foreground service (60s)
- ✅ Notificacoes push FCM para nova entrega, cancelamento e atualizacao
- ✅ Login mobile com o mesmo backend e sessao local em DataStore
- ✅ Tela mobile de entregas disponiveis, rota atual com abertura no Maps
- ✅ Comprovante fotografico opcional com compressao local
- ✅ PWA iPhone em `apps/motoboy-pwa` com paridade de features
- ❌ Room/Offline-first (nao implementado — avaliar necessidade real)
- ❌ Mapa nativo embarcado (usa Google Maps externo por enquanto)

### 1.2 O que JÁ existe (Backend)

✅ Endpoints `/couriers`, `/couriers/location`, `/auth/login`  
✅ Modelo `Courier` com localização (lat/lng)  
✅ Autenticação JWT compatível com mobile  
✅ Supabase Realtime (notificações push)  
✅ RLS policies para segurança  

---

## 2. Estrutura do Projeto Kotlin

```
apps/motoboy/
├── .gitignore
├── build.gradle.kts              # Config build Kotlin
├── settings.gradle.kts
├── local.properties              # API_URL, DEBUG flags
│
├── app/
│   ├── build.gradle.kts          # Dependencies (Kotlin, Coroutines, Retrofit, Room, etc)
│   │
│   ├── src/main/
│   │   ├── kotlin/com/farmadelivery/
│   │   │   ├── data/
│   │   │   │   ├── api/
│   │   │   │   │   ├── ApiClient.kt              # Retrofit setup
│   │   │   │   │   ├── AuthService.kt            # POST /auth/login, GET /auth/me
│   │   │   │   │   ├── DeliveryService.kt        # GET /deliveries, PATCH status
│   │   │   │   │   ├── CourierService.kt         # GET /couriers, POST /couriers/location
│   │   │   │   │   └── RouteService.kt           # GET /courier-routes, POST /recalculate
│   │   │   │   │
│   │   │   │   ├── db/
│   │   │   │   │   ├── AppDatabase.kt            # Room database local
│   │   │   │   │   ├── dao/
│   │   │   │   │   │   ├── DeliveryDao.kt
│   │   │   │   │   │   ├── LocationDao.kt
│   │   │   │   │   │   └── CacheDao.kt
│   │   │   │   │   └── entities/
│   │   │   │   │       ├── CachedDelivery.kt
│   │   │   │   │       └── LocationHistory.kt
│   │   │   │   │
│   │   │   │   ├── models/
│   │   │   │   │   ├── Auth.kt                   # LoginRequest, SessionResponse
│   │   │   │   │   ├── Delivery.kt               # Delivery, DeliveryStatus
│   │   │   │   │   ├── Courier.kt                # Courier, CourierLocation
│   │   │   │   │   ├── Route.kt                  # CourierRoute, RouteStop
│   │   │   │   │   └── Events.kt                 # DeliveryEvent
│   │   │   │   │
│   │   │   │   ├── repository/
│   │   │   │   │   ├── AuthRepository.kt         # Login, session management
│   │   │   │   │   ├── DeliveryRepository.kt     # Fetch, cache, update deliveries
│   │   │   │   │   ├── CourierRepository.kt      # Fetch self, update location
│   │   │   │   │   ├── LocationRepository.kt     # Background location tracking
│   │   │   │   │   └── OfflineRepository.kt      # Fallback quando offline
│   │   │   │   │
│   │   │   │   └── preferences/
│   │   │   │       └── SessionPreferences.kt     # DataStore para token JWT
│   │   │   │
│   │   │   ├── domain/
│   │   │   │   ├── usecase/
│   │   │   │   │   ├── LoginUseCase.kt
│   │   │   │   │   ├── FetchDeliveriesUseCase.kt
│   │   │   │   │   ├── AcceptDeliveryUseCase.kt
│   │   │   │   │   ├── UpdateLocationUseCase.kt
│   │   │   │   │   ├── SubmitDeliveryUseCase.kt
│   │   │   │   │   └── ReportProblemUseCase.kt
│   │   │   │   │
│   │   │   │   └── models/ (DTOs e Value Objects)
│   │   │   │
│   │   │   ├── presentation/
│   │   │   │   ├── ui/
│   │   │   │   │   ├── screens/
│   │   │   │   │   │   ├── LoginScreen.kt        # Tela de login
│   │   │   │   │   │   ├── DeliveriesScreen.kt   # Lista de entregas disponíveis
│   │   │   │   │   │   ├── RouteScreen.kt        # Rota atual com mapa
│   │   │   │   │   │   ├── DeliveryDetailScreen.kt
│   │   │   │   │   │   ├── ProblemScreen.kt      # Registrar problema com foto
│   │   │   │   │   │   └── ProfileScreen.kt      # Perfil, logout
│   │   │   │   │   │
│   │   │   │   │   ├── components/
│   │   │   │   │   │   ├── DeliveryCard.kt
│   │   │   │   │   │   ├── RouteMap.kt           # Leaflet/Google Maps
│   │   │   │   │   │   ├── LocationTracker.kt
│   │   │   │   │   │   └── ProblemForm.kt
│   │   │   │   │   │
│   │   │   │   │   └── navigation/
│   │   │   │   │       └── NavGraph.kt           # Navigation Compose
│   │   │   │   │
│   │   │   │   └── viewmodel/
│   │   │   │       ├── LoginViewModel.kt
│   │   │   │       ├── DeliveriesViewModel.kt
│   │   │   │       ├── RouteViewModel.kt
│   │   │   │       └── ProfileViewModel.kt
│   │   │   │
│   │   │   ├── services/
│   │   │   │   ├── LocationService.kt            # Foreground service para GPS
│   │   │   │   ├── NotificationService.kt        # Firebase Cloud Messaging
│   │   │   │   ├── SyncService.kt                # Background sync de dados
│   │   │   │   └── OfflineService.kt             # Cache + sync quando online
│   │   │   │
│   │   │   └── MainActivity.kt
│   │   │
│   │   ├── res/
│   │   │   ├── values/
│   │   │   │   ├── colors.xml
│   │   │   │   ├── strings.xml
│   │   │   │   └── themes.xml
│   │   │   │
│   │   │   ├── drawable/
│   │   │   │   └── ic_logo.xml
│   │   │   │
│   │   │   └── layout/
│   │   │       └── activity_main.xml             # Compose, sem layout XML
│   │   │
│   │   └── AndroidManifest.xml
│   │
│   └── src/test/
│       └── kotlin/
│           ├── AuthRepositoryTest.kt
│           ├── DeliveryRepositoryTest.kt
│           └── LocationServiceTest.kt
│
└── README.md
```

---

## 3. Stack Kotlin Recomendado

### Identidade Android/Firebase
- **Application ID / Package**: `com.drogsantoantonio.farmadelivery`
- **Nome do app**: `farmadelivery`
- **Firebase Project ID**: `farmadelivery-d40a9`
- **Arquivo Firebase atual**: `google-services.json` na raiz do repositório
- **Destino quando o módulo existir**: `apps/motoboy/app/google-services.json`

### Core (versoes reais do projeto)
- **Kotlin**: 2.2.21 (Stable Baseline, K2 Compiler)
- **Coroutines**: estruturadas
- **Android API**: Min 24, Compile/Target SDK 36
- **Gradle**: 9.5.1 com Kotlin DSL
- **JDK**: JBR do Android Studio (JDK 26 disponivel mas nao adotado por incompatibilidade com jlink/SDK 36)

### Networking
- **Retrofit**: cliente HTTP com interceptor JWT
- **OkHttp**: interceptors para token e logging
- **Gson/kotlinx-serialization**: JSON parsing

### UI
- **Jetpack Compose**: Latest (modern UI)
- **Navigation Compose**: Navigation stack
- **Accompanist**: Compose extras (permissions, etc)

### Data Persistence
- **Room**: Database local (cache offline)
- **DataStore**: Preferences (token, session)

### Location & Maps
- **Google Location Services**: Fused Location
- **Google Maps Compose** ou **Leaflet SDK**: Mapa em tempo real

### Background & Notifications
- **Firebase Cloud Messaging (FCM)**: Push notifications
- **Firebase Analytics**: telemetria básica do app
- **WorkManager**: Periodic tasks (sync de localização a cada 30s)

### Utilities
- **Koin**: Dependency Injection
- **Timber**: Logging estruturado
- **Coil**: Image loading

---

## 4. Endpoints Necessários (Backend)

### 4.1 Existentes (✅ Implementar no Kotlin)

```
POST /auth/login
  Input: { identifier (email/phone), password }
  Output: { user, token }
  
GET /auth/me
  Headers: Authorization: Bearer <token>
  Output: { user, token }

GET /couriers
  Headers: Authorization: Bearer <token>
  Output: [{ id, name, available, currentLat, currentLng, ... }]

GET /couriers?id=<courierId>
  Headers: Authorization: Bearer <token>
  Output: Single courier details

GET /deliveries?status=AGUARDANDO_MOTOBOY
  Headers: Authorization: Bearer <token>
  Query: ?status=AGUARDANDO_MOTOBOY (entregas disponíveis para aceitar)
  Output: [{ id, publicCode, status, customer, address, priority, ... }]

GET /deliveries?courierId=<id>&status=ACEITA_PELO_MOTOBOY
  Headers: Authorization: Bearer <token>
  Output: Entregas aceitas por este motoboy (rota atual)

GET /deliveries/{id}
  Headers: Authorization: Bearer <token>
  Output: Delivery details com customer, address, events

GET /deliveries/{id}/events
  Headers: Authorization: Bearer <token>
  Output: [{ type, createdAt, notes, ... }]

POST /couriers/location
  Headers: Authorization: Bearer <token>
  Input: { courierId, latitude, longitude, available }
  Output: { id, baseStoreName, available, currentLat, currentLng, lastLocationAt }

GET /courier-routes
  Headers: Authorization: Bearer <token>
  Output: [{ id, status, stops: [...] }] (rotas ativas do motoboy)

POST /courier-routes/recalculate
  Headers: Authorization: Bearer <token>
  Input: { routeId, deliveryIds? }
  Output: { id, stops: [{ sequence, deliveryId, address, ... }] }
```

### 4.2 NOVOS - CRIAR NO BACKEND

```
PATCH /deliveries/{id}
  Headers: Authorization: Bearer <token>
  Input: { status, notes?, latitude?, longitude?, photo? }
  Output: { id, status, updatedAt }
  
  Casos:
  - { status: "ACEITA_PELO_MOTOBOY" } → Motoboy aceita entrega
  - { status: "COLETADA", latitude, longitude } → Coleta na loja
  - { status: "EM_ROTA" } → Saiu da loja
  - { status: "ENTREGUE" } → Confirmou entrega
  - { status: "PROBLEMA", notes, photo } → Registrou problema

POST /deliveries/{id}/photo
  Headers: Authorization: Bearer <token>, Content-Type: multipart/form-data
  Input: photo (binary)
  Output: { photoUrl }
```

---

## 5. Fluxo de Autenticação (Mobile)

```
[Login Screen]
  ↓
  Entrada: email/phone + password
  ↓
  [AuthRepository.login()]
  ↓
  POST /auth/login
  ↓
  Response: { user, token }
  ↓
  [SessionPreferences.saveToken(token)]
  ↓
  [AuthRepository.getMe()]
  ↓
  GET /auth/me (validar token)
  ↓
  Response: { user, token }
  ↓
  [Navegar para DeliveriesScreen]
```

Token armazenado localmente com DataStore (encrypted).

---

## 6. Fluxo de Entrega (Core)

### 6.1 Aceitar Entrega

```
[DeliveriesScreen - ListView]
  → Listar entregas com GET /deliveries?status=AGUARDANDO_MOTOBOY
  → Motoboy vê: customer, address, priority, agendado para que hora
  → Toca em "ACEITAR"
  ↓
  [DeliveryRepository.acceptDelivery(id)]
  ↓
  PATCH /deliveries/{id} { status: "ACEITA_PELO_MOTOBOY" }
  ↓
  API retorna: { status: "ACEITA_PELO_MOTOBOY", acceptedAt }
  ↓
  [Local cache atualiza]
  ↓
  [Realtime notification]: Motoboy adicionado à rota
  ↓
  [RouteScreen - Mapa mostra nova parada]
```

### 6.2 Rota Ativa

```
[RouteScreen]
  → GET /courier-routes (meu courierId)
  → Mostra rota atual:
    - Mapa com lojas e paradas
    - Próxima parada destacada
    - Distância e tempo estimado (via OSRM ou Google Directions)
  
  → Background Service:
    - A cada 30 segundos, POST /couriers/location
    - { courierId, latitude, longitude, available }
    - Atualiza posição no mapa para admins
    
  → Realtime subscription:
    - Se rota recalculada → Atualiza paradas
    - Se nova entrega → Notify motoboy
```

### 6.3 Coleta na Loja

```
[RouteScreen - Parada COLETA]
  → Motoboy toca "COLETA AQUI"
  → PATCH /deliveries/{id}
    {
      status: "COLETADA",
      latitude: 23.95,
      longitude: -46.27,
      notes?: "Produto pesado, caixa frágil"
    }
  → API retorna: { status: "COLETADA", collectedAt }
  → App mostra confirmação
  → Próxima parada é destacada
```

### 6.4 Entregar

```
[RouteScreen - Parada ENTREGA]
  → Motoboy toca "ENTREGAR"
  → [DeliveryDetailScreen]
    - Endereço completo
    - Botão "CONFIRMAR ENTREGA"
    - Botão "PROBLEMA"
    - Campo de assinatura ou foto (futura feature)
  
  → Se CONFIRMAR:
    ↓
    PATCH /deliveries/{id}
    {
      status: "ENTREGUE",
      latitude, longitude
    }
    ↓
    API retorna: { status: "ENTREGUE", deliveredAt }
    ↓
    App: Toast "Entregue com sucesso"
    ↓
    Remove da rota
    ↓
    Próxima parada destacada
```

### 6.5 Problema

```
[RouteScreen - Toca "PROBLEMA"]
  → [ProblemScreen]
    - Motivos: "Cliente não está", "Endereço não encontrado", "Recusou", etc
    - Campo de notas adicionales
    - Câmera opcional para foto (futura)
    - Botão "Registrar Problema"
  
  → Se REGISTRAR:
    ↓
    PATCH /deliveries/{id}
    {
      status: "PROBLEMA",
      notes: "Cliente não estava em casa",
      photo?: <binary ou URL>
    }
    ↓
    API cria evento: { type: "OCORRENCIA_REGISTRADA" }
    ↓
    App: Toast "Problema registrado"
    ↓
    Notifica admin via Realtime
    ↓
    Admin decide: retentar, redirecionar, cancelar
```

---

## 7. Localização em Tempo Real

### 7.1 Foreground Service

```kotlin
class LocationService : Service() {
  // Runs continuously enquanto motoboy está em rota
  
  fun startLocationUpdates() {
    LocationManager.requestLocationUpdates(
      interval = 30_000L,  // 30 segundos
      minDisplacement = 50f // 50 metros
    ) { location ->
      // POST /couriers/location
      courierRepository.updateLocation(
        latitude = location.latitude,
        longitude = location.longitude,
        available = true
      )
      
      // Local cache
      locationRepository.saveHistory(location)
    }
  }
}
```

### 7.2 Background WorkManager

```kotlin
// Periodic sync, mesmo com app fechado
PeriodicWorkRequestBuilder<LocationSyncWorker>(
  repeatInterval = 1, // 1 minuto (mínimo)
  repeatIntervalTimeUnit = TimeUnit.MINUTES
).build()
  .also { workManager.enqueueUniquePeriodicWork(...) }
```

---

## 8. Notificações Push (Firebase Cloud Messaging)

### 8.1 Backend Setup

```
1. Configurar Firebase project
2. Gerar google-services.json
3. Endpoint para registrar deviceToken:
   POST /couriers/{courierId}/device-token
   Input: { deviceToken, platform: "android" }
   
4. Usar FCM API para enviar notificações:
   - Nova entrega disponível
   - Entrega cancelada
   - Rota recalculada
```

### 8.1.1 Gradle/Firebase Android

No `settings.gradle.kts` ou `build.gradle.kts` raiz do projeto Android:

```kotlin
plugins {
  id("com.google.gms.google-services") version "4.4.4" apply false
}
```

No `apps/motoboy/app/build.gradle.kts`:

```kotlin
plugins {
  id("com.android.application")
  id("com.google.gms.google-services")
}

dependencies {
  implementation(platform("com.google.firebase:firebase-bom:34.13.0"))
  implementation("com.google.firebase:firebase-analytics")
  implementation("com.google.firebase:firebase-messaging")
}
```

O `google-services.json` deve ficar no módulo Android em `apps/motoboy/app/google-services.json` quando o projeto Kotlin for criado.

### 8.2 App Recebe Notificação

```kotlin
class FirebaseMessagingService : FirebaseMessagingService() {
  override fun onMessageReceived(message: RemoteMessage) {
    val data = message.data
    
    when (data["event"]) {
      "NEW_DELIVERY" -> {
        // Notificar motoboy
        showNotification("Nova entrega disponível!")
        // Atualizar lista
        deliveryRepository.refresh()
      }
      
      "DELIVERY_CANCELED" -> {
        val deliveryId = data["deliveryId"]
        showNotification("Entrega #$deliveryId foi cancelada")
        deliveryRepository.removeFromRoute(deliveryId)
      }
      
      "ROUTE_RECALCULATED" -> {
        showNotification("Rota recalculada")
        routeRepository.refresh()
      }
    }
  }
}
```

---

## 9. Offline-First Strategy

### 9.1 Cache Local (Room)

```kotlin
// Quando app perde internet:
// 1. Entregas da rota ficam em cache local
// 2. Ações (aceitar, entregar) são enfileiradas
// 3. Quando reconecta, sincroniza automaticamente
```

### 9.2 SyncManager

```kotlin
class SyncManager {
  fun syncPendingActions() {
    // Queue de ações pendentes
    val pending = db.syncQueueDao().getPending()
    
    pending.forEach { action ->
      try {
        when (action.type) {
          "ACCEPT_DELIVERY" -> courierApi.acceptDelivery(...)
          "UPDATE_LOCATION" -> courierApi.updateLocation(...)
          "SUBMIT_DELIVERY" -> courierApi.submitDelivery(...)
        }
        
        db.syncQueueDao().markSynced(action.id)
      } catch (e: Exception) {
        // Retry na próxima sincronização
        app.log.error("Sync failed: ${action.id}", e)
      }
    }
  }
}
```

---

## 10. Testes Unitários

```
src/test/kotlin/
├── data/api/AuthServiceTest.kt
├── data/repository/AuthRepositoryTest.kt
├── data/repository/DeliveryRepositoryTest.kt
├── domain/usecase/AcceptDeliveryUseCaseTest.kt
└── presentation/viewmodel/DeliveriesViewModelTest.kt
```

---

## 11. Checklist de Implementação

### Fase 1: Setup & Autenticacao ✅
- [x] Criar projeto Kotlin (Android Studio)
- [x] Configurar dependencias (Retrofit, Coroutines, Compose)
- [x] Implementar AuthRepository
- [x] LoginScreen com form + validacao
- [x] SessionPreferences para guardar token (DataStore)
- [x] Testar login com backend

### Fase 2: Entregas Disponiveis ✅
- [x] DeliveryRepository com API client
- [x] DeliveriesScreen com lista e acoes
- [x] Agrupamento disponiveis/em atendimento
- [x] Card mostrando customer, address, priority, status, data
- [x] Integracao GET /deliveries

### Fase 3: Aceitar & Rota ✅
- [x] AcceptDeliveryUseCase
- [x] Acoes: aceitar, coletar, sair rota, entregar, problema, cancelar
- [x] RouteScreen com lista de paradas pendentes
- [x] Abertura de sequencia no Google Maps externo
- [x] Integracao com GET /courier-routes
- [x] Limite de waypoints e trecho parcial

### Fase 4: Localizacao ✅
- [x] LocationTrackingService (Foreground Service)
- [x] Toggle de GPS persistido na tela
- [x] UpdateLocationUseCase
- [x] POST /couriers/location a cada 60s
- [x] Parada automatica ao ficar indisponivel

### Fase 5: Entrega & Problema ✅
- [x] Confirmacao textual obrigatoria antes de concluir
- [x] PATCH /deliveries com status ENTREGUE e observacao
- [x] Registro de problema com dialogo e validacao
- [x] Foto opcional de comprovante com compressao local
- [x] Historico auditavel de eventos por entrega

### Fase 6: Notificacoes Push ✅
- [x] Firebase Cloud Messaging configurado
- [x] google-services.json copiado para apps/motoboy/app/
- [x] FarmaMessagingService com canal Android
- [x] Registro automatico de token no backend
- [x] Atualizacao de token quando Firebase gera novo

### Fase 7: Offline & Sync ❌ (nao implementado)
- [ ] Room database para cache
- [ ] SyncManager e SyncQueue
- [ ] WorkManager para sync automatico
- [ ] Testar com internet desligada
- [ ] Avaliar necessidade real antes de implementar

### Fase 8: Testes & Polish ✅ (parcial)
- [x] Testes unitarios de use cases e repositorio de rotas
- [x] Testes de helpers de labels, formatacao, navegacao
- [x] Tema Compose com cores da Drogaria Santo Antonio
- [x] Loading, empty, error/retry e refresh manual
- [x] Logo real da Drogaria aplicado
- [ ] Testes de integracao com API mocks

---

## 12. Próximos Passos Imediatos

1. **HOJE**: Criar projeto Kotlin básico
2. **Próximo commit**: AuthRepository + LoginScreen
3. **PR 1**: Autenticação funcional
4. **PR 2**: DeliveriesScreen + List
5. **PR 3**: RouteScreen + Mapa

---

## Referências

- **Retrofit**: https://square.github.io/retrofit/
- **Room**: https://developer.android.com/training/data-storage/room
- **Coroutines**: https://kotlinlang.org/docs/coroutines-overview.html
- **Jetpack Compose**: https://developer.android.com/jetpack/compose
- **Firebase Messaging**: https://firebase.google.com/docs/cloud-messaging/android/client
