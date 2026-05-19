# FarmaDelivery - Documentação Técnica Completa

**Versão**: 0.1.0  
**Data**: 2026-05-15  
**Ambiente**: Desenvolvimento  
**Stack**: Node.js (API), React (Admin), Kotlin (Mobile), PostgreSQL (Supabase)

---

## 1. Visão Geral da Arquitetura

### 1.1 Estrutura do Projeto

```
FarmaDelivery/
├── apps/
│   ├── admin/                    # Painel web React/TypeScript
│   │   ├── src/
│   │   │   ├── components/       # Componentes React reutilizáveis
│   │   │   ├── features/         # Features por domínio (entregas, lojas, motoboys)
│   │   │   ├── hooks/            # Custom hooks (useAuth, useDeliveries, etc)
│   │   │   ├── services/         # Chamadas de API
│   │   │   ├── types/            # TypeScript types compartilhados
│   │   │   └── App.tsx           # Componente raiz
│   │   ├── vite.config.ts        # Configuração build
│   │   └── package.json
│   │
│   └── api/                      # API Backend Node.js/Fastify
│       ├── src/
│       │   ├── routes/           # Endpoints HTTP (users, deliveries, stores, etc)
│       │   ├── auth.ts           # Autenticação JWT e verificação de sessão
│       │   ├── contracts.ts      # Schemas Zod para validação
│       │   ├── http.ts           # Helpers HTTP (statusCode, error mapping)
│       │   ├── prisma.ts         # Cliente Prisma com fallback Supabase
│       │   ├── supabaseRest.ts   # Adapter para Supabase REST API (fallback)
│       │   └── server.ts         # Inicialização Fastify
│       ├── prisma/
│       │   └── schema.prisma     # Modelo de dados Prisma
│       └── package.json
│
├── database/
│   ├── full-setup.sql            # Script SQL consolidado (gerado automaticamente)
│   └── migrations/               # Migrations do banco (geradas pelo Prisma)
│
├── supabase/
│   ├── seed.sql                  # Seed inicial de dados
│   ├── store-hours-seed.sql      # Horários das lojas
│   ├── policies.sql              # RLS policies para segurança
│   └── realtime.sql              # Configuração Realtime
│
├── docs/
│   ├── architecture.md           # Decisões arquiteturais
│   ├── supabase.md               # Setup Supabase
│   ├── implementation-checklist.md # Status de implementação
│   └── database-schema.sql       # Esquema comentado
│
├── scripts/
│   ├── snapshot-db-schema.mjs    # Extrai schema do Prisma
│   └── build-full-sql.mjs        # Gera SQL consolidado
│
└── package.json                  # Root workspace (monorepo)
```

### 1.2 Stack Tecnológico

#### Backend (API)
- **Runtime**: Node.js 18+
- **Framework**: Fastify (servidor HTTP)
- **ORM**: Prisma (com fallback Supabase REST API)
- **Validação**: Zod (schemas de validação)
- **Auth**: JWT com HMAC-SHA256
- **Crypto**: Node.js built-in (crypto, scrypt)
- **Logging**: Pino (logger estruturado do Fastify)

#### Frontend (Admin)
- **Framework**: React 18+
- **Build Tool**: Vite
- **Linguagem**: TypeScript 5+
- **Estilização**: TailwindCSS (ou CSS-in-JS)
- **Estado**: TanStack Query v5 (React Query) ou contexto
- **Realtime**: Supabase client (Socket.io emulado)
- **Mapa**: Leaflet + React Leaflet

#### Banco de Dados
- **Banco**: PostgreSQL via Supabase
- **Spatial**: PostGIS (geolocalização)
- **Realtime**: Supabase Realtime
- **Autenticação**: RLS (Row-Level Security) policies

---

## 2. Fluxo de Autenticação (Auth Flow)

### 2.1 Bootstrap Admin (Primeiro Acesso)

```
[Navegador] 
  → POST /auth/bootstrap-admin { name, phone, email, password }
  → [API] Valida schema com Zod
  → Verifica se há usuários no banco (prisma.user.count())
  → Se count > 0 → Retorna 409 (BOOTSTRAP_LOCKED)
  → Se count = 0 → Cria user ADMIN com:
      - name, phone, email
      - passwordHash = scrypt(password, salt)
      - role = "ADMIN"
      - active = true
  → Gera token JWT = HMAC-SHA256(base64(payload), API_SESSION_SECRET)
  → Retorna { user: {...}, token: "..." }
  → [Frontend] Salva token em localStorage
```

