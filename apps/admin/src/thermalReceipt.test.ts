import assert from "node:assert/strict";
import test from "node:test";
import { buildThermalReceiptHtml } from "./thermalReceipt";
import type { Delivery } from "./types";

test("builds an 80mm thermal receipt with delivery data", () => {
  const html = buildThermalReceiptHtml(makeDelivery({ publicCode: "ENT-0001", id: "uuid-1" }), {
    printedAt: new Date("2026-05-17T12:30:00.000Z"),
  });

  assert.match(html, /size: 80mm auto/);
  assert.match(html, /Drogaria Santo Antonio/);
  assert.match(html, /ENT-0001/);
  assert.doesNotMatch(html, /uuid-1/);
  assert.match(html, /Maria/);
  assert.match(html, /Av. dos Caicaras, 1171 - Asturias/);
  assert.match(html, /Produtos:/);
  assert.match(html, /window\.print/);
});

test("builds a 58mm thermal receipt layout when selected", () => {
  const html = buildThermalReceiptHtml(makeDelivery(), {
    paperWidthMm: 58,
    printedAt: new Date("2026-05-17T12:30:00.000Z"),
  });

  assert.match(html, /size: 58mm auto/);
  assert.match(html, /width: 50mm/);
  assert.match(html, /grid-template-columns: 17mm 1fr/);
});

test("shows store daily number when delivery already has the daily sequence", () => {
  const html = buildThermalReceiptHtml(makeDelivery({ storeDailyNumber: 9 }));

  assert.match(html, /N\. do dia/);
  assert.match(html, /009/);
});

test("prints payment and operational notes on the receipt", () => {
  const html = buildThermalReceiptHtml(
    makeDelivery({
      notes: "Pagamento: Dinheiro - troco para R$ 100\nLigar ao chegar",
    }),
  );

  assert.match(html, /Pagamento\/obs\./);
  assert.match(html, /Pagamento: Dinheiro - troco para R\$ 100/);
  assert.match(html, /Ligar ao chegar/);
  assert.match(html, /white-space: pre-wrap/);
  assert.match(html, /receiptBlock/);
  assert.match(html, /padding-bottom: 6mm/);
});

test("escapes receipt values before writing printable html", () => {
  const html = buildThermalReceiptHtml(
    makeDelivery({
      customer: "<Maria & Jose>",
      address: 'Rua "Teste" <script>',
    }),
  );

  assert.match(html, /&lt;Maria &amp; Jose&gt;/);
  assert.match(html, /Rua &quot;Teste&quot; &lt;script&gt;/);
  assert.doesNotMatch(html, /<Maria & Jose>/);
});

function makeDelivery(overrides: Partial<Delivery> = {}): Delivery {
  return {
    id: "ENT-0001",
    publicCode: undefined,
    store: "Asturias",
    customer: "Maria",
    phone: "(13) 99999-0000",
    address: "Av. dos Caicaras, 1171 - Asturias",
    status: "Aguardando",
    courier: "Sem motoboy",
    createdAt: "17/05, 09:00",
    rawCreatedAt: "2026-05-17T12:00:00.000Z",
    scheduledFor: "Agora",
    priority: "Normal",
    deadlineTier: "Medio",
    distanceHint: "Aguardando rota",
    ...overrides,
  };
}
