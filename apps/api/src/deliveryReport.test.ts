import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDeliveryReport,
  buildDeliveryReportCsv,
  filterReportDeliveries,
  normalizeReportPeriod,
  reportDeliveryMatchesPeriod,
  type ReportDeliveryExportRow,
  type ReportDeliveryRow,
} from "./deliveryReport";
import { deliveryReportExportLimit, deliveryReportRestFilter } from "./routes/deliveries";

test("builds delivery report with period, proof counts and distributions", () => {
  const report = buildDeliveryReport(
    [
      makeDelivery({
        id: "created-before-delivered-inside",
        createdAt: "2026-05-14T22:00:00.000Z",
        deliveredAt: "2026-05-16T12:00:00.000Z",
        status: "ENTREGUE",
        proofCount: 1,
        priority: "URGENTE",
        courier: "Joao",
        attendantName: "Ana",
      }),
      makeDelivery({
        id: "delivered-without-proof",
        status: "ENTREGUE",
        deliveredAt: "2026-05-15T12:00:00.000Z",
        proofCount: 0,
        priority: "NORMAL",
        courier: "Carlos",
        attendantName: "Bruno",
      }),
      makeDelivery({
        id: "issue",
        status: "PROBLEMA",
        createdAt: "2026-05-16T10:00:00.000Z",
        priority: "NORMAL",
        courier: "Carlos",
        attendantName: "Ana",
      }),
      makeDelivery({
        id: "outside",
        status: "CANCELADA",
        createdAt: "2026-05-10T10:00:00.000Z",
        canceledAt: "2026-05-10T12:00:00.000Z",
      }),
    ],
    { startsAt: "2026-05-15", endsAt: "2026-05-16" },
  );

  assert.equal(report.date, null);
  assert.equal(report.startsAt, "2026-05-15");
  assert.equal(report.endsAt, "2026-05-16");
  assert.equal(report.total, 3);
  assert.equal(report.delivered, 2);
  assert.equal(report.deliveredWithProof, 1);
  assert.equal(report.deliveredWithoutProof, 1);
  assert.equal(report.issues, 1);
  assert.equal(report.canceled, 0);
  assert.equal(report.activeCouriers, 2);
  assert.deepEqual(report.byStatus, [
    { label: "ENTREGUE", count: 2 },
    { label: "PROBLEMA", count: 1 },
  ]);
  assert.deepEqual(report.byPriority, [
    { label: "NORMAL", count: 2 },
    { label: "URGENTE", count: 1 },
  ]);
  assert.deepEqual(report.byCourier, [
    { label: "Carlos", count: 2 },
    { label: "Joao", count: 1 },
  ]);
  assert.deepEqual(report.byAttendant, [
    { label: "Ana", count: 2 },
    { label: "Bruno", count: 1 },
  ]);
});

test("normalizes single-date and open-ended report periods", () => {
  assert.deepEqual(normalizeReportPeriod({ date: "2026-05-16" }), {
    startsAt: "2026-05-16",
    endsAt: "2026-05-16",
  });
  assert.deepEqual(normalizeReportPeriod({ startsAt: "2026-05-15" }), {
    startsAt: "2026-05-15",
    endsAt: "2026-05-15",
  });
  assert.equal(normalizeReportPeriod({}), null);
});

test("matches report period against any operational timestamp", () => {
  const delivery = makeDelivery({
    createdAt: "2026-05-10T10:00:00.000Z",
    acceptedAt: "2026-05-11T10:00:00.000Z",
    collectedAt: "2026-05-12T10:00:00.000Z",
    deliveredAt: "2026-05-16T10:00:00.000Z",
  });

  assert.equal(reportDeliveryMatchesPeriod(delivery, { startsAt: "2026-05-16", endsAt: "2026-05-16" }), true);
  assert.equal(reportDeliveryMatchesPeriod(delivery, { startsAt: "2026-05-13", endsAt: "2026-05-15" }), false);
});