**Payload JWT**:
```typescript
{
  sub: "user-uuid",
  role: "ADMIN" | "GERENTE" | "BALCONISTA_CAIXA" | "MOTOBOY",
  exp: Math.floor(Date.now() / 1000) + 3600,  // 1 hora
  storeId?: "store-uuid",      // Opcional, para balconistas
  courierId?: "courier-uuid"   // Opcional, para motoboys
}
```

### 2.2 Login Normal

```
[Navegador]
  → POST /auth/login { identifier, password }
  → identifier = email OU telefone
  → [API] Procura user com:
      - active = true
      - email = identifier OU phone = identifier
  → Valida password com timingSafeEqual(hash, verifyPassword(...))
  → Se válido → Gera token JWT
  → Retorna { user, token }
  → [Frontend] Salva em localStorage
```

### 2.3 Verificação de Sessão

Toda requisição precisa incluir:
```
Authorization: Bearer <token>
```

No backend:
```typescript
// Em auth.ts:
const token = readBearerToken(request.headers.authorization);
const payload = token ? verifySessionToken(token) : null;

if (!payload) {
  reply.status(401).send({ error: "UNAUTHENTICATED" });
  return;
}

// payload = { sub, role, storeId, courierId, exp }
```

### 2.4 Roles e Permissões

```
ADMIN
├── Cria/edita/deleta: lojas, usuários, motoboys, balconistas
├── Acessa: relatórios globais, métricas, auditoria
├── Vê: todas as entregas, todas as rotas, todos os motoboys

GERENTE
├── Acessa: operação da própria loja
├── Vê: entregas e motoboys da loja
├── Pode: criar usuários da loja

BALCONISTA_CAIXA
├── Cria: entregas na loja vinculada
├── Consulta: clientes por telefone
├── Acompanha: status das entregas criadas
├── Pode: cancelar entregas
└── Limitado a: storeId do usuário

MOTOBOY
├── Aceita: entregas disponíveis
├── Coleta: na loja
├── Atualiza: localização em tempo real
├── Finaliza: entrega ou registra problema
└── Limitado a: courierId do usuário
```

---

## 3. Modelo de Dados (Prisma Schema)

### 3.1 Usuários e Autenticação

```prisma
model User {
  id            String    @id @default(uuid())
  name          String
  email         String?   @unique
  phone         String?   @unique
  passwordHash  String
  role          UserRole  // ADMIN, GERENTE, BALCONISTA_CAIXA, MOTOBOY
  
  // Vinculações
  storeId       String?
  store         Store?    @relation(fields: [storeId], references: [id])
  courier       Courier?  // Se role = MOTOBOY
  
  active        Boolean   @default(true)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  
  // Auditoria
  deliveriesCreated  Delivery[]  @relation("creator")
  deliveriesUpdated  Delivery[]  @relation("updater")
  routeRecalculations CourierRoute[] @relation("recalculatedBy")
  
  @@index([email])
  @@index([phone])
  @@index([storeId])
}

enum UserRole {
  ADMIN
  GERENTE
  BALCONISTA_CAIXA
  MOTOBOY
}
```

### 3.2 Lojas

```prisma
model Store {
  id          String        @id @default(uuid())
  code        String        @unique          // "AST", "MOR", "SR", "SA", "PER"
  name        String                         // "Asturias", "Morrinhos", etc
  address     String
  latitude    Decimal       @db.Decimal(10, 7)
  longitude   Decimal       @db.Decimal(10, 7)
  
  baseType    StoreBaseType // COMPARTILHADA (AST) ou DEDICADA (PER)
  active      Boolean       @default(true)
  
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt
  
  // Relacionamentos
  users       User[]        // Balconistas vinculados
  deliveries  Delivery[]    // Entregas criadas nesta loja
  storeHours  StoreHours[]
  overrides   StoreDateOverride[]
  
  @@index([code])
}

enum StoreBaseType {
  COMPARTILHADA  // Base para múltiplas lojas (Asturias)
  DEDICADA       // Base exclusiva (Pereque)
}

model StoreHours {
  id        String  @id @default(uuid())
  storeId   String
  store     Store   @relation(fields: [storeId], references: [id], onDelete: Cascade)
  
  // Segunda=0, Domingo=6
  dayOfWeek Int     // 0-6
  openAt    String  // "08:00"
  closeAt   String  // "23:00"
  
  @@unique([storeId, dayOfWeek])
}

model StoreDateOverride {
  id        String  @id @default(uuid())
  storeId   String
  store     Store   @relation(fields: [storeId], references: [id], onDelete: Cascade)
  
  date      DateTime @db.Date
  status    String   // "FECHADA", "HORARIO_ESPECIAL", etc
  openAt    String?  // "10:00" se status = HORARIO_ESPECIAL
  closeAt   String?  // "20:00"
  
  @@unique([storeId, date])
}
```

