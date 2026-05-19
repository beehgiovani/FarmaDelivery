# ESTRUTURA.md — FarmaDelivery

Organizacao sistemica do monorepo, localizacao de arquivos, finalidade tecnica e fluxo arquitetural.

Atualizado em 2026-05-17.

---

## Visao Geral

```
FarmaDelivery/
├── apps/                      Aplicacoes do sistema
│   ├── admin/                 Painel web para admin e loja
│   ├── api/                   Backend Fastify + Prisma
│   ├── motoboy/               App Android Kotlin/Compose
│   └── motoboy-pwa/           PWA iPhone React/Vite
├── database/                  SQL consolidado
├── docs/                      Documentacao viva
│   └── codex/                 Regras, arquitetura, features, guias
├── scripts/                   Utilidades de build e snapshot
├── supabase/                  Migrations, seeds, policies, realtime
├── .firebaserc                Targets Firebase Hosting
├── firebase.json              Config de hosting (admin + pwa)
├── google-services.json       Firebase Android (com.drogsantoantonio.farmadelivery)
├── package.json               Monorepo root
└── README.md                  Visao geral do produto
```

---

## apps/admin — Painel Web Admin/Loja

**Stack**: React 19, Vite, TypeScript Strict, Leaflet, Supabase Realtime.
**Finalidade**: CRUD de entregas, mapa, relatorios, alocacoes, push monitor, gestao de equipe.

```
apps/admin/src/
├── App.tsx                    Orquestrador principal (34KB)
├── main.tsx                   Entry point
├── styles.css                 Design system completo (37KB)
├── types.ts                   Tipagens compartilhadas do admin (7KB)
├── api.ts                     Cliente HTTP com auth e fallback (28KB)
├── apiMappers.ts              Mapeamento API → UI
├── supabaseClient.ts          Client Supabase browser-safe
├── data.ts                    Dados estaticos (lojas, cores)
├── csv.ts                     Exportacao CSV
├── deliverySla.ts             Calculo de SLA/prazo
├── reportExport.ts            Exportacao de relatorios
├── reportFilters.ts           Filtros de relatorio
├── reportPeriod.ts            Periodos de relatorio
├── notificationExport.ts      Exportacao de notificacoes
├── assignmentHistory.ts       Historico de alocacoes
├── components/
│   ├── LoginScreen.tsx        Tela de login
│   ├── DeliveryForm.tsx       Formulario de criacao de entrega
│   ├── DeliveryTable.tsx      Fila de entregas por status
│   ├── DeliveryActionDialog.tsx  Dialogo de acoes (aceitar, cancelar, etc)
│   ├── DeliveryEventPanel.tsx    Timeline de eventos de entrega
│   ├── DeliveryAnalytics.tsx     KPIs de entregas
│   ├── OperationsMap.tsx      Mapa Leaflet (lojas, motoboys, rotas)
│   ├── ReportsPanel.tsx       Relatorios operacionais com filtros
│   ├── ManagementPanel.tsx    Gestao de equipe e alocacoes (40KB)
│   ├── NotificationMonitorPanel.tsx  Monitor de push notifications
│   ├── CourierRoutesPanel.tsx  Rotas ativas de motoboys
│   ├── RouteBoard.tsx         Quadro de pre-rota
│   ├── RouteStrategyPanel.tsx Estrategia de roteirizacao
│   ├── StoreVolume.tsx        Volume por loja
│   ├── AccessScopePanel.tsx   Indicador de escopo de acesso
│   ├── Metric.tsx             Card de metrica
│   ├── StateBlock.tsx         Bloco de estado visual
│   ├── ToastStack.tsx         Pilha de notificacoes
│   └── AppErrorBoundary.tsx   Tratamento de erros global
└── Testes (8 suites)
    apiMappers.test · csv.test · deliverySla.test · reportExport.test
    reportFilters.test · reportPeriod.test · notificationExport.test · assignmentHistory.test
```

---

## apps/api — Backend

**Stack**: Fastify, TypeScript Strict, Prisma ORM, Supabase REST fallback, Zod, Firebase Admin SDK.
**Finalidade**: Autenticacao, CRUD, escopo por perfil, auditoria, push, LGPD, geocoding.