test("filters report deliveries by status, priority, proof state and map point", () => {
  const deliveries = [
    makeDelivery({ id: "waiting", status: "AGUARDANDO_MOTOBOY", priority: "NORMAL", proofCount: 0, hasMapPoint: false }),
    makeDelivery({ id: "delivered-proof", status: "ENTREGUE", priority: "URGENTE", proofCount: 1, hasMapPoint: true }),
    makeDelivery({ id: "delivered-no-proof", status: "ENTREGUE", priority: "URGENTE", proofCount: 0, hasMapPoint: false }),
  ];

  assert.deepEqual(
    filterReportDeliveries(deliveries, null, { status: "ENTREGUE", priority: "URGENTE", proof: "com" }).map(
      (delivery) => delivery.id,
    ),
    ["delivered-proof"],
  );
  assert.deepEqual(
    filterReportDeliveries(deliveries, null, { status: "ENTREGUE", priority: "URGENTE", proof: "sem" }).map(
      (delivery) => delivery.id,
    ),
    ["delivered-no-proof"],
  );
  assert.deepEqual(
    filterReportDeliveries(deliveries, null, { mapPoint: "com" }).map((delivery) => delivery.id),
    ["delivered-proof"],
  );
  assert.deepEqual(
    filterReportDeliveries(deliveries, null, { mapPoint: "sem" }).map((delivery) => delivery.id),
    ["waiting", "delivered-no-proof"],
  );
});

test("exports delivery report csv with masked phone and distributions", () => {
  const csv = buildDeliveryReportCsv(
    [
      makeExportDelivery({
        id: "delivery-1",
        publicCode: "AST-20260516-001",
        storeDailyDate: "2026-05-16",
        storeDailyNumber: 1,
        customer: "Maria",
        phone: "(13) 98888-1234",
        status: "ENTREGUE",
        courier: "Joao",
        deliveredAt: "2026-05-16T12:00:00.000Z",
        proofCount: 1,
        attendantName: "Ana Balcao",
      }),
      makeExportDelivery({
        id: "delivery-2",
        publicCode: "FD-002",
        customer: "Jose",
        phone: "(13) 97777-1111",
        status: "PROBLEMA",
        priority: "URGENTE",
        courier: "Carlos",
      }),
    ],
    {
      generatedAt: "2026-05-16T15:00:00.000Z",
      scopeLabel: "todas as lojas",
      periodLabel: "2026-05-16",
      period: { date: "2026-05-16" },
      filters: { status: "ENTREGUE", proof: "com", mapPoint: "sem" },
      exportLimit: 10000,
    },
  );

  assert.match(csv, /"contexto_exportacao"/);
  assert.match(csv, /"gerado_em","2026-05-16T15:00:00.000Z"/);
  assert.match(csv, /"entregas_exportadas","1"/);
  assert.match(csv, /"limite_exportacao","10000"/);
  assert.match(csv, /"limite_atingido","nao"/);
  assert.match(csv, /"filtro_status","ENTREGUE"/);
  assert.match(csv, /"filtro_comprovante","com_comprovante"/);
  assert.match(csv, /"filtro_ponto_mapa","sem_ponto"/);
  assert.match(csv, /"distribuicao_por_status"/);
  assert.match(csv, /"distribuicao_por_balconista"/);
  assert.match(csv, /"Ana Balcao","1"/);
  assert.match(csv, /"ENTREGUE","1"/);
  assert.doesNotMatch(csv, /"PROBLEMA","1"/);
  assert.match(csv, /"status","balconista_lancamento","motoboy","entregue_por","prioridade"/);
  assert.match(csv, /"ENTREGUE","Ana Balcao","Joao","Joao","NORMAL"/);
  assert.match(csv, /"AST-20260516-001","2026-05-16","001","Asturias","Maria","\(13\) \*\*\*\*-1234","Av. dos Caicaras, 1171 - Asturias","nao"/);
  assert.doesNotMatch(csv, /98888|97777/);
});