### 3.3 Clientes e Endereços

```prisma
model Customer {
  id        String  @id @default(uuid())
  phone     String  @unique
  name      String
  
  // LGPD: marcar para deleção após inatividade
  active    Boolean @default(true)
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  addresses Delivery[]
  
  @@index([phone])
}

// Endereços são inline em Delivery, mas poderia ter tabela separada:
// model Address {
//   id        String @id @default(uuid())
//   customerId String
//   street    String
//   number    String
//   complement String?
//   district  String
//   city      String
//   latitude  Decimal
//   longitude Decimal
// }
```

### 3.4 Entregas (Core do Sistema)

```prisma
model Delivery {
  id            String            @id @default(uuid())
  publicCode    String            @unique       // Código legível para cliente/admin
  
  // Cliente
  customerPhone String
  customerName  String
  
  // Endereço
  street        String
  number        String
  complement    String?
  district      String
  latitude      Decimal?          @db.Decimal(10, 7)
  longitude     Decimal?          @db.Decimal(10, 7)
  
  // Loja e status
  storeId       String
  store         Store             @relation(fields: [storeId], references: [id])
  status        DeliveryStatus    // RASCUNHO, AGUARDANDO_MOTOBOY, etc
  priority      DeliveryPriority  // NORMAL, URGENTE, RETORNO
  
  // Agendamento
  scheduledFor  DateTime?         // Data/hora planejada
  
  // Timestamps
  createdAt     DateTime          @default(now())
  dispatchedAt  DateTime?         // Quando motoboy aceitou
  collectedAt   DateTime?
  deliveredAt   DateTime?
  canceledAt    DateTime?
  
  // Motivo de cancelamento ou problema
  cancelReason  String?
  problemReason String?
  
  // Motoboy vinculado
  courierId     String?
  courier       Courier?          @relation(fields: [courierId], references: [id])
  
  // Rota vinculada
  routeStopId   String?
  routeStop     RouteStop?        @relation(fields: [routeStopId], references: [id])
  
  // Auditoria
  createdByUserId String
  createdBy     User              @relation("creator", fields: [createdByUserId], references: [id])
  updatedByUserId String?
  updatedBy     User?             @relation("updater", fields: [updatedByUserId], references: [id])
  
  // Eventos
  events        DeliveryEvent[]
  
  @@index([storeId])
  @@index([customerPhone])
  @@index([status])
  @@index([courierId])
  @@index([createdAt])
}

enum DeliveryStatus {
  RASCUNHO
  AGUARDANDO_MOTOBOY
  ACEITA_PELO_MOTOBOY
  COLETADA
  EM_ROTA
  ENTREGUE
  PROBLEMA
  CANCELADA
}

enum DeliveryPriority {
  NORMAL
  URGENTE
  RETORNO
}

model DeliveryEvent {
  id          String            @id @default(uuid())
  deliveryId  String
  delivery    Delivery          @relation(fields: [deliveryId], references: [id], onDelete: Cascade)
  
  type        DeliveryEventType // CRIADA, ACEITA, ENTREGUE, etc
  
  metadata    String?           // JSON com dados do evento
  actorUserId String?           // Quem causou o evento
  
  createdAt   DateTime          @default(now())
  
  @@index([deliveryId])
  @@index([type])
  @@index([createdAt])
}

enum DeliveryEventType {
  CRIADA
  AGENDADA
  REDIRECIONADA
  ACEITA
  COLETADA
  ROTA_RECALCULADA
  OCORRENCIA_REGISTRADA
  ENTREGUE
  CANCELADA
}
```

### 3.5 Motoboys (Couriers)

