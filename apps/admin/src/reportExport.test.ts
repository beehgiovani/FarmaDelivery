import assert from "node:assert/strict";
import test from "node:test";
import { buildDeliveriesCsv, deliveryReportFileName, maskPhone, slug } from "./reportExport";
import type { Delivery, DeliveryReportSummary } from "./types";

test("exports delivery report csv with context, summary and masked phone", () => {
  const csv = buildDeliveriesCsv(
    [
      makeDelivery({
        id: "delivery-1",
        publicCode: "AST-20260516-001",
        storeDailyDate: "2026-05-16",
        storeDailyNumber: 1,
        phone: "(13) 98888-1234",
        status: "Entregue",
        proofCount: 1,
        attendantName: "Ana Balcao",
        rawDeliveredAt: "2026-05-16T12:00:00.000Z",
      }),
    ],
    {
      generatedAt: "2026-05-16T14:00:00.000Z",
      dateLabel: "2026-05-16",
      scopeLabel: "Visao geral admin",
      loadedDeliveries: 1,
      visibleDeliveries: 1,
      exportLimit: 5000,
      exportLimitReached: false,
      statusFilter: "Entregue",
      priorityFilter: "Urgente",
      proofFilter: "com",
      mapPointFilter: "sem",
      courierFilter: "Joao",
      summary: makeSummary({
        total: 1,
        delivered: 1,
        deliveredWithProof: 1,
        deliveredWithoutProof: 0,
        issues: 0,
        canceled: 0,
        activeCouriers: 1,
        byStatus: [{ label: "ENTREGUE", count: 1 }],
        byStore: [{ label: "Asturias", count: 1 }],
        byAttendant: [{ label: "Ana Balcao", count: 1 }],
        byCourier: [{ label: "Joao", count: 1 }],
        byPriority: [{ label: "URGENTE", count: 1 }],
      }),
    },
  );

  assert.match(csv, /"contexto_exportacao"/);
  assert.match(csv, /"gerado_em","2026-05-16T14:00:00.000Z"/);
  assert.match(csv, /"escopo","Visao geral admin"/);
  assert.match(csv, /"entregas_visiveis","1"/);
  assert.match(csv, /"limite_exportacao","5000"/);
  assert.match(csv, /"limite_atingido","nao"/);
  assert.match(csv, /"filtro_status","Entregue"/);
  assert.match(csv, /"filtro_prioridade","Urgente"/);
  assert.match(csv, /"filtro_comprovante","com_comprovante"/);
  assert.match(csv, /"filtro_ponto_mapa","sem_ponto"/);
  assert.match(csv, /"filtro_motoboy","Joao"/);
  assert.match(csv, /"resumo"/);
  assert.match(csv, /"com_comprovante","1"/);
  assert.match(csv, /"distribuicao_por_loja"/);
  assert.match(csv, /"distribuicao_por_balconista"/);
  assert.match(csv, /"distribuicao_por_motoboy"/);
  assert.match(csv, /"distribuicao_por_status"/);
  assert.match(csv, /"distribuicao_por_prioridade"/);
  assert.match(csv, /"rotulo","quantidade"/);
  assert.match(csv, /"Asturias","1"/);
  assert.match(csv, /"Ana Balcao","1"/);
  assert.match(csv, /"ENTREGUE","1"/);
  assert.match(csv, /"status","balconista_lancamento","motoboy","entregue_por","prioridade"/);
  assert.match(csv, /"Entregue","Ana Balcao","Joao","Joao","Normal"/);
  assert.match(csv, /"delivery-1","AST-20260516-001","2026-05-16","001","Asturias","Maria","\(13\) \*\*\*\*-1234","Av. dos Caicaras, 1171 - Asturias","nao"/);
  assert.doesNotMatch(csv, /98888/);
});

test("exports map point state in local delivery report csv", () => {
  const csv = buildDeliveriesCsv(
    [
      makeDelivery({ id: "with-map", coordinates: { lat: -24.003825377135037, lng: -46.27390399967142 } }),
      makeDelivery({ id: "without-map", coordinates: undefined }),
    ],
    {
      generatedAt: "2026-05-16T14:00:00.000Z",
      dateLabel: "2026-05-16",
      scopeLabel: "Visao geral admin",
      loadedDeliveries: 2,
    },
  );

  assert.match(csv, /"endereco","ponto_mapa","status"/);
  assert.match(csv, /"with-map"[\s\S]*"Av. dos Caicaras, 1171 - Asturias","sim","Aguardando"/);
  assert.match(csv, /"without-map"[\s\S]*"Av. dos Caicaras, 1171 - Asturias","nao","Aguardando"/);
});