test("exports map point state in server-side delivery report csv", () => {
  const csv = buildDeliveryReportCsv(
    [
      makeExportDelivery({ id: "with-map", hasMapPoint: true }),
      makeExportDelivery({ id: "without-map", hasMapPoint: false }),
    ],
    {
      generatedAt: "2026-05-16T15:00:00.000Z",
      scopeLabel: "todas as lojas",
      periodLabel: "2026-05-16",
    },
  );

  assert.match(csv, /"endereco","ponto_mapa","status"/);
  assert.match(csv, /"with-map"[\s\S]*"Av. dos Caicaras, 1171 - Asturias","sim","AGUARDANDO_MOTOBOY"/);
  assert.match(csv, /"without-map"[\s\S]*"Av. dos Caicaras, 1171 - Asturias","nao","AGUARDANDO_MOTOBOY"/);
});

test("marks server-side delivery report csv when export limit is reached", () => {
  const csv = buildDeliveryReportCsv(
    [
      makeExportDelivery({ id: "delivery-1" }),
      makeExportDelivery({ id: "delivery-2" }),
    ],
    {
      generatedAt: "2026-05-16T15:00:00.000Z",
      scopeLabel: "todas as lojas",
      periodLabel: "2026-05-16",
      period: { date: "2026-05-16" },
      exportLimit: 2,
      exportLimitReached: true,
    },
  );

  assert.match(csv, /"limite_exportacao","2"/);
  assert.match(csv, /"limite_atingido","sim"/);
});

test("escapes spreadsheet formulas in server-side delivery report csv", () => {
  const csv = buildDeliveryReportCsv(
    [
      makeExportDelivery({
        id: "=delivery",
        publicCode: "+FD-001",
        store: "@Asturias",
        customer: "-Maria",
        address: "=Av dos Caicaras",
      }),
    ],
    {
      generatedAt: "2026-05-16T15:00:00.000Z",
      scopeLabel: "=todas as lojas",
      periodLabel: "2026-05-16",
      period: { date: "2026-05-16" },
    },
  );

  assert.match(csv, /"'=todas as lojas"/);
  assert.match(csv, /"'=delivery","'\+FD-001","","","'@Asturias","'-Maria"/);
  assert.match(csv, /"'=Av dos Caicaras"/);
});

test("uses default delivery report export limit when query is omitted", () => {
  assert.equal(deliveryReportExportLimit(undefined), 5000);
  assert.equal(deliveryReportExportLimit(10000), 10000);
});

test("builds delivery report Supabase REST filters with store scope and report filters", () => {
  assert.equal(
    deliveryReportRestFilter(
      { role: "GERENTE", storeId: "store-1" },
      ["store-1", "store-2"],
      "store-2",
      { status: "ENTREGUE", priority: "URGENTE" },
    ),
    "&storeId=eq.store-2&status=eq.ENTREGUE&priority=eq.URGENTE",
  );
  assert.equal(
    deliveryReportRestFilter(
      { role: "GERENTE", storeId: "store-1" },
      ["store-1", "store-2"],
      "store-3",
      { status: "CANCELADA" },
    ),
    "&storeId=in.(store-1,store-2)&status=eq.CANCELADA",
  );
  assert.equal(
    deliveryReportRestFilter(
      { role: "ADMIN" },
      null,
      undefined,
      { priority: "RETORNO" },
    ),
    "&priority=eq.RETORNO",
  );
});

function makeDelivery(overrides: Partial<ReportDeliveryRow> = {}): ReportDeliveryRow {
  return {
    id: "delivery",
    store: "Asturias",
    status: "AGUARDANDO_MOTOBOY",
    courier: "Sem motoboy",
    priority: "NORMAL",
    createdAt: "2026-05-16T10:00:00.000Z",
    acceptedAt: null,
    collectedAt: null,
    deliveredAt: null,
    canceledAt: null,
    proofCount: 0,
    ...overrides,
  };
}

function makeExportDelivery(overrides: Partial<ReportDeliveryExportRow> = {}): ReportDeliveryExportRow {
  return {
    ...makeDelivery(overrides),
    publicCode: "FD-000",
    customer: "Cliente",
    phone: "(13) 99999-0000",
    address: "Av. dos Caicaras, 1171 - Asturias",
    ...overrides,
  };
}