```prisma
model Courier {
  id              String    @id @default(uuid())
  userId          String    @unique
  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  baseStoreName   String    // "Asturias" ou "Pereque"
  available       Boolean   @default(true)  // Disponível para novas entregas
  
  // Localização em tempo real
  currentLat      Decimal?  @db.Decimal(10, 8)
  currentLng      Decimal?  @db.Decimal(10, 8)
  lastLocationAt  DateTime?
  
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  // Relacionamentos
  deliveries      Delivery[]
  routes          CourierRoute[]
  
  @@index([baseStoreName])
}
```

### 3.6 Rotas Dinâmicas

```prisma
model CourierRoute {
  id              String          @id @default(uuid())
  courierId       String
  courier         Courier         @relation(fields: [courierId], references: [id], onDelete: Cascade)
  
  status          RouteStatus     // ABERTA, EM_ANDAMENTO, FINALIZADA, CANCELADA
  
  // Paradas planejadas
  stops           RouteStop[]
  
  // Timeline
  startedAt       DateTime?       // Quando motoboy iniciou rota
  finishedAt      DateTime?
  recalculatedAt  DateTime?
  
  // Auditoria
  recalculatedByUserId String?
  recalculatedBy  User?           @relation("recalculatedBy", fields: [recalculatedByUserId], references: [id])
  
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt
  
  @@index([courierId])
  @@index([status])
}

model RouteStop {
  id              String          @id @default(uuid())
  routeId         String
  route           CourierRoute    @relation(fields: [routeId], references: [id], onDelete: Cascade)
  
  deliveryId      String?
  delivery        Delivery?       @relation(fields: [deliveryId], references: [id])
  
  sequence        Int             // Ordem na rota (1, 2, 3...)
  type            RouteStopType   // COLETA ou ENTREGA
  status          RouteStopStatus // PENDENTE, CONCLUIDA, PULADA, CANCELADA
  
  // Endereço
  address         String          // "Rua X, 123"
  latitude        Decimal?        @db.Decimal(10, 8)
  longitude       Decimal?        @db.Decimal(10, 8)
  
  // Agendamento
  earliestAt      DateTime?       // Janela de início
  completedAt     DateTime?
  
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt
  
  @@unique([routeId, sequence])
  @@index([deliveryId])
}

enum RouteStatus {
  ABERTA
  EM_ANDAMENTO
  FINALIZADA
  CANCELADA
}

enum RouteStopType {
  COLETA
  ENTREGA
}

enum RouteStopStatus {
  PENDENTE
  CONCLUIDA
  PULADA
  CANCELADA
}
```

---

## 4. Endpoints da API

### 4.1 Autenticação

```
POST /auth/bootstrap-admin
Body: { name, phone, email, password }
Response: 201 | { user, token } ou 409 BOOTSTRAP_LOCKED

POST /auth/login
Body: { identifier, password }
Response: 200 | { user, token } ou 401 INVALID_CREDENTIALS

GET /auth/me
Headers: Authorization: Bearer <token>
Response: 200 | { user, token }
```

### 4.2 Entregas

```
GET /deliveries
Query: ?storeId=xxx&status=AGUARDANDO_MOTOBOY&startDate=2026-05-01&endDate=2026-05-31
Response: 200 | [{ id, publicCode, status, customerName, ... }]

POST /deliveries
Body: { customerPhone, customerName, street, number, ... }
Response: 201 | { id, publicCode, status, ... }

PATCH /deliveries/{id}
Body: { status, courierId?, cancelReason? }
Response: 200 | { id, status, ... }

GET /deliveries/{id}/events
Response: 200 | [{ type, createdAt, actorUserId, ... }]
```

### 4.2.1 Relatorios

```
GET /reports/deliveries-summary
Headers: Authorization: Bearer <token>
Query: ?date=2026-05-15&storeId=<uuid opcional>
Response: 200 | {
  date,
  total,
  delivered,
  issues,
  canceled,
  activeCouriers,
  byStatus,
  byStore,
  byCourier,
  byPriority
}
```

O endpoint respeita o mesmo escopo operacional: admin/gerente podem consultar todas as lojas ou filtrar `storeId`; balconista/caixa fica limitado a loja vinculada.

### 4.3 Motoboys

```
GET /couriers
Response: 200 | [{ id, name, available, currentLat, currentLng, ... }]

POST /couriers/location
Body: { courierId, latitude, longitude, available }
Response: 200 | { id, ... }
```

### 4.4 Lojas