test("marks delivery report csv when export limit is reached", () => {
  const csv = buildDeliveriesCsv(
    [makeDelivery({ id: "delivery-1" }), makeDelivery({ id: "delivery-2" })],
    {
      generatedAt: "2026-05-16T14:00:00.000Z",
      dateLabel: "2026-05-16",
      scopeLabel: "Visao geral admin",
      loadedDeliveries: 2,
      visibleDeliveries: 2,
      exportLimit: 2,
      exportLimitReached: true,
    },
  );

  assert.match(csv, /"limite_exportacao","2"/);
  assert.match(csv, /"limite_atingido","sim"/);
});

test("builds delivery report summary locally when server summary is not available", () => {
  const csv = buildDeliveriesCsv(
    [
      makeDelivery({ id: "delivered-with-proof", status: "Entregue", proofCount: 2, courier: "Joao" }),
      makeDelivery({ id: "delivered-without-proof", status: "Entregue", proofCount: 0, courier: "Sem motoboy" }),
      makeDelivery({ id: "issue", status: "Problema", courier: "Carlos" }),
      makeDelivery({ id: "canceled", status: "Cancelada", courier: "Carlos" }),
    ],
    {
      generatedAt: "2026-05-16T14:00:00.000Z",
      dateLabel: "",
      scopeLabel: "Loja Asturias",
      loadedDeliveries: 4,
    },
  );

  assert.match(csv, /"entregas","4"/);
  assert.match(csv, /"entregues","2"/);
  assert.match(csv, /"com_comprovante","1"/);
  assert.match(csv, /"sem_comprovante","1"/);
  assert.match(csv, /"ocorrencias","1"/);
  assert.match(csv, /"canceladas","1"/);
  assert.match(csv, /"motoboys_ativos","2"/);
  assert.match(csv, /"distribuicao_por_status"[\s\S]*"Entregue","2"/);
  assert.match(csv, /"distribuicao_por_prioridade"[\s\S]*"Normal","4"/);
  assert.match(csv, /"distribuicao_por_motoboy"[\s\S]*"Carlos","2"/);
});

test("masks phone and builds stable report file names", () => {
  assert.equal(maskPhone("9999"), "****");
  assert.equal(maskPhone("99999-4321"), "****-4321");
  assert.equal(maskPhone("(13) 99999-4321"), "(13) ****-4321");
  assert.equal(slug("Visao Geral Admin"), "visao-geral-admin");
  assert.equal(deliveryReportFileName("Loja Astúrias", "2026-05-16"), "farmadelivery-loja-asturias-2026-05-16.csv");
});

test("escapes spreadsheet formulas in delivery report csv", () => {
  const csv = buildDeliveriesCsv(
    [
      makeDelivery({
        id: "=delivery",
        store: "+Asturias",
        customer: "@Maria",
        address: "-Av dos Caicaras",
      }),
    ],
    {
      generatedAt: "2026-05-16T14:00:00.000Z",
      dateLabel: "2026-05-16",
      scopeLabel: "=Visao admin",
      loadedDeliveries: 1,
    },
  );

  assert.match(csv, /"'=Visao admin"/);
  assert.match(csv, /"'=delivery","'=delivery","","","'\+Asturias","'@Maria"/);
  assert.match(csv, /"'-Av dos Caicaras"/);
});

function makeDelivery(overrides: Partial<Delivery> = {}): Delivery {
  return {
    id: "delivery",
    store: "Asturias",
    customer: "Maria",
    phone: "(13) 99999-0000",
    address: "Av. dos Caicaras, 1171 - Asturias",
    status: "Aguardando",
    courier: "Joao",
    createdAt: "16/05, 10:00",
    rawCreatedAt: "2026-05-16T10:00:00.000Z",
    scheduledFor: "Agora",
    priority: "Normal",
    distanceHint: "Aguardando rota",
    proofCount: 0,
    ...overrides,
    deadlineTier: overrides.deadlineTier ?? "Medio",
  };
}

function makeSummary(overrides: Partial<DeliveryReportSummary> = {}): DeliveryReportSummary {
  return {
    date: "2026-05-16",
    total: 0,
    delivered: 0,
    deliveredWithProof: 0,
    deliveredWithoutProof: 0,
    issues: 0,
    canceled: 0,
    activeCouriers: 0,
    byStatus: [],
    byStore: [],
    byAttendant: [],
    byCourier: [],
    byPriority: [],
    ...overrides,
  };
}