```
apps/api/src/
├── server.ts                  Boot do servidor
├── app.ts                     Registro de rotas e plugins (2KB)
├── auth.ts                    JWT HMAC-SHA256 + sessao
├── contracts.ts               Schemas Zod de validacao (7KB)
├── prisma.ts                  Cliente Prisma singleton
├── supabaseRest.ts            Fallback REST server-side (6KB)
├── accessScope.ts             Escopo por perfil (5KB)
├── http.ts                    Helpers HTTP
├── deliveryReport.ts          Logica de relatorios (8KB)
├── deliveryProofStorage.ts    Armazenamento de comprovantes
├── notifications.ts           Firebase Admin SDK push (5KB)
├── lgpdRetention.ts           Motor de retencao LGPD (15KB)
├── lgpdRetentionCli.ts        CLI do motor LGPD (5KB)
├── routes/
│   ├── deliveries.ts          CRUD, acoes, escopo, fallback (94KB)
│   ├── users.ts               CRUD, permissoes, alocacoes (42KB)
│   ├── routes.ts              Rotas, recalculo, paradas (23KB)
│   ├── stores.ts              CRUD, horarios, overrides (12KB)
│   ├── notifications.ts       FCM summary, tokens (10KB)
│   ├── geocoding.ts           Cache, alternativas (5KB)
│   └── health.ts              Healthcheck + proof storage
├── prisma/schema.prisma       14 models, 10 enums (347 linhas)
└── Testes (15+ suites)
    app · auth · contracts · accessScope · deliveryReport · deliveryProof
    deliveryProofStorage · lgpdRetention · lgpdRetentionCli · notificationSummary
    operationalActor · routeScope · storeScope · userScope
```

---

## apps/motoboy — App Android

**Stack**: Kotlin 2.2.21, Jetpack Compose, Retrofit, OkHttp, Coroutines, DataStore, Firebase (FCM + Analytics).
**Finalidade**: App nativo para motoboys com login, entregas, rota, GPS, push e comprovante.
**Arquitetura**: Clean Architecture (Presentation → Domain → Data).

```
apps/motoboy/app/src/main/kotlin/com/drogsantoantonio/farmadelivery/
├── FarmaDeliveryApp.kt        Application class
├── MainActivity.kt            Entry + Compose host (4KB)
├── presentation/
│   ├── navigation/            Nav graph Compose
│   ├── ui/theme/              Cores Drogaria Santo Antonio
│   └── ui/screens/            18 arquivos
│       ├── LoginScreen.kt
│       ├── MotoboyHomeScreen.kt    Abas entregas/rota
│       ├── DeliveriesScreen.kt     Fila + acoes (21KB)
│       ├── RouteScreen.kt          Paradas + Maps (8KB)
│       ├── LocationPanel.kt        GPS toggle (8KB)
│       └── 13 helpers (labels, formatacao, links, datas)
├── domain/usecase/
│   ├── LoginUseCase.kt
│   ├── FetchDeliveriesUseCase.kt
│   ├── AcceptDeliveryUseCase.kt
│   └── UpdateLocationUseCase.kt
├── data/
│   ├── api/                   Retrofit clients
│   │   ├── ApiClient.kt       OkHttp + interceptor JWT
│   │   ├── AuthService.kt
│   │   ├── DeliveryService.kt
│   │   ├── CourierService.kt
│   │   └── RouteService.kt
│   ├── models/                DTOs (Auth, Delivery, Courier, Route)
│   ├── repository/            Repos (Auth, Delivery, Courier, Route)
│   ├── preferences/           SessionPreferences (DataStore)
│   └── location/              DeviceLocationProvider
├── location/
│   └── LocationTrackingService.kt   Foreground service GPS
└── notifications/
    └── FarmaMessagingService.kt     FCM push handler
```

---

## apps/motoboy-pwa — PWA iPhone

**Stack**: React 19, Vite, TypeScript Strict, Firebase Web Push.
**Finalidade**: PWA instalavel para motoboys iPhone com paridade funcional ao app Android.

```
apps/motoboy-pwa/src/
├── App.tsx                    Tela unica com abas (32KB)
├── main.tsx                   Entry + SW register
├── api.ts                     Cliente HTTP (5KB)
├── firebase.ts                Firebase init + Web Push
├── types.ts                   Tipagens compartilhadas
├── styles.css                 Estilo mobile-first (8KB)
├── 16 helpers testados
│   deliverySections · deliveryStatusLabels · deliveryPriorityLabels
│   deliveryCardDateLabels · deliveryEventLabels · deliveryEventActors
│   deliveryEventNotes · deliveryEventTimestamps · deliveryMapLinks
│   deliveryProofImage · phoneDialLinks · routeNavigation
│   routeStatusLabels · routeStopTypeLabels · routeStopScheduleLabels
│   operationalSignals
└── 16 testes (.test.ts para cada helper)
```

---

## database/

```
database/
└── full-setup.sql             SQL consolidado (npm run db:sql:full)
```

