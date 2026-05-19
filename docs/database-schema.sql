-- FarmaDelivery database schema snapshot
-- Source: apps/api/prisma/schema.prisma
-- Regenerate with: npm run db:schema:snapshot
-- Do not edit manually; update Prisma schema first.

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'GERENTE', 'BALCONISTA_CAIXA', 'MOTOBOY');

-- CreateEnum
CREATE TYPE "StoreBaseType" AS ENUM ('COMPARTILHADA', 'DEDICADA');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('RASCUNHO', 'AGUARDANDO_MOTOBOY', 'ACEITA_PELO_MOTOBOY', 'COLETADA', 'EM_ROTA', 'ENTREGUE', 'PROBLEMA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "DeliveryPriority" AS ENUM ('NORMAL', 'URGENTE', 'RETORNO');

-- CreateEnum
CREATE TYPE "DeliveryDeadlineTier" AS ENUM ('PERTO', 'MEDIO', 'LONGE');

-- CreateEnum
CREATE TYPE "DeliveryEventType" AS ENUM ('CRIADA', 'AGENDADA', 'REDIRECIONADA', 'ACEITA', 'COLETADA', 'ROTA_RECALCULADA', 'OCORRENCIA_REGISTRADA', 'NOTIFICACAO_ENVIADA', 'ENTREGUE', 'CANCELADA');

-- CreateEnum
CREATE TYPE "RouteStatus" AS ENUM ('ABERTA', 'EM_ANDAMENTO', 'FINALIZADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "RouteStopType" AS ENUM ('COLETA', 'ENTREGA');

-- CreateEnum
CREATE TYPE "RouteStopStatus" AS ENUM ('PENDENTE', 'CONCLUIDA', 'PULADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "AssignmentKind" AS ENUM ('BASE', 'TEMPORARIA', 'COBERTURA', 'DEDICADA', 'RODIZIO');

-- CreateTable
CREATE TABLE "Store" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "baseType" "StoreBaseType" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Store_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreWeeklyHours" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "opensAt" TEXT NOT NULL,
    "closesAt" TEXT NOT NULL,
    "closed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreWeeklyHours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreDateOverride" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "opensAt" TEXT,
    "closesAt" TEXT,
    "closed" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreDateOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "storeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Courier" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "baseStoreName" TEXT NOT NULL,
    "available" BOOLEAN NOT NULL DEFAULT false,
    "preferredServiceArea" TEXT NOT NULL DEFAULT 'ASTURIAS',
    "currentLat" DECIMAL(10,7),
    "currentLng" DECIMAL(10,7),
    "lastLocationAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Courier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourierDeviceToken" (
    "id" TEXT NOT NULL,
    "courierId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'android',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourierDeviceToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserStoreAssignment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "kind" "AssignmentKind" NOT NULL DEFAULT 'BASE',
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserStoreAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourierStoreAssignment" (
    "id" TEXT NOT NULL,
    "courierId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "kind" "AssignmentKind" NOT NULL DEFAULT 'COBERTURA',
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourierStoreAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerAddress" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "street" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "complement" TEXT,
    "neighborhood" TEXT,
    "reference" TEXT,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Delivery" (
    "id" TEXT NOT NULL,
    "publicCode" TEXT NOT NULL,
    "storeDailyDate" DATE NOT NULL,
    "storeDailyNumber" INTEGER NOT NULL,
    "storeId" TEXT NOT NULL,
    "redirectedFromStoreId" TEXT,
    "customerId" TEXT NOT NULL,
    "customerAddressId" TEXT NOT NULL,
    "courierId" TEXT,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'AGUARDANDO_MOTOBOY',
    "priority" "DeliveryPriority" NOT NULL DEFAULT 'NORMAL',
    "deadlineTier" "DeliveryDeadlineTier" NOT NULL DEFAULT 'MEDIO',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "earliestDispatchAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "collectedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),

    CONSTRAINT "Delivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryDailySequence" (
    "storeId" TEXT NOT NULL,
    "sequenceDate" DATE NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryDailySequence_pkey" PRIMARY KEY ("storeId","sequenceDate")
);

-- CreateTable
CREATE TABLE "DeliveryProof" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliveryProof_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryEvent" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "type" "DeliveryEventType" NOT NULL,
    "actorUserId" TEXT,
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliveryEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourierRoute" (
    "id" TEXT NOT NULL,
    "courierId" TEXT NOT NULL,
    "status" "RouteStatus" NOT NULL DEFAULT 'ABERTA',
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "recalculatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourierRoute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RouteStop" (
    "id" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "deliveryId" TEXT,
    "storeId" TEXT,
    "type" "RouteStopType" NOT NULL,
    "status" "RouteStopStatus" NOT NULL DEFAULT 'PENDENTE',
    "sequence" INTEGER NOT NULL,
    "address" TEXT NOT NULL,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "earliestAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RouteStop_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Store_code_key" ON "Store"("code");

-- CreateIndex
CREATE INDEX "StoreWeeklyHours_storeId_idx" ON "StoreWeeklyHours"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "StoreWeeklyHours_storeId_dayOfWeek_key" ON "StoreWeeklyHours"("storeId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "StoreDateOverride_date_idx" ON "StoreDateOverride"("date");

-- CreateIndex
CREATE UNIQUE INDEX "StoreDateOverride_storeId_date_key" ON "StoreDateOverride"("storeId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Courier_userId_key" ON "Courier"("userId");

-- CreateIndex
CREATE INDEX "Courier_preferredServiceArea_available_idx" ON "Courier"("preferredServiceArea", "available");

-- CreateIndex
CREATE UNIQUE INDEX "CourierDeviceToken_token_key" ON "CourierDeviceToken"("token");

-- CreateIndex
CREATE INDEX "CourierDeviceToken_courierId_active_idx" ON "CourierDeviceToken"("courierId", "active");

-- CreateIndex
CREATE INDEX "UserStoreAssignment_userId_active_startsAt_endsAt_idx" ON "UserStoreAssignment"("userId", "active", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "UserStoreAssignment_storeId_active_idx" ON "UserStoreAssignment"("storeId", "active");

-- CreateIndex
CREATE INDEX "CourierStoreAssignment_courierId_active_startsAt_endsAt_idx" ON "CourierStoreAssignment"("courierId", "active", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "CourierStoreAssignment_storeId_active_idx" ON "CourierStoreAssignment"("storeId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_phone_key" ON "Customer"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Delivery_publicCode_key" ON "Delivery"("publicCode");

-- CreateIndex
CREATE INDEX "Delivery_storeId_status_idx" ON "Delivery"("storeId", "status");

-- CreateIndex
CREATE INDEX "Delivery_storeId_storeDailyDate_idx" ON "Delivery"("storeId", "storeDailyDate");

-- CreateIndex
CREATE INDEX "Delivery_courierId_status_idx" ON "Delivery"("courierId", "status");

-- CreateIndex
CREATE INDEX "Delivery_createdAt_idx" ON "Delivery"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Delivery_storeId_storeDailyDate_storeDailyNumber_key" ON "Delivery"("storeId", "storeDailyDate", "storeDailyNumber");

-- CreateIndex
CREATE INDEX "DeliveryDailySequence_sequenceDate_idx" ON "DeliveryDailySequence"("sequenceDate");

-- CreateIndex
CREATE INDEX "DeliveryProof_deliveryId_createdAt_idx" ON "DeliveryProof"("deliveryId", "createdAt");

-- CreateIndex
CREATE INDEX "DeliveryProof_actorUserId_createdAt_idx" ON "DeliveryProof"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "DeliveryEvent_deliveryId_createdAt_idx" ON "DeliveryEvent"("deliveryId", "createdAt");

-- CreateIndex
CREATE INDEX "DeliveryEvent_type_createdAt_idx" ON "DeliveryEvent"("type", "createdAt");

-- CreateIndex
CREATE INDEX "RouteStop_routeId_status_idx" ON "RouteStop"("routeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "RouteStop_routeId_sequence_key" ON "RouteStop"("routeId", "sequence");

-- AddForeignKey
ALTER TABLE "StoreWeeklyHours" ADD CONSTRAINT "StoreWeeklyHours_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreDateOverride" ADD CONSTRAINT "StoreDateOverride_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Courier" ADD CONSTRAINT "Courier_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourierDeviceToken" ADD CONSTRAINT "CourierDeviceToken_courierId_fkey" FOREIGN KEY ("courierId") REFERENCES "Courier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserStoreAssignment" ADD CONSTRAINT "UserStoreAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserStoreAssignment" ADD CONSTRAINT "UserStoreAssignment_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourierStoreAssignment" ADD CONSTRAINT "CourierStoreAssignment_courierId_fkey" FOREIGN KEY ("courierId") REFERENCES "Courier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourierStoreAssignment" ADD CONSTRAINT "CourierStoreAssignment_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerAddress" ADD CONSTRAINT "CustomerAddress_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_customerAddressId_fkey" FOREIGN KEY ("customerAddressId") REFERENCES "CustomerAddress"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_courierId_fkey" FOREIGN KEY ("courierId") REFERENCES "Courier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryDailySequence" ADD CONSTRAINT "DeliveryDailySequence_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryProof" ADD CONSTRAINT "DeliveryProof_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "Delivery"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryProof" ADD CONSTRAINT "DeliveryProof_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryEvent" ADD CONSTRAINT "DeliveryEvent_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "Delivery"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryEvent" ADD CONSTRAINT "DeliveryEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourierRoute" ADD CONSTRAINT "CourierRoute_courierId_fkey" FOREIGN KEY ("courierId") REFERENCES "Courier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RouteStop" ADD CONSTRAINT "RouteStop_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "CourierRoute"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RouteStop" ADD CONSTRAINT "RouteStop_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "Delivery"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RouteStop" ADD CONSTRAINT "RouteStop_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

