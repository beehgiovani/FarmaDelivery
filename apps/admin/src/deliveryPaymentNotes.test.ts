import assert from "node:assert/strict";
import test from "node:test";
import { buildDeliveryNotesWithPayment, formatBrazilianMoneyInput, formatPaymentDetails } from "./deliveryPaymentNotes";

test("formats card qr code pix paid and account payment details", () => {
  assert.equal(formatPaymentDetails({ paymentMethod: "CARTAO" }), "Pagamento: Cartao");
  assert.equal(formatPaymentDetails({ paymentMethod: "QRCODE" }), "Pagamento: QR Code");
  assert.equal(formatPaymentDetails({ paymentMethod: "PIX_PAGO" }), "Pagamento: Pix pago");
  assert.equal(formatPaymentDetails({ paymentMethod: "CONTA" }), "Pagamento: Conta");
});

test("formats cash payment with or without change", () => {
  assert.equal(formatPaymentDetails({ paymentMethod: "DINHEIRO", cashChangeMode: "SEM_TROCO" }), "Pagamento: Dinheiro - sem troco");
  assert.equal(
    formatPaymentDetails({ paymentMethod: "DINHEIRO", cashChangeMode: "COM_TROCO", cashChangeFor: "R$ 100,00" }),
    "Pagamento: Dinheiro - troco para R$ 100,00",
  );
  assert.equal(formatPaymentDetails({ paymentMethod: "DINHEIRO", cashChangeMode: "COM_TROCO" }), "Pagamento: Dinheiro - troco solicitado");
});

test("prepends payment details to operational notes", () => {
  assert.equal(
    buildDeliveryNotesWithPayment({
      amount: "R$ 37,50",
      paymentMethod: "DINHEIRO",
      cashChangeMode: "COM_TROCO",
      cashChangeFor: "R$ 50",
      notes: "Ligar ao chegar.",
    }),
    "Valor: R$ 37,50\nPagamento: Dinheiro - troco para R$ 50\nLigar ao chegar.",
  );
});

test("formats Brazilian money while typing from digits", () => {
  assert.equal(formatBrazilianMoneyInput(""), "");
  assert.equal(formatBrazilianMoneyInput("1"), "R$ 0,01");
  assert.equal(formatBrazilianMoneyInput("1234"), "R$ 12,34");
  assert.equal(formatBrazilianMoneyInput("R$ 100,00"), "R$ 100,00");
});