```
GET /stores
Response: 200 | [{ id, code, name, baseType, address, ... }]

POST /stores
Body: { code, name, address, latitude, longitude, baseType }
Response: 201 | { id, ... }
```

### 4.5 Usuários

```
GET /users
Response: 200 | [{ id, name, email, role, storeId?, ... }]

POST /users
Body: { name, email, phone, password, role, storeId? }
Response: 201 | { id, ... }
```

### 4.6 Rotas

```
GET /courier-routes
Response: 200 | [{ id, courierId, status, stops: [...], ... }]

POST /courier-routes/recalculate
Body: { routeId, deliveryIds }
Response: 200 | { id, stops: [...], ... }
```

---

## 5. Frontend (React Admin)

### 5.1 Estrutura de Componentes

```
src/
├── components/
│   ├── Map.tsx                    # Leaflet map com lojas e rotas
│   ├── DeliveryForm.tsx           # Form de criação de entrega
│   ├── DeliveryStatusBadge.tsx
│   ├── LoadingSpinner.tsx
│   ├── Toast.tsx
│   └── [...outros comuns]
│
├── features/
│   ├── auth/
│   │   ├── LoginPage.tsx
│   │   ├── BootstrapAdminPage.tsx
│   │   └── useAuth.ts
│   │
│   ├── deliveries/
│   │   ├── DeliveriesPage.tsx
│   │   ├── DeliveryDetailModal.tsx
│   │   ├── useDeliveries.ts
│   │   └── api.ts
│   │
│   ├── stores/
│   │   ├── StoresPage.tsx
│   │   └── api.ts
│   │
│   └── couriers/
│       ├── CouriersPage.tsx
│       └── useLocations.ts
│
├── hooks/
│   ├── useAuth.ts              # Context de autenticação
│   ├── useQuery.ts             # TanStack Query
│   └── useRealtime.ts          # Supabase Realtime
│
└── services/
    └── api.ts                  # Axios/Fetch client
```

### 5.2 Fluxo de Login

1. Usuário em `/login` insere email/telefone e senha
2. `useAuth` faz POST `/auth/login`
3. Se 200: salva token em `localStorage` e redireciona
4. Se 401: exibe erro

### 5.3 Realtime com Supabase

```typescript
// No componente, escuta mudanças em tempo real
useEffect(() => {
  const subscription = supabaseClient
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'Delivery',
        filter: `storeId=eq.${storeId}`
      },
      (payload) => {
        // Atualiza estado com novo payload
        setDeliveries(prev => 
          prev.map(d => d.id === payload.new.id ? payload.new : d)
        );
      }
    )
    .subscribe();

  return () => subscription.unsubscribe();
}, []);
```

---

## 6. Segurança e RLS (Row-Level Security)

### 6.1 Policies de RLS no Supabase

```sql
-- Exemplo: BALCONISTA só vê entregas da sua loja
CREATE POLICY "balconista_see_own_store_deliveries"
  ON public.Delivery
  FOR SELECT
  TO authenticated
  USING (
    auth.jwt() ->> 'role' = 'BALCONISTA_CAIXA'
    AND storeId = (
      SELECT "storeId" FROM public."User" 
      WHERE id = auth.uid()
    )
  );

-- Exemplo: MOTOBOY só pode aceitar entregas disponíveis
CREATE POLICY "courier_can_accept_delivery"
  ON public.Delivery
  FOR UPDATE
  TO authenticated
  USING (
    auth.jwt() ->> 'role' = 'MOTOBOY'
    AND status = 'AGUARDANDO_MOTOBOY'
  );
```

### 6.2 Validação de Escopo no Backend

```typescript
// Em routes/deliveries.ts
if (session.role === "BALCONISTA_CAIXA" && session.storeId) {
  where.storeId = session.storeId;
}

if (session.role === "MOTOBOY" && session.courierId) {
  where.courierId = session.courierId;
}
```

---

## 7. Fallback Supabase REST API

### 7.1 Quando é Usado

Se Prisma falhar (conexão perdida, erro), tenta Supabase REST:

```typescript
// Em routes/deliveries.ts
try {
  const deliveries = await prisma.delivery.findMany(...);
  return deliveries;
} catch (error) {
  app.log.error({ error }, "prisma error");
  
  if (canUseSupabaseRest()) {
    try {
      const deliveries = await supabaseRest("Delivery", {
        query: "select=*&storeId=eq.xyz"
      });
      return deliveries.map(d => ({ ...d, source: "supabase-rest" }));
    } catch (restError) {
      return reply.status(503).send({ error: "DATABASE_UNAVAILABLE" });
    }
  }
}
```