Contem todas as tabelas, enums, indices, constraints e seeds em um unico arquivo. Gerado automaticamente a partir do schema Prisma + migrations.

---

## supabase/

```
supabase/
├── migrations/
│   ├── 20260514011500_init_farmadelivery.sql
│   ├── 20260514013000_store_hours.sql
│   ├── 20260515041000_assignments.sql
│   ├── 20260515052000_courier_device_tokens.sql
│   ├── 20260515054000_delivery_notification_event.sql
│   ├── 20260515193000_delivery_proofs.sql
│   └── 20260517120000_delivery_deadline_tier.sql
├── seed.sql                   Seed das 5 lojas reais
├── store-hours-seed.sql       Horarios semanais de cada loja
├── policies.sql               Policies RLS iniciais
├── realtime.sql               Ativacao de Realtime nas tabelas operacionais
└── realtime-check.sql         Diagnostico de Realtime
```

**Regra**: todos os scripts devem ser aplicados manualmente no Supabase SQL Editor. Nao rodar migrations pelo terminal.

---

## docs/

```
docs/
├── codex/
│   ├── 00_LEIA_ME_PRIMEIRO.md     Status atual e proximos passos
│   ├── 01_REGRAS_AGENTE.md        Regras universais e locais do projeto
│   ├── 02_ARQUITETURA.md          Arquitetura tecnica completa
│   ├── 04_FEATURES_MOTOBOY.md     Roadmap e checklist do app Kotlin
│   ├── 05_INDICE.md               Indice de toda documentacao
│   ├── 06_GUIA_PRATICO.md         Setup local e troubleshooting
│   ├── 07_RESUMO_SESSAO.md        Resumo de sessoes passadas
│   └── 08_DIAGNOSTICO_AUTH.md     Auth troubleshooting
├── implementation-checklist.md    Progresso detalhado de implementacao
├── operational-contracts.md       Contratos entre apps (status, prioridades, eventos)
├── lgpd.md                        Politicas de privacidade e retencao
├── architecture.md                Decisoes arquiteturais
├── supabase.md                    Configuracao Supabase, pooler, scripts
├── database-schema.sql            Snapshot SQL do Prisma
└── database-next-steps.md         Proximos passos de banco
```

---

## scripts/

```
scripts/
├── snapshot-db-schema.mjs     Gera docs/database-schema.sql a partir do Prisma
└── build-full-sql.mjs         Gera database/full-setup.sql consolidado
```

---

## Fluxo Arquitetural

```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  apps/admin  │  │ apps/motoboy │  │  motoboy-pwa │
│  React Web   │  │Android Kotlin│  │  PWA iPhone  │
└──────┬───────┘  └──────┬───────┘  └──────┬───────┘
       │ HTTP+JWT        │ Retrofit+JWT     │ Fetch+JWT
       └─────────────────┼─────────────────┘
                         ▼
              ┌─────────────────────┐
              │     apps/api        │
              │ Fastify + Prisma    │
              │ + Supabase REST     │
              └──────────┬──────────┘
                         │ Prisma ORM / REST
                         ▼
              ┌─────────────────────┐
              │  PostgreSQL         │
              │  Supabase Cloud     │
              │  14 tabelas         │
              │  10 enums           │
              └─────────────────────┘
```

Comunicacao adicional:
- **Supabase Realtime** → admin (eventos de entrega em tempo real)
- **Firebase Cloud Messaging** → motoboy Android e PWA (push notifications)
- **Google Maps external** → motoboy Android e PWA (abertura de rota)
- **Geocoding API** → api (cache de coordenadas)

---

## Modelo de Dados (14 tabelas)

| Tabela | Finalidade |
|--------|------------|
| Store | Lojas (5 unidades) |
| StoreWeeklyHours | Horarios semanais por loja |
| StoreDateOverride | Excecoes de horario por data |
| User | Usuarios do sistema (admin, gerente, balconista, motoboy) |
| Courier | Perfil operacional do motoboy (localizacao, base, disponibilidade) |
| CourierDeviceToken | Tokens FCM para push |
| UserStoreAssignment | Alocacao de usuarios a lojas |
| CourierStoreAssignment | Alocacao de motoboys a lojas |
| Customer | Clientes (nome + telefone) |
| CustomerAddress | Enderecos dos clientes |
| Delivery | Entregas operacionais |
| DeliveryProof | Comprovantes fotograficos de entrega |
| DeliveryEvent | Eventos auditaveis (Event Sourcing) |
| CourierRoute | Rotas ativas de motoboys |
| RouteStop | Paradas individuais de uma rota |