---

## 8. Migrações e Seeding

### 8.1 Criar Migration

```bash
# Gera migration baseada em mudanças no schema.prisma
npm exec -w apps/api -- prisma migrate dev --name add_courier_location

# Ou rodar migration existente em produção
# Preferencia atual: aplicar SQL manualmente pelo Supabase SQL Editor.
# Use database/full-setup.sql quando precisar preparar o banco.
```

### 8.2 Seed de Dados

```bash
# Executa seed.sql no Supabase
supabase db push  # Local testing
supabase db push --remote  # Produção
```

### 8.3 Gerar SQL Consolidado

```bash
# Snapshot schema Prisma
npm run db:schema:snapshot

# Gera database/full-setup.sql combinando tudo
npm run db:sql:full
```

---

## 9. Deployment

### 9.1 Variáveis de Ambiente

**API (.env ou .env.production)**:
```
DATABASE_URL=postgresql://user:pass@host:5432/db
DIRECT_URL=postgresql://user:pass@host:5432/db
API_PORT=3333
API_SESSION_SECRET=<chave-secreta-producao>
SUPABASE_JWT_SECRET=<jwt-supabase>
SUPABASE_SERVICE_ROLE_JWT=<service-role>
NODE_ENV=production
```

**Frontend (.env.production)**:
```
VITE_API_URL=https://api.farmadelivery.com
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
```

### 9.2 Build e Deploy

```bash
# Build tudo
npm run build

# Resultado:
# - apps/admin/dist/ (app React compilado)
# - apps/api/dist/ (API compilada - se typescript)

# Deploy API (ex: Railway, Render, Heroku)
# Deploy Admin (ex: Vercel, Netlify)
# Migrar banco (Supabase migrations)
```

---

## 10. Testes e Debugging

### 10.1 Logs da API

```bash
# Ver logs em tempo real
tail -f api-dev.log

# Estrutura dos logs:
# {"level":30,"time":1234567890,"reqId":"req-1","res":{"statusCode":200},"msg":"request completed"}
```

### 10.2 Testar Endpoint

```bash
# Bootstrap admin
curl -X POST http://localhost:3333/auth/bootstrap-admin \
  -H "Content-Type: application/json" \
  -d '{"name":"Admin","phone":"11999999999","email":"admin@test.com","password":"12345678"}'

# Login
curl -X POST http://localhost:3333/auth/login \
  -H "Content-Type: application/json" \
  -d '{"identifier":"admin@test.com","password":"12345678"}'

# Listar entregas (com token)
curl -X GET http://localhost:3333/deliveries \
  -H "Authorization: Bearer <token>"
```

---

## 11. Checklist de Implementação

### MVP Atual (Completo)
- ✅ Painel web admin com React
- ✅ API Fastify com Prisma
- ✅ Autenticação JWT
- ✅ Entregas, lojas, motoboys
- ✅ Mapa com Leaflet
- ✅ Realtime com Supabase

### Fase 2 — Tempo Real e Motoboy (Completo)
- ✅ **App Kotlin para motoboys** (login, entregas, rota, GPS, FCM, comprovante)
- ✅ **PWA iPhone para motoboys** (paridade funcional)
- ✅ Notificações push (Firebase Admin SDK server-side)
- ✅ Relatórios operacionais com filtros e exportação CSV
- ✅ Comprovantes fotográficos opcionais
- ✅ Alocações operacionais (empréstimo, cobertura, rodízio)
- ✅ Testes automatizados extensos (API, admin, motoboys)

### Pendente
- ⏳ Consolidar RLS para tabelas operacionais
- ⏳ Conectar rotina LGPD automatizada
- ❌ Deploy de produção
- ❌ Offline-first no app Android (avaliar necessidade)

---

## 12. Contatos e Recursos

- **Supabase Console**: https://app.supabase.com/project/kwbcpjqhoowwwbpbihrk
- **Prisma Studio**: `npm exec -w apps/api -- prisma studio`
- **Documentação Prisma**: https://www.prisma.io/docs
- **Supabase Docs**: https://supabase.com/docs

---

**Fim da Documentação Técnica**
